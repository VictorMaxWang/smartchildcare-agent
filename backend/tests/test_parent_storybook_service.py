from __future__ import annotations

import asyncio

from app.providers.base import ProviderResult
from app.services.parent_storybook_service import run_parent_storybook
from app.services.storybook_media_cache import get_storybook_media_cache


def _base_payload() -> dict:
    return {
        "snapshot": {
            "child": {
                "id": "child-1",
                "name": "安安",
                "className": "小一班",
            },
            "summary": {
                "growth": {"recordCount": 2},
                "feedback": {"count": 1},
            },
            "ruleFallback": [],
        },
        "highlightCandidates": [
            {
                "kind": "todayGrowth",
                "title": "今天的小亮点",
                "detail": "今天愿意主动和老师说早安，还愿意轻轻挥手。",
                "priority": 1,
                "source": "todayGrowth",
            },
            {
                "kind": "consultationAction",
                "title": "今晚最适合做的一件事",
                "detail": "睡前和孩子一起回顾今天最开心的瞬间，再轻声复述一遍。",
                "priority": 2,
                "source": "interventionCard",
            },
            {
                "kind": "weeklyTrend",
                "title": "一周趋势",
                "detail": "最近一周的情绪和作息都在慢慢稳定下来。",
                "priority": 3,
                "source": "weeklyTrend",
            },
        ],
        "latestInterventionCard": {
            "title": "安安今夜家庭任务",
            "tonightHomeAction": "睡前一起复盘今天的一个闪光点。",
        },
        "requestSource": "pytest",
    }


class _SceneProvider:
    def __init__(self, *, provider_name: str, image_status: str | None = None, audio_status: str | None = None):
        self.provider_name = provider_name
        self.image_status = image_status
        self.audio_status = audio_status
        self.calls: list[dict] = []

    def render_scene(self, **kwargs):
        self.calls.append(kwargs)
        if "image_prompt" in kwargs:
            status = self.image_status or "fallback"
            image_url = "https://cdn.example.com/story-1.png" if status == "ready" else "/storybook/scene-1.svg"
            return ProviderResult(
                output={
                    "imagePrompt": kwargs["image_prompt"],
                    "imageUrl": image_url,
                    "assetRef": image_url,
                    "imageStatus": status,
                },
                provider=self.provider_name,
                mode="live" if status == "ready" else "fallback",
                source="vivo" if status == "ready" else "mock",
                model="mock-image-v1",
            )

        status = self.audio_status or "fallback"
        audio_url = "data:audio/wav;base64,AAAA" if status == "ready" else None
        return ProviderResult(
            output={
                "audioUrl": audio_url,
                "audioRef": "storybook-audio-1",
                "audioScript": kwargs["audio_script"],
                "audioStatus": status,
                "voiceStyle": kwargs["voice_style"],
                "audioBytes": b"RIFF" if status == "ready" else None,
                "audioContentType": "audio/wav" if status == "ready" else None,
            },
            provider=self.provider_name,
            mode="live" if status == "ready" else "fallback",
            source="vivo" if status == "ready" else "mock",
            model="mock-audio-v1",
        )


def test_parent_storybook_service_returns_three_scene_storybook():
    result = asyncio.run(run_parent_storybook(_base_payload()))

    assert result["mode"] == "storybook"
    assert result["title"]
    assert result["moral"]
    assert result["parentNote"]
    assert len(result["scenes"]) == 3
    assert result["providerMeta"]["imageProvider"] == "storybook-asset"
    assert result["providerMeta"]["audioProvider"] == "storybook-mock-preview"
    assert result["providerMeta"]["mode"] == "fallback"
    assert result["providerMeta"]["realProvider"] is False
    assert result["fallback"] is True
    assert result["scenes"][0]["imagePrompt"]
    assert result["scenes"][0]["assetRef"] == "/storybook/scene-1.svg"
    assert result["scenes"][0]["audioScript"]


def test_parent_storybook_service_marks_live_when_all_media_is_real(monkeypatch):
    image_provider = _SceneProvider(provider_name="vivo-story-image", image_status="ready")
    audio_provider = _SceneProvider(provider_name="vivo-story-tts", audio_status="ready")

    monkeypatch.setattr(
        "app.services.parent_storybook_service.resolve_story_image_provider",
        lambda settings: image_provider,
    )
    monkeypatch.setattr(
        "app.services.parent_storybook_service.resolve_story_audio_provider",
        lambda settings: audio_provider,
    )

    result = asyncio.run(run_parent_storybook(_base_payload()))

    assert result["providerMeta"]["mode"] == "live"
    assert result["providerMeta"]["realProvider"] is True
    assert result["fallback"] is False
    assert result["providerMeta"]["imageProvider"] == "vivo-story-image"
    assert result["providerMeta"]["audioProvider"] == "vivo-story-tts"
    assert result["scenes"][0]["imageStatus"] == "ready"
    assert result["scenes"][0]["audioStatus"] == "ready"
    assert result["scenes"][0]["imageUrl"].startswith("https://cdn.example.com/")
    assert result["scenes"][0]["audioUrl"].startswith("/api/ai/parent-storybook/media/")


def test_parent_storybook_service_marks_mixed_when_only_image_is_real(monkeypatch):
    image_provider = _SceneProvider(provider_name="vivo-story-image", image_status="ready")
    audio_provider = _SceneProvider(provider_name="storybook-mock-preview", audio_status="fallback")

    monkeypatch.setattr(
        "app.services.parent_storybook_service.resolve_story_image_provider",
        lambda settings: image_provider,
    )
    monkeypatch.setattr(
        "app.services.parent_storybook_service.resolve_story_audio_provider",
        lambda settings: audio_provider,
    )

    result = asyncio.run(run_parent_storybook(_base_payload()))

    assert result["providerMeta"]["mode"] == "mixed"
    assert result["providerMeta"]["realProvider"] is True
    assert result["fallback"] is True
    assert result["providerMeta"]["imageProvider"] == "vivo-story-image"
    assert result["providerMeta"]["audioProvider"] == "storybook-mock-preview"
    assert result["scenes"][0]["imageStatus"] == "ready"
    assert result["scenes"][0]["audioStatus"] == "fallback"


def test_parent_storybook_service_degrades_to_card_when_context_is_sparse():
    payload = _base_payload()
    payload["highlightCandidates"] = []
    payload["snapshot"]["summary"]["growth"]["recordCount"] = 0
    payload["snapshot"]["summary"]["feedback"]["count"] = 0
    payload["snapshot"]["ruleFallback"] = []

    result = asyncio.run(run_parent_storybook(payload))

    assert result["mode"] == "card"
    assert len(result["scenes"]) == 1
    assert result["fallback"] is True
    assert result["fallbackReason"] == "sparse-parent-context"
    assert result["providerMeta"]["mode"] == "fallback"


def test_parent_storybook_service_includes_style_preset_in_prompt(monkeypatch):
    image_provider = _SceneProvider(provider_name="vivo-story-image", image_status="ready")
    audio_provider = _SceneProvider(provider_name="storybook-mock-preview", audio_status="fallback")

    monkeypatch.setattr(
        "app.services.parent_storybook_service.resolve_story_image_provider",
        lambda settings: image_provider,
    )
    monkeypatch.setattr(
        "app.services.parent_storybook_service.resolve_story_audio_provider",
        lambda settings: audio_provider,
    )

    payload = _base_payload()
    payload["stylePreset"] = "moonlit-cutout"
    result = asyncio.run(run_parent_storybook(payload))

    assert result["stylePreset"] == "moonlit-cutout"
    assert "月夜剪纸" in image_provider.calls[0]["image_prompt"]


def test_parent_storybook_service_reuses_media_cache(monkeypatch):
    image_provider = _SceneProvider(provider_name="vivo-story-image", image_status="ready")
    audio_provider = _SceneProvider(provider_name="vivo-story-tts", audio_status="ready")

    monkeypatch.setattr(
        "app.services.parent_storybook_service.resolve_story_image_provider",
        lambda settings: image_provider,
    )
    monkeypatch.setattr(
        "app.services.parent_storybook_service.resolve_story_audio_provider",
        lambda settings: audio_provider,
    )

    media_cache = get_storybook_media_cache()
    media_cache._entries.clear()

    first = asyncio.run(run_parent_storybook(_base_payload()))
    second = asyncio.run(run_parent_storybook(_base_payload()))

    assert first["providerMeta"]["cacheHitCount"] == 0
    assert second["providerMeta"]["cacheHitCount"] == 0
    assert image_provider.calls and len(image_provider.calls) == 6
    assert audio_provider.calls and len(audio_provider.calls) == 6
    assert len(media_cache._entries) == 3
    assert second["scenes"][0]["imageCacheHit"] is False
    assert second["scenes"][0]["audioCacheHit"] is False
    assert first["scenes"][0]["audioUrl"] == second["scenes"][0]["audioUrl"]
    assert second["scenes"][0]["audioUrl"].startswith("/api/ai/parent-storybook/media/")
