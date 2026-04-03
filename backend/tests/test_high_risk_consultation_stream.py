from __future__ import annotations

import asyncio
import json

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.db.repositories import reset_repository_bundle_cache
from app.main import app
from app.services.orchestrator import build_memory_service, reset_orchestrator_runtime


client = TestClient(app)


def configure_memory_backend(monkeypatch, *, backend: str, sqlite_path: str | None = None):
    monkeypatch.setenv("BRAIN_MEMORY_BACKEND", backend)
    if sqlite_path is not None:
        monkeypatch.setenv("BRAIN_MEMORY_SQLITE_PATH", sqlite_path)
    else:
        monkeypatch.delenv("BRAIN_MEMORY_SQLITE_PATH", raising=False)

    monkeypatch.delenv("MYSQL_URL", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)

    get_settings.cache_clear()
    reset_repository_bundle_cache()
    reset_orchestrator_runtime()


def parse_sse(text: str) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []
    for chunk in text.split("\n\n"):
        if not chunk.strip():
            continue
        event_name = ""
        data = ""
        for line in chunk.splitlines():
            if line.startswith("event: "):
                event_name = line.removeprefix("event: ").strip()
            elif line.startswith("data: "):
                data = line.removeprefix("data: ").strip()
        if event_name and data:
            events.append({"event": event_name, "data": json.loads(data)})
    return events


def test_high_risk_consultation_stream_uses_memory_and_sse(tmp_path, monkeypatch):
    sqlite_path = tmp_path / "consultation-stream.db"
    configure_memory_backend(monkeypatch, backend="sqlite", sqlite_path=str(sqlite_path))

    memory = build_memory_service()
    asyncio.run(
        memory.upsert_child_profile_memory(
            "child-1",
            {
                "nickname": "小明",
                "temperament": "group transitions need calm reminders",
                "support_strategies": ["visual cue", "short check-in"],
            },
            source="teacher-agent",
        )
    )
    asyncio.run(
        memory.save_consultation_snapshot(
            child_id="child-1",
            session_id="consult-1",
            snapshot_type="consultation-result",
            input_summary="recent consultation",
            snapshot_json={
                "result": {
                    "summary": "watch hydration and separation anxiety again tonight",
                    "todayInSchoolActions": ["record transition behavior"],
                    "tonightAtHomeActions": ["record hydration and bedtime"],
                    "nextCheckpoints": ["review feedback tomorrow morning"],
                    "reviewIn48h": "re-check family feedback and classroom transition",
                }
            },
        )
    )
    asyncio.run(
        memory.save_agent_trace(
            trace_id="trace-seed-1",
            child_id="child-1",
            session_id="consult-1",
            node_name="teacher-agent",
            action_type="teacher-agent",
            input_summary="teacher note about risky transition",
            output_summary="flagged recent unstable transition behavior",
            status="succeeded",
            duration_ms=123,
            metadata_json={"task": "teacher-agent"},
        )
    )

    response = client.post(
        "/api/v1/agents/consultations/high-risk/stream",
        json={
            "targetChildId": "child-1",
            "teacherNote": "today transition looked unstable and family feedback is incomplete",
            "currentUser": {"className": "Sunshine"},
            "visibleChildren": [{"id": "child-1", "name": "小明"}],
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")

    events = parse_sse(response.text)
    assert [item["event"] for item in events[:3]] == ["status", "text", "ui"]

    status_stages = [item["data"]["stage"] for item in events if item["event"] == "status"]
    assert status_stages == ["long_term_profile", "recent_context", "current_recommendation"]

    ui_card_types = [item["data"]["cardType"] for item in events if item["event"] == "ui"]
    assert "ConsultationSummaryCard" in ui_card_types
    assert "FollowUp48hCard" in ui_card_types

    done_event = next(item for item in events if item["event"] == "done")
    done_data = done_event["data"]
    assert done_data["memoryMeta"]["memory_context_used"] is True
    assert "child_profile_memory" in done_data["memoryMeta"]["usedSources"]
    assert "agent_state_snapshots" in done_data["memoryMeta"]["usedSources"]
    assert done_data["providerTrace"]["source"] in {"mock", "vivo"}
    assert "model" in done_data["providerTrace"]
    assert done_data["result"]["traceMeta"]["memory"]["usedSources"]
    assert done_data["result"]["consultationId"]


def test_high_risk_consultation_json_route_supports_sse_accept_header():
    response = client.post(
        "/api/v1/agents/consultations/high-risk",
        headers={"Accept": "text/event-stream"},
        json={
            "targetChildId": "child-1",
            "teacherNote": "need stream",
            "currentUser": {"className": "Sunshine"},
            "visibleChildren": [{"id": "child-1", "name": "小明"}],
        },
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: status" in response.text
    assert "event: done" in response.text
