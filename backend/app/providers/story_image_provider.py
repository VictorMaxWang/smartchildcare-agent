from __future__ import annotations

from typing import Any

from app.core.config import Settings
from app.providers.base import ProviderResult


class MockStoryImageProvider:
    provider_name = "storybook-asset"
    mode_name = "fallback"
    model_name = "storybook-asset-v1"

    def render_scene(
        self,
        *,
        story_mode: str,
        scene_index: int,
        child_name: str,
        scene_title: str,
        scene_text: str,
    ) -> ProviderResult[dict[str, Any]]:
        asset_ref = "/storybook/card.svg" if story_mode == "card" else f"/storybook/scene-{min(scene_index + 1, 3)}.svg"
        prompt = (
            f"温柔儿童绘本插图，主角是{child_name}，场景标题为“{scene_title}”，"
            f"文案核心为“{scene_text[:80]}”，暖黄与浅蓝色调，适合移动端家长睡前阅读。"
        )
        return ProviderResult(
            output={
                "imagePrompt": prompt,
                "imageUrl": asset_ref,
                "assetRef": asset_ref,
                "imageStatus": "fallback",
            },
            provider=self.provider_name,
            mode=self.mode_name,
            source="mock",
            model=self.model_name,
        )


def resolve_story_image_provider(_settings: Settings | None = None) -> MockStoryImageProvider:
    # Real vivo image generation stays disabled in T12A until the official API
    # contract is manually verified. Only the backend may ever consume VIVO_* envs.
    return MockStoryImageProvider()
