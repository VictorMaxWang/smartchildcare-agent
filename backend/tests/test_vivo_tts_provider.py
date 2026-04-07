from __future__ import annotations

import base64
import json

import pytest
from pydantic import SecretStr

from app.core.config import Settings
from app.providers.base import ProviderAuthenticationError, ProviderResponseError
from app.providers.vivo_tts import VivoTtsProvider


class _FakeWebSocket:
    def __init__(self, frames: list[dict[str, object]]):
        self.frames = [json.dumps(frame, ensure_ascii=False) for frame in frames]
        self.sent_messages: list[str] = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        del exc_type, exc, tb
        return False

    def send(self, message: str):
        self.sent_messages.append(message)

    def recv(self, timeout=None, decode=None):
        del timeout, decode
        if not self.frames:
            raise AssertionError("unexpected recv call")
        return self.frames.pop(0)


def _settings(**overrides) -> Settings:
    base = {
        "vivo_app_id": "demo-app",
        "vivo_app_key": SecretStr("demo-key"),
        "storybook_audio_provider": "vivo",
        "storybook_tts_engineid": "tts_humanoid_lam",
        "storybook_tts_voice": "F245_natural",
        "storybook_tts_fallback_engineid": "short_audio_synthesis_jovi",
        "storybook_tts_fallback_voice": "yige",
        "request_timeout_seconds": 1.0,
    }
    base.update(overrides)
    return Settings(**base)


def test_vivo_tts_provider_returns_wav_data_url(monkeypatch: pytest.MonkeyPatch):
    captured: dict[str, object] = {}

    def fake_connect(url, **kwargs):
        captured["url"] = url
        captured["headers"] = kwargs["additional_headers"]
        return _FakeWebSocket(
            [
                {"error_code": 0, "error_msg": "connect success"},
                {
                    "error_code": 0,
                    "data": {
                        "audio": base64.b64encode(b"\x01\x02\x03\x04").decode("utf-8"),
                        "status": 1,
                        "progress": 1,
                        "slice": 0,
                    },
                },
                {
                    "error_code": 0,
                    "data": {
                        "audio": base64.b64encode(b"\x05\x06").decode("utf-8"),
                        "status": 2,
                        "progress": 2,
                        "slice": 1,
                    },
                },
            ]
        )

    monkeypatch.setattr("app.providers.vivo_tts.connect", fake_connect)

    result = VivoTtsProvider(_settings()).synthesize(
        text="今天愿意主动和老师打招呼。",
        child_id="child-1",
        story_id="storybook-1",
        scene_index=0,
        voice_style="warm-storytelling",
    )

    assert captured["url"].startswith("wss://api-ai.vivo.com.cn/tts?")
    assert captured["headers"]["Authorization"] == "Bearer demo-key"
    assert result["provider"] == "vivo-tts"
    assert result["mode"] == "live"
    assert result["audioUrl"].startswith("data:audio/wav;base64,")
    wav_bytes = base64.b64decode(result["audioUrl"].split(",", 1)[1])
    assert wav_bytes[:4] == b"RIFF"
    assert result["voiceStyle"] == "warm-storytelling"
    assert result["engineId"] == "tts_humanoid_lam"
    assert result["voiceName"] == "F245_natural"
    assert result["requestId"]


def test_vivo_tts_provider_raises_on_frame_error(monkeypatch: pytest.MonkeyPatch):
    def fake_connect(url, **kwargs):
        del url, kwargs
        return _FakeWebSocket(
            [
                {"error_code": 0, "error_msg": "connect success"},
                {"error_code": 12345, "error_msg": "bad frame"},
            ]
        )

    monkeypatch.setattr("app.providers.vivo_tts.connect", fake_connect)

    with pytest.raises(ProviderResponseError, match="synthesis failed"):
        VivoTtsProvider(_settings()).synthesize(text="晚安故事", child_id="child-1", story_id="storybook-1")


def test_vivo_tts_provider_raises_when_audio_is_empty(monkeypatch: pytest.MonkeyPatch):
    def fake_connect(url, **kwargs):
        del url, kwargs
        return _FakeWebSocket(
            [
                {"error_code": 0, "error_msg": "connect success"},
                {"error_code": 0, "data": {"status": 2, "progress": 100, "slice": 1}},
            ]
        )

    monkeypatch.setattr("app.providers.vivo_tts.connect", fake_connect)

    with pytest.raises(ProviderResponseError, match="without audio data"):
        VivoTtsProvider(_settings()).synthesize(text="晚安故事", child_id="child-1", story_id="storybook-1")


def test_vivo_tts_provider_falls_back_to_secondary_voice_profile(monkeypatch: pytest.MonkeyPatch):
    calls: list[str] = []

    def fake_connect(url, **kwargs):
        del kwargs
        calls.append(url)
        if "engineid=tts_humanoid_lam" in url:
            raise ProviderResponseError("primary profile rejected")
        return _FakeWebSocket(
            [
                {"error_code": 0, "error_msg": "connect success"},
                {
                    "error_code": 0,
                    "data": {
                        "audio": base64.b64encode(b"\x11\x22").decode("utf-8"),
                        "status": 2,
                        "progress": 2,
                        "slice": 0,
                    },
                },
            ]
        )

    monkeypatch.setattr("app.providers.vivo_tts.connect", fake_connect)

    result = VivoTtsProvider(_settings()).synthesize(text="晚安故事", child_id="child-1", story_id="storybook-1")

    assert len(calls) == 2
    assert "engineid=short_audio_synthesis_jovi" in calls[1]
    assert result["engineId"] == "short_audio_synthesis_jovi"
    assert result["voiceName"] == "yige"
    assert result["mode"] == "live"
