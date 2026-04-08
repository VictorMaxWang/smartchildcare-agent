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
            image_url = "https://cdn.example.com/story-1.png" if status == "ready" else None
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


def test_parent_storybook_service_returns_six_page_storybook_by_default():
    result = asyncio.run(run_parent_storybook(_base_payload()))

    assert result["mode"] == "storybook"
    assert result["title"]
    assert result["moral"]
    assert result["parentNote"]
    assert len(result["scenes"]) == 6
    assert result["providerMeta"]["sceneCount"] == 6
    assert result["providerMeta"]["imageProvider"] == "storybook-asset"
    assert result["providerMeta"]["audioProvider"] == "storybook-mock-preview"
    assert result["providerMeta"]["mode"] == "fallback"
    assert result["providerMeta"]["audioDelivery"] == "preview-only"
    assert result["providerMeta"]["realProvider"] is False
    assert result["fallback"] is True
    assert result["scenes"][0]["imagePrompt"]
    assert result["scenes"][0]["assetRef"].startswith("/api/ai/parent-storybook/media/")
    assert "/storybook/scene-" not in result["scenes"][0]["assetRef"]
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
    assert result["providerMeta"]["audioDelivery"] == "real"
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
    assert result["providerMeta"]["audioDelivery"] == "preview-only"
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


def test_parent_storybook_service_custom_style_overrides_preset_prompt(monkeypatch):
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
    payload["styleMode"] = "custom"
    payload["customStylePrompt"] = "梦幻3D儿童绘本，柔焦，浅景深"
    payload["customStyleNegativePrompt"] = "不要照片感、不要复杂背景"

    asyncio.run(run_parent_storybook(payload))

    assert "梦幻3D儿童绘本" in image_provider.calls[0]["image_prompt"]
    assert "不要照片感" in image_provider.calls[0]["image_prompt"]
    assert "月夜剪纸" not in image_provider.calls[0]["image_prompt"]


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
    assert image_provider.calls and len(image_provider.calls) == 12
    assert audio_provider.calls and len(audio_provider.calls) == 12
    assert len(media_cache._entries) == 6
    assert second["scenes"][0]["imageCacheHit"] is False
    assert second["scenes"][0]["audioCacheHit"] is False
    assert first["scenes"][0]["audioUrl"] == second["scenes"][0]["audioUrl"]
    assert second["scenes"][0]["audioUrl"].startswith("/api/ai/parent-storybook/media/")


def test_parent_storybook_service_supports_page_count_variants_and_manual_theme_without_child_data():
    for page_count in (4, 6, 8):
        payload = {
            "snapshot": {
                "child": {},
                "summary": {
                    "growth": {"recordCount": 0, "topCategories": []},
                    "feedback": {"count": 0, "keywords": []},
                },
                "ruleFallback": [],
            },
            "highlightCandidates": [],
            "generationMode": "manual-theme",
            "manualTheme": "独立入睡",
            "manualPrompt": "把睡前分离讲成轻柔、可朗读的晚安故事。",
            "pageCount": page_count,
            "goalKeywords": ["独立入睡", "睡前安抚"],
            "requestSource": "pytest-manual",
        }

        result = asyncio.run(run_parent_storybook(payload))

        assert result["mode"] == "storybook"
        assert result["childId"] == "storybook-guest"
        assert len(result["scenes"]) == page_count
        assert result["providerMeta"]["sceneCount"] == page_count
        assert result["providerMeta"]["audioDelivery"] == "preview-only"
        assert all(scene["audioScript"] for scene in result["scenes"])
        assert all(scene["assetRef"].startswith("/api/ai/parent-storybook/media/") for scene in result["scenes"])
        assert all("/storybook/scene-" not in scene["assetRef"] for scene in result["scenes"])
        assert "独立入睡" in result["summary"]
        assert "今晚" in result["scenes"][-1]["sceneText"]


def test_parent_storybook_service_hybrid_threads_theme_into_story_content():
    payload = _base_payload()
    child_detail = "先停一停，再轻轻说出难过。"
    payload.update(
        {
            "generationMode": "hybrid",
            "manualTheme": "表达情绪",
            "manualPrompt": "让孩子知道情绪可以被看见，也可以慢慢说出来。",
            "pageCount": 4,
            "goalKeywords": ["表达情绪"],
        }
    )
    payload["highlightCandidates"] = [
        {
            "kind": "warningSuggestion",
            "title": "先停一停",
            "detail": child_detail,
            "priority": 1,
            "source": "suggestions",
        },
        *payload["highlightCandidates"],
    ]

    result = asyncio.run(run_parent_storybook(payload))

    assert result["mode"] == "storybook"
    assert len(result["scenes"]) == 4
    assert any("表达情绪" in scene["sceneText"] for scene in result["scenes"])
    assert any(child_detail in scene["sceneText"] for scene in result["scenes"])
    assert any("表达情绪" in scene["imagePrompt"] for scene in result["scenes"])
    assert any(child_detail in scene["imagePrompt"] for scene in result["scenes"])
    assert any("表达情绪" in scene["audioScript"] for scene in result["scenes"])
