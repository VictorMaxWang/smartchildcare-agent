from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


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
