from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_parent_suggestions():
    response = client.post("/api/v1/agents/parent/suggestions", json={"snapshot": {"child": {"name": "小明"}, "summary": {}}})
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "mock"
    assert "summary" in body


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
