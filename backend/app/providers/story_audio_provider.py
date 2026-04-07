from __future__ import annotations

from typing import Any

from app.core.config import Settings
from app.providers.base import ProviderResult
from app.providers.vivo_tts import VivoTtsProvider


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).split())


def _has_vivo_credentials(settings: Settings) -> bool:
    app_id = (settings.vivo_app_id or "").strip()
    app_key = settings.vivo_app_key.get_secret_value().strip() if settings.vivo_app_key else ""
    return bool(app_id and app_key)


def can_use_vivo_story_audio_provider(settings: Settings) -> bool:
    return settings.storybook_audio_provider.strip().lower() == "vivo" and _has_vivo_credentials(settings)


def _build_mock_audio_script(
    *,
    child_name: str,
    scene_index: int,
    scene_title: str,
    scene_text: str,
) -> str:
    return f"{child_name} 的第 {scene_index + 1} 幕：{scene_title}。{scene_text[:110]}".strip()


class MockStoryAudioProvider:
    provider_name = "storybook-mock-preview"
    mode_name = "fallback"
    model_name = "storybook-audio-v1"

    def render_scene(
        self,
        *,
        story_mode: str,
        scene_index: int,
        child_name: str,
        scene_title: str,
        scene_text: str,
        child_id: str | None = None,
        story_id: str | None = None,
        audio_script: str | None = None,
        voice_style: str | None = None,
    ) -> ProviderResult[dict[str, Any]]:
        del child_id, story_id
        resolved_voice_style = voice_style or ("gentle-bedtime" if scene_index >= 2 else "warm-storytelling")
        script = audio_script or _build_mock_audio_script(
            child_name=child_name,
            scene_index=scene_index,
            scene_title=scene_title,
            scene_text=scene_text,
        )
        return ProviderResult(
            output={
                "audioUrl": None,
                "audioRef": f"storybook-audio-{scene_index + 1}",
                "audioScript": script,
                "audioStatus": "fallback" if story_mode == "storybook" else "mock",
                "voiceStyle": resolved_voice_style,
            },
            provider=self.provider_name,
            mode=self.mode_name,
            source="mock",
            model=self.model_name,
        )


class VivoStoryAudioProvider:
    provider_name = "vivo-story-tts"
    mode_name = "live"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._tts_provider = VivoTtsProvider(settings)

    def render_scene(
        self,
        *,
        story_mode: str,
        scene_index: int,
        child_name: str,
        scene_title: str,
        scene_text: str,
        child_id: str | None = None,
        story_id: str | None = None,
        audio_script: str | None = None,
        voice_style: str | None = None,
    ) -> ProviderResult[dict[str, Any]]:
        if story_mode != "storybook":
            raise RuntimeError("Vivo story audio provider only runs for storybook mode")

        script = audio_script or _build_mock_audio_script(
            child_name=child_name,
            scene_index=scene_index,
            scene_title=scene_title,
            scene_text=scene_text,
        )
        tts_result = self._tts_provider.synthesize(
            text=script,
            child_id=child_id,
            story_id=story_id,
            scene_index=scene_index,
            voice_style=voice_style,
        )
        return ProviderResult(
            output={
                "audioUrl": tts_result["audioUrl"],
                "audioRef": tts_result["audioRef"],
                "audioScript": script,
                "audioStatus": "ready",
                "voiceStyle": tts_result.get("voiceStyle") or voice_style or self.settings.storybook_tts_voice,
            },
            provider=self.provider_name,
            mode=self.mode_name,
            source="vivo",
            model=f"{tts_result.get('engineId')}/{tts_result.get('voiceName')}",
            request_id=tts_result.get("requestId"),
        )


def resolve_story_audio_provider(settings: Settings | None = None) -> MockStoryAudioProvider | VivoStoryAudioProvider:
    if settings and can_use_vivo_story_audio_provider(settings):
        return VivoStoryAudioProvider(settings)
    return MockStoryAudioProvider()
