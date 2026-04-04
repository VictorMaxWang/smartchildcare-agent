from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.providers.base import AsrProviderInput, AsrSegment, AsrTranscription, ProviderResult
import app.services.teacher_voice_understand as teacher_voice_understand


client = TestClient(app)


class StubAsrProvider:
    def __init__(self, result: ProviderResult[AsrTranscription]):
        self.result = result
        self.last_input: AsrProviderInput | None = None

    def transcribe(self, input: AsrProviderInput) -> ProviderResult[AsrTranscription]:
        self.last_input = input
        return self.result


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


def test_teacher_voice_understand_multipart_passes_through_real_vivo_provider(monkeypatch):
    stub_provider = StubAsrProvider(
        ProviderResult(
            provider="vivo-asr",
            mode="real",
            source="vivo",
            model="fileasrrecorder",
            request_id="req-asr-123",
            output=AsrTranscription(
                transcript="小明今天体温37.6度，需要继续观察。",
                confidence=None,
                segments=[AsrSegment(text="小明今天体温37.6度，需要继续观察。", start_ms=0, end_ms=1200)],
                meta={"transport": "vivo-lasr-http", "task_id": "task-1"},
                raw={"transport": "vivo-lasr-http", "stages": {"result": {"sid": "sid-result"}}},
                fallback=False,
            ),
        )
    )
    monkeypatch.setattr(teacher_voice_understand, "resolve_asr_provider", lambda *args, **kwargs: stub_provider)

    response = client.post(
        "/api/v1/agents/teacher/voice-understand",
        files={"audio": ("voice.wav", b"real-audio-bytes", "audio/wav")},
        data={
            "childId": "c1",
            "childName": "小明",
            "scene": "teacher-global-fab",
            "durationMs": "1200",
        },
    )

    assert response.status_code == 200
    assert stub_provider.last_input is not None
    assert stub_provider.last_input.audio_bytes == b"real-audio-bytes"
    assert stub_provider.last_input.attachment_name == "voice.wav"
    assert stub_provider.last_input.mime_type == "audio/wav"
    assert stub_provider.last_input.duration_ms == 1200

    body = response.json()
    assert body["transcript"]["text"] == "小明今天体温37.6度，需要继续观察。"
    assert body["transcript"]["source"] == "vivo"
    assert body["transcript"]["provider"] == "vivo-asr"
    assert body["transcript"]["mode"] == "real"
    assert body["transcript"]["fallback"] is False
    assert body["transcript"]["raw"]["transport"] == "vivo-lasr-http"
    assert body["meta"]["asr"]["provider"] == "vivo-asr"
    assert body["meta"]["asr"]["mode"] == "real"
    assert body["meta"]["asr"]["raw"]["transport"] == "vivo-lasr-http"
    assert body["trace"]["input_mode"] == "multipart"
    assert body["trace"]["fallback"] is False


def test_teacher_voice_understand_multipart_passes_through_fallback_provider(monkeypatch):
    stub_provider = StubAsrProvider(
        ProviderResult(
            provider="vivo-asr",
            mode="mock",
            source="mock",
            model="fileasrrecorder",
            request_id="req-asr-fallback",
            output=AsrTranscription(
                transcript="voice.wav 转写结果：小朋友今天午睡前情绪波动。",
                confidence=0.62,
                meta={"reason": "timeout", "stage": "create", "transport": "vivo-lasr-http"},
                raw={"path": "vivo-asr-fallback", "stage": "create"},
                fallback=True,
            ),
        )
    )
    monkeypatch.setattr(teacher_voice_understand, "resolve_asr_provider", lambda *args, **kwargs: stub_provider)

    response = client.post(
        "/api/v1/agents/teacher/voice-understand",
        files={"audio": ("voice.wav", b"fallback-audio-bytes", "audio/wav")},
        data={
            "childId": "c1",
            "childName": "小明",
            "scene": "teacher-global-fab",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["transcript"]["source"] == "mock"
    assert body["transcript"]["provider"] == "vivo-asr"
    assert body["transcript"]["mode"] == "mock"
    assert body["transcript"]["fallback"] is True
    assert body["meta"]["asr"]["provider"] == "vivo-asr"
    assert body["meta"]["asr"]["mode"] == "mock"
    assert body["meta"]["asr"]["meta"]["reason"] == "timeout"
    assert body["meta"]["asr"]["raw"]["stage"] == "create"
    assert body["trace"]["input_mode"] == "multipart"
    assert body["trace"]["fallback"] is True


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
