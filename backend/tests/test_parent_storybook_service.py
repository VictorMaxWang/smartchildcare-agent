from __future__ import annotations

import asyncio

from app.services.parent_storybook_service import run_parent_storybook


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


def test_parent_storybook_service_returns_three_scene_storybook():
    result = asyncio.run(run_parent_storybook(_base_payload()))

    assert result["mode"] == "storybook"
    assert result["title"]
    assert result["moral"]
    assert result["parentNote"]
    assert len(result["scenes"]) == 3
    assert result["providerMeta"]["imageProvider"] == "storybook-asset"
    assert result["providerMeta"]["audioProvider"] == "storybook-mock-preview"
    assert result["scenes"][0]["imagePrompt"]
    assert result["scenes"][0]["assetRef"] == "/storybook/scene-1.svg"
    assert result["scenes"][0]["audioScript"]


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
