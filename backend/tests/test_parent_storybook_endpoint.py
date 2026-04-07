from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.providers.base import ProviderResult


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
    }


def test_parent_storybook_endpoint_returns_structured_response():
    response = client.post("/api/v1/agents/parent/storybook", json=build_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["storyId"]
    assert body["childId"] == "child-1"
    assert body["mode"] == "storybook"
    assert len(body["scenes"]) == 3
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
