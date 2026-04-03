import asyncio

from app.core.config import get_settings
from app.db.repositories import reset_repository_bundle_cache
from app.services.orchestrator import build_memory_service, build_orchestrator, reset_orchestrator_runtime


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


def seed_child_memory():
    memory = build_memory_service()
    asyncio.run(
        memory.upsert_child_profile_memory(
            "child-1",
            {
                "nickname": "child-one",
                "temperament": "needs calm transitions before joining group play",
                "support_strategies": ["quiet company first", "then remind hydration"],
            },
            source="teacher-agent",
        )
    )
    asyncio.run(
        memory.save_consultation_snapshot(
            child_id="child-1",
            session_id="consult-1",
            snapshot_type="consultation-result",
            input_summary="high risk consultation",
            snapshot_json={
                "result": {
                    "summary": "last consultation asked to keep watching hydration tonight",
                    "todayInSchoolActions": ["observe mood again before nap"],
                    "tonightAtHomeActions": ["record hydration tonight"],
                    "nextCheckpoints": ["check feedback tomorrow morning"],
                }
            },
        )
    )
    asyncio.run(
        memory.save_agent_trace(
            trace_id="trace-memory-1",
            child_id="child-1",
            session_id="consult-1",
            node_name="teacher-agent",
            action_type="teacher-agent",
            input_summary="teacher follow-up",
            output_summary="night feedback is still the open loop",
            status="succeeded",
            duration_ms=12,
            metadata_json={"workflow": "teacher-agent"},
        )
    )


def test_high_risk_consultation_writes_trace_and_snapshot_and_uses_memory(tmp_path, monkeypatch):
    sqlite_path = tmp_path / "orchestrator-memory.db"
    configure_memory_backend(monkeypatch, backend="sqlite", sqlite_path=str(sqlite_path))
    seed_child_memory()

    orchestrator = build_orchestrator()
    payload = {
        "targetChildId": "child-1",
        "currentUser": {"className": "Class A"},
        "visibleChildren": [{"id": "child-1", "name": "child-one"}],
        "presentChildren": [{"id": "child-1", "name": "child-one"}],
        "healthCheckRecords": [],
        "growthRecords": [],
        "guardianFeedbacks": [],
        "debugMemory": True,
    }

    result = asyncio.run(orchestrator.high_risk_consultation(payload))
    traces = asyncio.run(orchestrator.memory.get_recent_traces(child_id="child-1", limit=10))
    snapshots = asyncio.run(orchestrator.repositories.list_recent_snapshots(limit=10))

    assert result["consultationId"] == "consultation-child-1"
    assert result["continuityNotes"]
    assert result["memoryMeta"]["memory_context_used"] is True
    assert any(item.action_type == "high-risk-consultation" and item.status == "succeeded" for item in traces)
    assert any(
        item.snapshot_type == "consultation-result"
        and item.snapshot_json["result"]["consultationId"] == "consultation-child-1"
        for item in snapshots
    )
    assert any(
        item.node_name == "high-risk-consultation"
        and item.metadata_json.get("memory_context_used") is True
        for item in traces
    )


def test_teacher_workflow_result_contains_memory_continuity(tmp_path, monkeypatch):
    sqlite_path = tmp_path / "teacher-memory.db"
    configure_memory_backend(monkeypatch, backend="sqlite", sqlite_path=str(sqlite_path))
    seed_child_memory()

    orchestrator = build_orchestrator()
    result = asyncio.run(
        orchestrator.teacher_run(
            {
                "workflow": "follow-up",
                "scope": "child",
                "targetChildId": "child-1",
                "visibleChildren": [{"id": "child-1", "name": "child-one"}],
                "debugMemory": True,
            }
        )
    )

    assert result["workflow"] == "follow-up"
    assert result["source"] == "mock"
    assert result["continuityNotes"]
    assert result["memoryMeta"]["memory_context_used"] is True


def test_memory_service_remember_persists_session_message(monkeypatch):
    configure_memory_backend(monkeypatch, backend="memory")

    orchestrator = build_orchestrator()

    asyncio.run(
        orchestrator.memory.remember(
            "session-remember",
            {"role": "teacher", "content": "guardian still needs to send the evening follow-up"},
        )
    )

    snapshots = asyncio.run(orchestrator.repositories.list_recent_snapshots(limit=10))

    assert any(
        item.session_id == "session-remember"
        and item.snapshot_type == "session-message"
        and item.snapshot_json["message"]["content"] == "guardian still needs to send the evening follow-up"
        for item in snapshots
    )
