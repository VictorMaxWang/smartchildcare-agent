from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_teacher_voice_understand_transcript_only():
    response = client.post(
        "/api/v1/agents/teacher/voice-understand",
        json={
            "transcript": "小明今天体温37.6度，需要继续观察。",
            "childId": "c1",
            "childName": "小明",
            "scene": "teacher-global-fab",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["transcript"]["source"] == "provided_transcript"
    assert body["router_result"]["primary_category"] == "HEALTH"
    assert body["draft_items"][0]["category"] == "HEALTH"
    assert body["draft_items"][0]["child_ref"] == "c1"
    assert "generated_at" in body
    assert body["source"]["router"] == "rule"


def test_teacher_voice_understand_multipart_uses_mock_asr():
    response = client.post(
        "/api/v1/agents/teacher/voice-understand",
        files={"audio": ("voice.webm", b"mock-audio-bytes", "audio/webm")},
        data={
            "childId": "c1",
            "childName": "小明",
            "scene": "teacher-global-fab",
            "durationMs": "12000",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["transcript"]["source"] == "mock"
    assert body["trace"]["input_mode"] == "multipart"
    assert body["meta"]["attachment_name"] == "voice.webm"
    assert body["meta"]["asr"]["provider"] == "mock-asr"


def test_teacher_voice_understand_mixed_transcript_splits_tasks_and_draft_items():
    response = client.post(
        "/api/v1/agents/teacher/voice-understand",
        json={
            "transcript": "小明今天午睡前哭闹。体温37.6度，需要继续观察。下午请假回家。",
            "childId": "c1",
            "childName": "小明",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["router_result"]["primary_category"] == "MIXED"
    assert body["router_result"]["is_multi_event"] is True
    categories = [item["category"] for item in body["draft_items"]]
    assert "EMOTION" in categories
    assert "HEALTH" in categories
    assert "LEAVE" in categories


def test_teacher_voice_understand_bad_request_returns_400():
    response = client.post("/api/v1/agents/teacher/voice-understand", json={"childId": "c1"})
    assert response.status_code == 400
