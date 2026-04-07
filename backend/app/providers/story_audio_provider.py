from __future__ import annotations

from typing import Any

from app.core.config import Settings
from app.providers.base import ProviderResult


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
    ) -> ProviderResult[dict[str, Any]]:
        voice_style = "gentle-bedtime" if scene_index >= 2 else "warm-storytelling"
        script = (
            f"{child_name} 的第 {scene_index + 1} 幕：{scene_title}。"
            f"{scene_text[:110]}"
        ).strip()
        return ProviderResult(
            output={
                "audioUrl": None,
                "audioRef": f"storybook-audio-{scene_index + 1}",
                "audioScript": script,
                "audioStatus": "fallback" if story_mode == "storybook" else "mock",
                "voiceStyle": voice_style,
            },
            provider=self.provider_name,
            mode=self.mode_name,
            source="mock",
            model=self.model_name,
        )


def resolve_story_audio_provider(_settings: Settings | None = None) -> MockStoryAudioProvider:
    # Real vivo TTS stays disabled in T12A until the official API contract is
    # validated. Credentials must remain backend-only via VIVO_APP_ID/APP_KEY.
    return MockStoryAudioProvider()
