from fastapi.testclient import TestClient
import pytest

from app.main import app


client = TestClient(app)


@pytest.mark.parametrize(
    ("payload", "expected_role", "expected_intent", "expected_workflow", "expected_page", "expected_kind"),
    [
        (
            {"message": "请帮我记录观察并跟进", "roleHint": "teacher", "childId": "c-1"},
            "teacher",
            "record_observation",
            "teacher.react.run",
            "/teacher/agent",
            "teacher-react-run",
        ),
        (
            {"message": "给家长发一条沟通草稿", "roleHint": "teacher", "childId": "c-2"},
            "teacher",
            "generate_parent_draft",
            "teacher.agent.communication",
            "/teacher/agent",
            "teacher-agent-run",
        ),
        (
            {"message": "这个孩子需要高风险会诊", "roleHint": "teacher", "childId": "c-3"},
            "teacher",
            "start_consultation",
            "teacher.consultation.high-risk",
            "/teacher/high-risk-consultation",
            "teacher-consultation-run",
        ),
        (
            {"message": "帮我出本周观察周报", "sourcePage": "/teacher/agent"},
            "teacher",
            "ask_weekly_report",
            "teacher.agent.weekly-summary",
            "/teacher/agent",
            "teacher-agent-run",
        ),
        (
            {"message": "最近一周饮食趋势怎么样", "roleHint": "parent", "childId": "c-4"},
            "parent",
            "query_trend",
            "parent.trend.query",
            "/parent/agent",
            "parent-trend-query",
        ),
        (
            {"message": "今晚家庭行动我该做什么", "roleHint": "parent", "childId": "c-5"},
            "parent",
            "view_tonight_action",
            "parent.agent.suggestions",
            "/parent/agent",
            "parent-agent-run",
        ),
        (
            {"message": "打开今晚的睡前故事绘本", "childId": "c-6"},
            "parent",
            "ask_storybook",
            "parent.storybook",
            "/parent/storybook",
            "parent-storybook-run",
        ),
        (
            {"message": "今天机构优先级 top 3 是什么", "roleHint": "admin"},
            "admin",
            "view_priority",
            "admin.agent.daily-priority",
            "/admin/agent",
            "admin-agent-run",
        ),
        (
            {"message": "生成本周运营周报", "roleHint": "admin"},
            "admin",
            "ask_weekly_report",
            "admin.agent.weekly-ops-report",
            "/admin/agent",
            "admin-agent-run",
        ),
    ],
)
def test_intent_router_endpoint_routes_supported_intents(
    payload,
    expected_role,
    expected_intent,
    expected_workflow,
    expected_page,
    expected_kind,
):
    response = client.post("/api/v1/agents/intent-router", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["detectedRole"] == expected_role
    assert body["intent"] == expected_intent
    assert body["targetWorkflow"] == expected_workflow
    assert body["targetPage"] == expected_page
    assert body["deeplink"].startswith(expected_page)
    assert body["previewCard"]["title"]
    assert body["optionalPayload"]["kind"] == expected_kind


def test_intent_router_endpoint_honors_role_hint_on_conflict():
    response = client.post(
        "/api/v1/agents/intent-router",
        json={
            "message": "打开今晚的睡前故事绘本",
            "roleHint": "teacher",
            "childId": "c-8",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["detectedRole"] == "teacher"
    assert body["intent"] == "unknown"
    assert body["targetWorkflow"] == ""
    assert body["optionalPayload"] is None


def test_intent_router_endpoint_returns_unknown_fallback():
    response = client.post(
        "/api/v1/agents/intent-router",
        json={"message": "随便聊聊今天怎么样"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["detectedRole"] == "unknown"
    assert body["intent"] == "unknown"
    assert body["targetPage"] == "/"
    assert body["deeplink"] == "/"
    assert body["optionalPayload"] is None
    assert "unknown-intent" in body["previewCard"]["badges"]
