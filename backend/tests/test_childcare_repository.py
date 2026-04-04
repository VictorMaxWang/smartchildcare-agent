from __future__ import annotations

import asyncio

from app.db.childcare_repository import ChildcareRepository


def build_app_snapshot() -> dict:
    return {
        "children": [
            {
                "id": "c-11",
                "name": "周诗雨",
                "nickname": "诗诗",
                "institutionId": "inst-test",
                "className": "向日葵班",
            }
        ],
        "attendance": [],
        "meals": [
            {
                "id": "meal-1",
                "childId": "c-11",
                "date": "2026-04-03",
                "meal": "lunch",
                "foods": ["米饭", "青菜", "鸡肉"],
                "intakeLevel": "low",
                "preference": "dislike",
                "waterMl": 120,
                "nutritionScore": 66,
                "aiEvaluation": {"summary": "只吃鸡肉，青菜未动。"},
            }
        ],
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


def test_childcare_repository_request_snapshot_supports_real_request_scoped_writes():
    repository = asyncio.run(
        ChildcareRepository.create(app_snapshot=build_app_snapshot(), institution_id=None, database_url=None)
    )

    observation_result = asyncio.run(
        repository.insert_observation(
            child_id="c-11",
            observation_type="diet_follow_up",
            content="午餐继续回避蔬菜，需要老师跟进。",
            metadata={"tags": ["饮食", "偏食"], "category": "daily-observation"},
        )
    )
    draft_result = asyncio.run(
        repository.write_draft_record(
            child_id="c-11",
            draft_type="observation",
            target_role="teacher",
            content="近 7 天饮食需持续跟进。",
            structured_payload={"trendDetected": True},
        )
    )

    assert repository.source == "request_snapshot"
    assert observation_result["record"]["description"] == "午餐继续回避蔬菜，需要老师跟进。"
    assert observation_result["persisted"] is False
    assert repository.snapshot["growth"][0]["childId"] == "c-11"
    assert draft_result["record"]["content"] == "近 7 天饮食需持续跟进。"
    assert draft_result["persisted"] is False
    assert repository.snapshot["mobileDrafts"][0]["childId"] == "c-11"
