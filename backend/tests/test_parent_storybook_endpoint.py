from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.providers.base import ProviderResult
from app.schemas.parent_storybook import ParentStoryBookRequest


client = TestClient(app)


def build_payload() -> dict:
    return {
        "snapshot": {
            "child": {"id": "child-1", "name": "安安", "className": "小一班"},
            "summary": {
                "growth": {"recordCount": 1},
                "feedback": {"count": 1},
            },
            "ruleFallback": [],
        },
        "highlightCandidates": [
            {
                "kind": "todayGrowth",
                "title": "今天的小亮点",
                "detail": "今天愿意主动打招呼，也愿意跟着老师一起收玩具。",
                "priority": 1,
            }
        ],
        "requestSource": "pytest-endpoint",
        "stylePreset": "forest-crayon",
    }


def test_parent_storybook_endpoint_returns_structured_response():
    response = client.post("/api/v1/agents/parent/storybook", json=build_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["storyId"]
    assert body["childId"] == "child-1"
    assert body["mode"] == "storybook"
    assert body["stylePreset"] == "forest-crayon"
    assert len(body["scenes"]) == 6
    assert body["providerMeta"]["sceneCount"] == 6
    assert body["providerMeta"]["provider"] == "parent-storybook-rule"
    assert body["providerMeta"]["mode"] == "fallback"
    assert body["providerMeta"]["realProvider"] is False


def test_parent_storybook_endpoint_can_return_live_media(monkeypatch):
    class _LiveProvider:
        def __init__(self, *, provider_name: str, media_kind: str):
            self.provider_name = provider_name
            self.media_kind = media_kind

        def render_scene(self, **kwargs):
            if self.media_kind == "image":
                return ProviderResult(
                    output={
                        "imagePrompt": kwargs["image_prompt"],
                        "imageUrl": "https://cdn.example.com/story-live.png",
                        "assetRef": "https://cdn.example.com/story-live.png",
                        "imageStatus": "ready",
                    },
                    provider=self.provider_name,
                    mode="live",
                    source="vivo",
                    model="live-image",
                )
            return ProviderResult(
                output={
                    "audioUrl": "data:audio/wav;base64,AAAA",
                    "audioRef": "live-audio-1",
                    "audioScript": kwargs["audio_script"],
                    "audioStatus": "ready",
                    "voiceStyle": kwargs["voice_style"],
                    "audioBytes": b"RIFF",
                    "audioContentType": "audio/wav",
                },
                provider=self.provider_name,
                mode="live",
                source="vivo",
                model="live-audio",
            )

    monkeypatch.setattr(
        "app.services.parent_storybook_service.resolve_story_image_provider",
        lambda settings: _LiveProvider(provider_name="vivo-story-image", media_kind="image"),
    )
    monkeypatch.setattr(
        "app.services.parent_storybook_service.resolve_story_audio_provider",
        lambda settings: _LiveProvider(provider_name="vivo-story-tts", media_kind="audio"),
    )

    response = client.post("/api/v1/agents/parent/storybook", json=build_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["providerMeta"]["mode"] == "live"
    assert body["providerMeta"]["realProvider"] is True
    assert body["fallback"] is False
    assert body["scenes"][0]["imageStatus"] == "ready"
    assert body["scenes"][0]["audioStatus"] == "ready"
    assert body["scenes"][0]["audioUrl"].startswith("/api/ai/parent-storybook/media/")


def test_parent_storybook_media_endpoint_serves_cached_audio(monkeypatch):
    class _AudioProvider:
        def __init__(self, *, provider_name: str, media_kind: str):
            self.provider_name = provider_name
            self.media_kind = media_kind

        def render_scene(self, **kwargs):
            if self.media_kind == "image":
                return ProviderResult(
                    output={
                        "imagePrompt": kwargs["image_prompt"],
                        "imageUrl": "https://cdn.example.com/story-live.png",
                        "assetRef": "https://cdn.example.com/story-live.png",
                        "imageStatus": "ready",
                    },
                    provider=self.provider_name,
                    mode="live",
                    source="vivo",
                    model="live-image",
                )
            return ProviderResult(
                output={
                    "audioUrl": "data:audio/wav;base64,AAAA",
                    "audioRef": "live-audio-1",
                    "audioScript": kwargs["audio_script"],
                    "audioStatus": "ready",
                    "voiceStyle": kwargs["voice_style"],
                    "audioBytes": b"RIFF",
                    "audioContentType": "audio/wav",
                },
                provider=self.provider_name,
                mode="live",
                source="vivo",
                model="live-audio",
            )

    monkeypatch.setattr(
        "app.services.parent_storybook_service.resolve_story_image_provider",
        lambda settings: _AudioProvider(provider_name="vivo-story-image", media_kind="image"),
    )
    monkeypatch.setattr(
        "app.services.parent_storybook_service.resolve_story_audio_provider",
        lambda settings: _AudioProvider(provider_name="vivo-story-tts", media_kind="audio"),
    )

    response = client.post("/api/v1/agents/parent/storybook", json=build_payload())
    body = response.json()
    media_url = body["scenes"][0]["audioUrl"]
    media_key = media_url.rsplit("/", 1)[-1]
    media_response = client.get(f"/api/v1/agents/parent/storybook/media/{media_key}")

    assert media_response.status_code == 200
    assert media_response.headers["content-type"] == "audio/wav"
    assert media_response.content == b"RIFF"


def test_parent_storybook_endpoint_can_return_mixed_media(monkeypatch):
    class _MixedProvider:
        def __init__(self, *, provider_name: str, media_kind: str):
            self.provider_name = provider_name
            self.media_kind = media_kind

        def render_scene(self, **kwargs):
            if self.media_kind == "image":
                return ProviderResult(
                    output={
                        "imagePrompt": kwargs["image_prompt"],
                        "imageUrl": "https://cdn.example.com/story-mixed.png",
                        "assetRef": "https://cdn.example.com/story-mixed.png",
                        "imageStatus": "ready",
                    },
                    provider=self.provider_name,
                    mode="live",
                    source="vivo",
                    model="mixed-image",
                )
            return ProviderResult(
                output={
                    "audioUrl": None,
                    "audioRef": "story-mixed-audio-1",
                    "audioScript": kwargs["audio_script"],
                    "audioStatus": "fallback",
                    "voiceStyle": kwargs["voice_style"],
                },
                provider=self.provider_name,
                mode="fallback",
                source="mock",
                model="mixed-audio",
            )

    monkeypatch.setattr(
        "app.services.parent_storybook_service.resolve_story_image_provider",
        lambda settings: _MixedProvider(provider_name="vivo-story-image", media_kind="image"),
    )
    monkeypatch.setattr(
        "app.services.parent_storybook_service.resolve_story_audio_provider",
        lambda settings: _MixedProvider(provider_name="storybook-mock-preview", media_kind="audio"),
    )

    response = client.post("/api/v1/agents/parent/storybook", json=build_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["providerMeta"]["mode"] == "mixed"
    assert body["providerMeta"]["realProvider"] is True
    assert body["fallback"] is True
    assert body["scenes"][0]["imageStatus"] == "ready"
    assert body["scenes"][0]["audioStatus"] == "fallback"


def test_parent_storybook_schema_parses_new_v2_fields_with_aliases():
    request = ParentStoryBookRequest.model_validate(
        {
            **build_payload(),
            "generationMode": "hybrid",
            "manualTheme": "表达情绪",
            "manualPrompt": "把主题讲成一部可朗读的小绘本。",
            "pageCount": 8,
            "goalKeywords": ["表达情绪", "勇气"],
            "protagonistArchetype": "bunny",
        }
    )
    snake_case_request = ParentStoryBookRequest.model_validate(
        {
            **build_payload(),
            "generation_mode": "manual-theme",
            "manual_theme": "独立入睡",
            "manual_prompt": "把睡前安抚讲成晚安故事。",
            "page_count": 4,
            "goal_keywords": ["独立入睡"],
            "protagonist_archetype": "bear",
        }
    )

    assert request.generation_mode == "hybrid"
    assert request.manual_theme == "表达情绪"
    assert request.manual_prompt == "把主题讲成一部可朗读的小绘本。"
    assert request.page_count == 8
    assert request.goal_keywords == ["表达情绪", "勇气"]
    assert request.protagonist_archetype == "bunny"
    assert snake_case_request.generation_mode == "manual-theme"
    assert snake_case_request.page_count == 4
    assert snake_case_request.protagonist_archetype == "bear"


def test_parent_storybook_endpoint_rejects_invalid_page_count():
    payload = build_payload()
    payload["pageCount"] = 5

    response = client.post("/api/v1/agents/parent/storybook", json=payload)

    assert response.status_code == 422
