from __future__ import annotations

import asyncio
from datetime import date, timedelta

from app.services.parent_trend_service import run_parent_trend_query


TODAY = date(2026, 4, 4)


def _day(days_ago: int) -> str:
    return (TODAY - timedelta(days=days_ago)).isoformat()


def _base_snapshot() -> dict:
    return {
        "children": [
            {
                "id": "child-1",
                "name": "安安",
                "nickname": "安宝",
                "institutionId": "inst-test",
                "className": "小一班",
            }
        ],
        "attendance": [],
        "meals": [],
        "growth": [],
        "feedback": [],
        "health": [],
        "taskCheckIns": [],
        "interventionCards": [],
        "consultations": [],
        "mobileDrafts": [],
        "reminders": [],
        "updatedAt": "2026-04-04T00:00:00Z",
    }


def _add_growth(
    snapshot: dict,
    *,
    days_ago: int,
    description: str,
    tags: list[str],
    needs_attention: bool = False,
) -> None:
    snapshot["growth"].append(
        {
            "id": f"growth-{days_ago}-{len(snapshot['growth'])}",
            "childId": "child-1",
            "createdAt": f"{_day(days_ago)}T09:00:00+08:00",
            "category": "social-emotional",
            "tags": tags,
            "selectedIndicators": ["daily-observation"],
            "description": description,
            "needsAttention": needs_attention,
            "followUpAction": "continue observation",
        }
    )


def _add_meal(
    snapshot: dict,
    *,
    days_ago: int,
    nutrition_score: int,
    water_ml: int,
    intake_level: str,
    preference: str,
    summary: str,
) -> None:
    snapshot["meals"].append(
        {
            "id": f"meal-{days_ago}-{len(snapshot['meals'])}",
            "childId": "child-1",
            "date": _day(days_ago),
            "meal": "lunch",
            "foods": ["rice", "vegetable", "protein"],
            "intakeLevel": intake_level,
            "preference": preference,
            "waterMl": water_ml,
            "nutritionScore": nutrition_score,
            "aiEvaluation": {"summary": summary},
        }
    )


def _add_health(
    snapshot: dict,
    *,
    days_ago: int,
    temperature: float,
    is_abnormal: bool,
    remark: str,
    mood: str = "steady",
) -> None:
    snapshot["health"].append(
        {
            "id": f"health-{days_ago}-{len(snapshot['health'])}",
            "childId": "child-1",
            "date": _day(days_ago),
            "temperature": temperature,
            "mood": mood,
            "handMouthEye": "normal",
            "isAbnormal": is_abnormal,
            "remark": remark,
        }
    )


def build_emotion_improving_snapshot() -> dict:
    snapshot = _base_snapshot()
    for days_ago in (29, 27, 25, 23, 21, 19):
        _add_growth(
            snapshot,
            days_ago=days_ago,
            description="入园时明显哭闹，需要安抚，分离焦虑仍然比较明显。",
            tags=["分离焦虑", "哭闹", "安抚"],
            needs_attention=True,
        )
    for days_ago in (10, 8, 6, 4, 2, 0):
        _add_growth(
            snapshot,
            days_ago=days_ago,
            description="今天入园更平静，情绪稳定，能主动跟老师进班。",
            tags=["平静", "稳定", "主动"],
            needs_attention=False,
        )
    return snapshot


def build_diet_improving_snapshot() -> dict:
    snapshot = _base_snapshot()
    early_days = (
        (6, 56, 90, "low", "dislike", "只吃主食，蔬菜几乎未动。"),
        (5, 58, 100, "low", "dislike", "对蛋白接受度偏低，剩余明显。"),
        (4, 60, 110, "medium", "dislike", "有回避蔬菜的情况。"),
    )
    late_days = (
        (3, 74, 140, "medium", "neutral", "主食和蛋白基本都能吃完。"),
        (2, 80, 150, "good", "neutral", "蔬菜接受度比前几天更好。"),
        (1, 84, 170, "good", "accept", "整体进餐比较主动。"),
        (0, 88, 180, "high", "accept", "当日饮食完成度高，喝水也更稳定。"),
    )
    for item in (*early_days, *late_days):
        _add_meal(
            snapshot,
            days_ago=item[0],
            nutrition_score=item[1],
            water_ml=item[2],
            intake_level=item[3],
            preference=item[4],
            summary=item[5],
        )
    return snapshot


def build_sleep_fluctuating_snapshot() -> dict:
    snapshot = _base_snapshot()
    low_days = (13, 9, 4, 0)
    high_days = (11, 7, 6, 2)
    for days_ago in low_days:
        _add_growth(
            snapshot,
            days_ago=days_ago,
            description="午睡前哭闹，需要安抚较久。",
            tags=["午睡", "哭闹"],
            needs_attention=True,
        )
    for days_ago in high_days:
        _add_growth(
            snapshot,
            days_ago=days_ago,
            description="今天睡得安稳，睡眠平稳，老师反馈状态不错。",
            tags=["安稳", "平稳"],
            needs_attention=False,
        )
    return snapshot


def build_health_attention_snapshot() -> dict:
    snapshot = _base_snapshot()
    for days_ago in (6, 5, 4):
        _add_health(
            snapshot,
            days_ago=days_ago,
            temperature=36.6,
            is_abnormal=False,
            remark="晨检状态正常。",
            mood="steady",
        )
    for days_ago, temperature, remark in (
        (2, 37.8, "晨检有发热和咳嗽表现。"),
        (1, 38.2, "体温偏高，精神差，需要重点留意。"),
        (0, 38.1, "今日晨检仍有发热，不适信号持续。"),
    ):
        _add_health(
            snapshot,
            days_ago=days_ago,
            temperature=temperature,
            is_abnormal=True,
            remark=remark,
            mood="tired",
        )
    return snapshot


def build_sparse_growth_snapshot() -> dict:
    snapshot = _base_snapshot()
    _add_meal(
        snapshot,
        days_ago=1,
        nutrition_score=76,
        water_ml=140,
        intake_level="medium",
        preference="neutral",
        summary="进餐尚可。",
    )
    _add_meal(
        snapshot,
        days_ago=0,
        nutrition_score=82,
        water_ml=150,
        intake_level="good",
        preference="accept",
        summary="饮食状态比较稳定。",
    )
    return snapshot


def test_parent_trend_service_emotion_month_returns_improving():
    result = asyncio.run(
        run_parent_trend_query(
            {
                "question": "最近一个月分离焦虑缓解了吗？",
                "childId": "child-1",
                "appSnapshot": build_emotion_improving_snapshot(),
            }
        )
    )

    assert result["intent"] == "emotion"
    assert result["windowDays"] == 30
    assert result["metric"] == "emotion_calm_score"
    assert result["trendLabel"] == "改善"
    assert result["series"][0]["id"] == "emotion_calm_score"
    assert len(result["labels"]) == 30


def test_parent_trend_service_diet_week_returns_improving():
    result = asyncio.run(
        run_parent_trend_query(
            {
                "question": "这周饮食情况有改善吗？",
                "childId": "child-1",
                "appSnapshot": build_diet_improving_snapshot(),
            }
        )
    )

    assert result["intent"] == "diet"
    assert result["windowDays"] == 7
    assert result["trendLabel"] == "改善"
    assert [series["id"] for series in result["series"]] == ["diet_quality_score", "hydration_ml", "picky_signals"]


def test_parent_trend_service_sleep_two_weeks_returns_fluctuating():
    result = asyncio.run(
        run_parent_trend_query(
            {
                "question": "最近两周睡眠情况稳定吗？",
                "childId": "child-1",
                "appSnapshot": build_sleep_fluctuating_snapshot(),
            }
        )
    )

    assert result["intent"] == "sleep"
    assert result["windowDays"] == 14
    assert result["trendLabel"] == "波动"
    assert result["comparison"]["direction"] in {"flat", "down"}


def test_parent_trend_service_health_week_returns_attention():
    result = asyncio.run(
        run_parent_trend_query(
            {
                "question": "这周健康情况需要注意吗？",
                "childId": "child-1",
                "appSnapshot": build_health_attention_snapshot(),
            }
        )
    )

    assert result["intent"] == "health"
    assert result["windowDays"] == 7
    assert result["trendLabel"] == "需关注"
    assert result["series"][0]["id"] == "health_stability_score"


def test_parent_trend_service_growth_overall_marks_sparse_with_warning():
    result = asyncio.run(
        run_parent_trend_query(
            {
                "question": "最近成长情况怎么样？",
                "childId": "child-1",
                "appSnapshot": build_sparse_growth_snapshot(),
            }
        )
    )

    assert result["intent"] == "growth_overall"
    assert result["dataQuality"]["sparse"] is True
    assert result["warnings"]
    assert result["series"][0]["id"] == "overall_growth_score"


def test_parent_trend_service_demo_snapshot_supports_key_demo_children():
    demo_cases = [
        ("c-8", "最近两周午睡稳定吗？", "sleep"),
        ("c-11", "这周饮食情况有改善吗？", "diet"),
        ("c-15", "这周饮食和补水情况有改善吗？", "diet"),
    ]

    for child_id, question, intent in demo_cases:
        result = asyncio.run(run_parent_trend_query({"question": question, "childId": child_id}))
        assert result["intent"] == intent
        assert result["source"] == "demo_snapshot"
        assert result["fallback"] is True
        assert result["dataQuality"]["fallbackUsed"] is True
        assert result["series"]


def test_parent_trend_service_defaults_to_seven_day_window():
    result = asyncio.run(
        run_parent_trend_query(
            {
                "question": "成长情况怎么样？",
                "childId": "child-1",
                "appSnapshot": build_sparse_growth_snapshot(),
            }
        )
    )

    assert result["windowDays"] == 7
    assert result["query"]["resolvedWindowDays"] == 7
