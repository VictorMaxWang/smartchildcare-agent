from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_parent_suggestions():
    response = client.post("/api/v1/agents/parent/suggestions", json={"snapshot": {"child": {"name": "小明"}, "summary": {}}})
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "mock"
    assert "summary" in body


def test_parent_trend_query():
    response = client.post(
        "/api/v1/agents/parent/trend-query",
        json={
            "question": "这周饮食情况有改善吗？",
            "childId": "child-1",
            "appSnapshot": {
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
                "meals": [
                    {
                        "id": "meal-1",
                        "childId": "child-1",
                        "date": "2026-04-04",
                        "meal": "lunch",
                        "foods": ["rice", "vegetable", "protein"],
                        "intakeLevel": "good",
                        "preference": "accept",
                        "waterMl": 170,
                        "nutritionScore": 84,
                        "aiEvaluation": {"summary": "当日饮食完成度较好。"},
                    },
                    {
                        "id": "meal-2",
                        "childId": "child-1",
                        "date": "2026-04-03",
                        "meal": "lunch",
                        "foods": ["rice", "vegetable", "protein"],
                        "intakeLevel": "medium",
                        "preference": "neutral",
                        "waterMl": 140,
                        "nutritionScore": 76,
                        "aiEvaluation": {"summary": "进餐比前几天更稳定。"},
                    },
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
            },
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "diet"
    assert body["metric"] == "diet_quality_score"
    assert body["series"]
    assert "comparison" in body
    assert "dataQuality" in body


def test_parent_trend_query_demo_snapshot_fallback_honesty():
    response = client.post(
        "/api/v1/agents/parent/trend-query",
        json={
            "question": "最近两周睡眠情况稳定吗？",
            "childId": "c-11",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "demo_snapshot"
    assert body["fallback"] is True
    assert body["dataQuality"]["fallbackUsed"] is True
    assert body["dataQuality"]["observedDays"] == 0
    assert body["dataQuality"]["coverageRatio"] == 0
    assert body["dataQuality"]["sparse"] is True
    assert body["comparison"]["direction"] == "insufficient"
    assert body["trendLabel"] != "改善"
    assert body["warnings"]


def test_teacher_run():
    response = client.post(
        "/api/v1/agents/teacher/run",
        json={"workflow": "follow-up", "scope": "child", "targetChildId": "c1", "visibleChildren": [{"id": "c1", "name": "小明"}]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["workflow"] == "follow-up"
    assert body["source"] == "mock"
    assert "interventionCard" in body


def test_admin_run():
    response = client.post("/api/v1/agents/admin/run", json={"workflow": "daily-priority", "visibleChildren": [{"id": "c1"}]})
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "mock"
    assert body["priorityTopItems"]


def test_weekly_report():
    response = client.post("/api/v1/agents/reports/weekly", json={"snapshot": {"institutionName": "示例机构"}})
    assert response.status_code == 200
    assert response.json()["source"] == "mock"


def test_high_risk_consultation():
    response = client.post(
        "/api/v1/agents/consultations/high-risk",
        json={"targetChildId": "c1", "currentUser": {}, "visibleChildren": [{"id": "c1", "name": "小明"}]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["source"] in {"mock", "vivo"}
    assert "consultationId" in body
    assert "interventionCard" in body
    assert "providerTrace" in body
    assert "model" in body
    assert isinstance(body["realProvider"], bool)
    assert isinstance(body["fallback"], bool)


def test_multimodal_endpoints():
    vision = client.post("/api/v1/multimodal/vision-meal", json={"imageDataUrl": "data:image/png;base64,abc"})
    assert vision.status_code == 200
    assert vision.json()["source"] == "mock"

    diet = client.post("/api/v1/multimodal/diet-evaluation", json={"input": {"mealFoods": []}})
    assert diet.status_code == 200
    assert diet.json()["source"] == "mock"
