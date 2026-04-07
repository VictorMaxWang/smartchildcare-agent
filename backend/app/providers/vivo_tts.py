from __future__ import annotations

import base64
import hashlib
import io
import json
import time
import wave
from typing import Any
from urllib.parse import urlencode, urlparse, urlunparse
from uuid import uuid4

from app.core.config import Settings
from app.providers.base import (
    ProviderAuthenticationError,
    ProviderConfigurationError,
    ProviderResponseError,
)

try:  # pragma: no cover - dependency availability is environment-specific
    from websockets.exceptions import InvalidStatus, WebSocketException
    from websockets.sync.client import connect
except ImportError:  # pragma: no cover - guarded at runtime
    InvalidStatus = WebSocketException = Exception
    connect = None


TTS_PATH = "/tts"
TTS_SAMPLE_RATE = 24_000
TTS_SAMPLE_WIDTH = 2
TTS_CHANNELS = 1
TTS_AUDIO_FORMAT = "audio/L16;rate=24000"


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).split())


def _stable_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _build_wav_data_url(pcm_bytes: bytes) -> str:
    wav_bytes = _build_wav_bytes(pcm_bytes)
    wav_base64 = base64.b64encode(wav_bytes).decode("utf-8")
    return f"data:audio/wav;base64,{wav_base64}"


def _build_wav_bytes(pcm_bytes: bytes) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(TTS_CHANNELS)
        wav_file.setsampwidth(TTS_SAMPLE_WIDTH)
        wav_file.setframerate(TTS_SAMPLE_RATE)
        wav_file.writeframes(pcm_bytes)
    return buffer.getvalue()


def _to_websocket_base_url(base_url: str) -> str:
    parsed = urlparse(base_url.rstrip("/"))
    scheme = parsed.scheme.lower()
    if scheme == "https":
        parsed = parsed._replace(scheme="wss")
    elif scheme == "http":
        parsed = parsed._replace(scheme="ws")
    return urlunparse(parsed).rstrip("/")


class VivoTtsProvider:
    provider_name = "vivo-tts"

    def __init__(self, settings: Settings):
        self.settings = settings

    def synthesize(
        self,
        *,
        text: str,
        child_id: str | None = None,
        story_id: str | None = None,
        scene_index: int = 0,
        voice_style: str | None = None,
    ) -> dict[str, Any]:
        normalized_text = _normalize_text(text)
        if not normalized_text:
            raise ProviderResponseError("Vivo TTS requires non-empty text")

        app_id, app_key = self._require_credentials()
        request_id = uuid4().hex
        profiles = self._profiles()
        last_error: Exception | None = None

        for profile_index, (engine_id, voice_name) in enumerate(profiles):
            try:
                return self._synthesize_once(
                    app_id=app_id,
                    app_key=app_key,
                    request_id=request_id,
                    text=normalized_text,
                    child_id=child_id,
                    story_id=story_id,
                    scene_index=scene_index,
                    voice_style=voice_style,
                    engine_id=engine_id,
                    voice_name=voice_name,
                )
            except (ProviderAuthenticationError, ProviderConfigurationError):
                raise
            except ProviderResponseError as exc:
                last_error = exc
                if profile_index >= len(profiles) - 1:
                    break

        if last_error:
            raise last_error
        raise ProviderResponseError("Vivo TTS failed without returning an explicit error")

    def _synthesize_once(
        self,
        *,
        app_id: str,
        app_key: str,
        request_id: str,
        text: str,
        child_id: str | None,
        story_id: str | None,
        scene_index: int,
        voice_style: str | None,
        engine_id: str,
        voice_name: str,
    ) -> dict[str, Any]:
        if connect is None:
            raise ProviderConfigurationError("websockets package is required for vivo TTS")

        query = {
            "engineid": engine_id,
            "system_time": int(time.time()),
            "user_id": self._build_user_id(child_id=child_id, story_id=story_id, scene_index=scene_index),
            "model": self.settings.storybook_tts_model,
            "product": self.settings.storybook_tts_product,
            "package": self.settings.storybook_tts_package,
            "client_version": self.settings.storybook_tts_client_version,
            "system_version": self.settings.storybook_tts_system_version,
            "sdk_version": self.settings.storybook_tts_sdk_version,
            "android_version": self.settings.storybook_tts_android_version,
            "requestId": request_id,
        }
        ws_url = f"{_to_websocket_base_url(self.settings.vivo_base_url)}{TTS_PATH}?{urlencode(query)}"

        try:
            with connect(
                ws_url,
                additional_headers={"Authorization": f"Bearer {app_key}"},
                open_timeout=self.settings.request_timeout_seconds,
                close_timeout=self.settings.request_timeout_seconds,
                max_size=None,
            ) as websocket:
                connect_frame = self._recv_json(websocket, timeout=self.settings.request_timeout_seconds)
                connect_error = int(connect_frame.get("error_code") or 0)
                if connect_error != 0:
                    raise ProviderResponseError(
                        f"Vivo TTS handshake failed: {connect_frame.get('error_msg') or connect_error}"
                    )

                websocket.send(
                    json.dumps(
                        {
                            "aue": 0,
                            "auf": TTS_AUDIO_FORMAT,
                            "vcn": voice_name,
                            "speed": self.settings.storybook_tts_speed,
                            "volume": self.settings.storybook_tts_volume,
                            "text": base64.b64encode(text.encode("utf-8")).decode("utf-8"),
                            "encoding": "utf8",
                            "reqId": self._build_numeric_req_id(request_id),
                        },
                        ensure_ascii=False,
                    )
                )

                pcm_chunks: list[bytes] = []
                while True:
                    frame = self._recv_json(websocket, timeout=self.settings.request_timeout_seconds)
                    error_code = int(frame.get("error_code") or 0)
                    if error_code != 0:
                        raise ProviderResponseError(
                            f"Vivo TTS synthesis failed: {frame.get('error_msg') or error_code}"
                        )

                    data = frame.get("data") or {}
                    if not isinstance(data, dict):
                        raise ProviderResponseError("Vivo TTS returned invalid frame data")
                    audio_chunk = _normalize_text(data.get("audio"))
                    if audio_chunk:
                        pcm_chunks.append(base64.b64decode(audio_chunk))
                    status = int(data.get("status") or 0)
                    if status == 2:
                        break

                pcm_bytes = b"".join(pcm_chunks)
                if not pcm_bytes:
                    raise ProviderResponseError("Vivo TTS finished without audio data")
                wav_bytes = _build_wav_bytes(pcm_bytes)

                return {
                    "provider": self.provider_name,
                    "mode": "live",
                    "audioUrl": f"data:audio/wav;base64,{base64.b64encode(wav_bytes).decode('utf-8')}",
                    "audioRef": f"vivo-tts-{request_id}",
                    "audioScript": text,
                    "voiceStyle": voice_style or voice_name,
                    "engineId": engine_id,
                    "voiceName": voice_name,
                    "requestId": request_id,
                    "appId": app_id,
                    "audioBytes": wav_bytes,
                    "audioContentType": "audio/wav",
                }
        except InvalidStatus as exc:
            response = getattr(exc, "response", None)
            status_code = getattr(response, "status_code", None)
            if status_code in {401, 403}:
                raise ProviderAuthenticationError(
                    f"Vivo TTS authentication failed with status {status_code}"
                ) from exc
            raise ProviderResponseError(f"Vivo TTS websocket handshake failed with status {status_code}") from exc
        except TimeoutError as exc:
            raise ProviderResponseError("Vivo TTS timed out") from exc
        except WebSocketException as exc:
            raise ProviderResponseError(f"Vivo TTS websocket error: {type(exc).__name__}") from exc
        except OSError as exc:
            raise ProviderResponseError(f"Vivo TTS transport error: {type(exc).__name__}") from exc

    def _require_credentials(self) -> tuple[str, str]:
        app_id = (self.settings.vivo_app_id or "").strip()
        app_key = self.settings.vivo_app_key.get_secret_value().strip() if self.settings.vivo_app_key else ""
        if not app_id or not app_key:
            raise ProviderConfigurationError("VIVO_APP_ID and VIVO_APP_KEY are required for vivo TTS")
        return app_id, app_key

    def _profiles(self) -> list[tuple[str, str]]:
        profiles: list[tuple[str, str]] = []
        primary = (
            self.settings.storybook_tts_engineid.strip(),
            self.settings.storybook_tts_voice.strip(),
        )
        secondary = (
            self.settings.storybook_tts_fallback_engineid.strip(),
            self.settings.storybook_tts_fallback_voice.strip(),
        )
        for engine_id, voice_name in (primary, secondary):
            if not engine_id or not voice_name:
                continue
            candidate = (engine_id, voice_name)
            if candidate not in profiles:
                profiles.append(candidate)
        return profiles

    @staticmethod
    def _recv_json(websocket: Any, *, timeout: float) -> dict[str, Any]:
        raw = websocket.recv(timeout=timeout)
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        if not isinstance(raw, str):
            raise ProviderResponseError("Vivo TTS frame is not text JSON")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ProviderResponseError("Vivo TTS returned invalid JSON") from exc
        if not isinstance(payload, dict):
            raise ProviderResponseError("Vivo TTS frame is not a JSON object")
        return payload

    @staticmethod
    def _build_user_id(*, child_id: str | None, story_id: str | None, scene_index: int) -> str:
        seed = "::".join(
            [
                _normalize_text(child_id) or "child",
                _normalize_text(story_id) or "story",
                str(scene_index + 1),
            ]
        )
        return _stable_hash(seed)[:32]

    @staticmethod
    def _build_numeric_req_id(request_id: str) -> int:
        return int(request_id[:12], 16)
