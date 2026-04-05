import asyncio

from app.services.evaluator_optimizer import EvaluationStepResult, GeneratorStepResult
from app.services.parent_message_reflexion import ParentMessageReflexionService


def build_payload() -> dict:
    return {
        "targetChildId": "child-1",
        "teacherNote": "今天入园时有点黏老师，午睡前需要更多安抚。",
        "issueSummary": "入园分离时情绪波动，午睡前需要更多陪伴。",
        "currentInterventionCard": {
            "summary": "先降低沟通压力，再观察今晚情绪和入睡情况。",
            "tonightHomeAction": "睡前先保持固定节奏，再观察孩子安静下来需要多久。",
            "reviewIn48h": "请在明早入园前反馈，48 小时内一起复盘。",
        },
        "visibleChildren": [{"id": "child-1", "name": "安安"}],
        "debugLoop": True,
    }


def test_parent_message_reflexion_passes_on_first_iteration():
    service = ParentMessageReflexionService()

    result = asyncio.run(service.run(build_payload()))
    body = result.model_dump(mode="json", by_alias=True)

    assert body["evaluationMeta"]["stopReason"] == "passed"
    assert body["evaluationMeta"]["canSend"] is True
    assert body["revisionCount"] == 0
    assert body["finalOutput"]["title"]
    assert body["finalOutput"]["tonightActions"]
    assert body["source"] == "mock"
    assert body["fallback"] is False


def test_parent_message_reflexion_retries_once_then_passes(monkeypatch):
    service = ParentMessageReflexionService()
    call_count = {"value": 0}

    async def fake_evaluate_candidate(draft, context, iteration):
        call_count["value"] += 1
        if call_count["value"] == 1:
            return EvaluationStepResult(
                score=6.5,
                problems=["语气还可以更温和。"],
                revision_suggestions=["把开头改得更低焦虑一点。"],
                can_send=False,
                retryable=True,
                decision="revise",
                fallback=False,
                provider="local-rule",
                model="local-rule-v1",
            )
        return EvaluationStepResult(
            score=8.8,
            problems=[],
            revision_suggestions=[],
            can_send=True,
            retryable=True,
            decision="approve",
            fallback=False,
            provider="local-rule",
            model="local-rule-v1",
        )

    monkeypatch.setattr(service, "_evaluate_candidate", fake_evaluate_candidate)

    result = asyncio.run(service.run(build_payload()))
    body = result.model_dump(mode="json", by_alias=True)

    assert body["evaluationMeta"]["stopReason"] == "passed"
    assert body["evaluationMeta"]["approvedIteration"] == 2
    assert body["revisionCount"] == 1
    assert body["evaluationMeta"]["iterationScores"] == [6.5, 8.8]


def test_parent_message_reflexion_returns_best_draft_after_max_iterations(monkeypatch):
    service = ParentMessageReflexionService()
    payload = build_payload()
    payload["debugLoop"] = False

    async def fake_generate_candidate(context, revision_instructions, iteration):
        draft = {
            "title": f"{context.child_name} 今晚沟通建议 {iteration}",
            "summary": f"第 {iteration} 轮摘要",
            "tonight_actions": [f"动作 {iteration}"],
            "wording_for_parent": f"第 {iteration} 轮发给家长的话术。",
            "why_this_matters": "这样能帮助老师继续观察。",
            "estimated_time": "5-10 分钟",
            "follow_up_window": context.follow_up_window,
        }
        return GeneratorStepResult(
            draft=draft,
            source="mock",
            model="local-parent-message-v1",
            provider="local-generator",
            fallback=False,
        )

    async def fake_evaluate_candidate(draft, context, iteration):
        return EvaluationStepResult(
            score=7.0 + (iteration * 0.1),
            problems=[f"问题 {iteration}"],
            revision_suggestions=[f"建议 {iteration}"],
            can_send=False,
            retryable=True,
            decision="revise",
            fallback=False,
            provider="local-rule",
            model="local-rule-v1",
        )

    monkeypatch.setattr(service, "_generate_candidate", fake_generate_candidate)
    monkeypatch.setattr(service, "_evaluate_candidate", fake_evaluate_candidate)

    result = asyncio.run(service.run(payload))
    body = result.model_dump(mode="json", by_alias=True)

    assert body["evaluationMeta"]["stopReason"] == "max_iterations"
    assert body["evaluationMeta"]["canSend"] is False
    assert body["revisionCount"] == 2
    assert body["finalOutput"]["summary"] == "第 3 轮摘要"
