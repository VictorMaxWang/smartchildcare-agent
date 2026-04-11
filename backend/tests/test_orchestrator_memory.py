import asyncio

from app.core.config import get_settings
from app.db.repositories import reset_repository_bundle_cache
from app.services import orchestrator as orchestrator_module
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
                    "reviewIn48h": "re-check family feedback in 48h",
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


def build_parent_trend_snapshot() -> dict:
    return {
        "children": [
            {
                "id": "child-1",
                "name": "Anan",
                "nickname": "Bao",
                "institutionId": "inst-test",
                "className": "Class 1",
            }
        ],
        "attendance": [],
        "meals": [],
        "growth": [
            {
                "id": "growth-1",
                "childId": "child-1",
                "createdAt": "2026-03-10T09:00:00+08:00",
                "category": "social-emotional",
                "tags": ["separation anxiety", "crying"],
                "selectedIndicators": ["daily-observation"],
                "description": "morning drop-off still needs support",
                "needsAttention": True,
                "followUpAction": "continue observation",
            },
            {
                "id": "growth-2",
                "childId": "child-1",
                "createdAt": "2026-04-03T09:00:00+08:00",
                "category": "social-emotional",
                "tags": ["calm", "stable"],
                "selectedIndicators": ["daily-observation"],
                "description": "drop-off became calmer",
                "needsAttention": False,
                "followUpAction": "continue observation",
            },
        ],
        "feedback": [],
        "health": [],
        "taskCheckIns": [],
        "interventionCards": [],
        "consultations": [],
        "mobileDrafts": [],
        "reminders": [],
        "updatedAt": "2026-04-04T00:00:00Z",
    }


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
    assert result["memoryMeta"]["memoryContextUsed"] is True
    assert result["traceMeta"]["memory"]["usedSources"]
    assert result["directorDecisionCard"]["recommendedOwnerName"]
    assert any(item.action_type == "high-risk-consultation" and item.status == "succeeded" for item in traces)
    assert any(
        item.snapshot_type == "consultation-result"
        and item.snapshot_json["result"]["consultationId"] == "consultation-child-1"
        and item.snapshot_json["result"]["traceMeta"]["memory"]["usedSources"]
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


def test_weekly_report_writes_trace_and_snapshot_and_uses_memory(tmp_path, monkeypatch):
    sqlite_path = tmp_path / "weekly-report-memory.db"
    configure_memory_backend(monkeypatch, backend="sqlite", sqlite_path=str(sqlite_path))
    seed_child_memory()

    orchestrator = build_orchestrator()
    result = asyncio.run(
        orchestrator.weekly_report(
            {
                "role": "teacher",
                "snapshot": {
                    "institutionName": "Demo Institution",
                    "periodLabel": "近 7 天",
                    "role": "教师班级周总结",
                },
                "visibleChildren": [{"id": "child-1", "name": "child-one"}],
                "debugMemory": True,
            }
        )
    )

    traces = asyncio.run(orchestrator.memory.get_recent_traces(child_id="child-1", limit=10))
    snapshots = asyncio.run(orchestrator.repositories.list_recent_snapshots(limit=10, child_id="child-1"))

    assert result["schemaVersion"] == "v2-actionized"
    assert result["role"] == "teacher"
    assert result["continuityNotes"]
    assert result["memoryMeta"]["memory_context_used"] is True
    assert any(item.action_type == "weekly-report" and item.status == "succeeded" for item in traces)
    assert any(item.snapshot_type == "weekly-report-result" for item in snapshots)
    assert any(
        item.node_name == "weekly-report" and item.metadata_json.get("memory_context_used") is True
        for item in traces
    )


def test_parent_trend_query_writes_trace_and_snapshot_and_uses_memory(tmp_path, monkeypatch):
    sqlite_path = tmp_path / "parent-trend-memory.db"
    configure_memory_backend(monkeypatch, backend="sqlite", sqlite_path=str(sqlite_path))
    seed_child_memory()

    orchestrator = build_orchestrator()
    result = asyncio.run(
        orchestrator.parent_trend_query(
            {
                "question": "Did separation anxiety ease in the last month?",
                "childId": "child-1",
                "appSnapshot": build_parent_trend_snapshot(),
                "debugMemory": True,
            }
        )
    )

    traces = asyncio.run(orchestrator.memory.get_recent_traces(child_id="child-1", limit=10))
    snapshots = asyncio.run(orchestrator.repositories.list_recent_snapshots(limit=10, child_id="child-1"))

    assert result["intent"]
    assert result["memoryMeta"]["memory_context_used"] is True
    assert any(signal["sourceType"] == "memory" for signal in result["supportingSignals"])
    assert any(item.action_type == "parent-trend-query" and item.status == "succeeded" for item in traces)
    assert any(item.snapshot_type == "parent-trend-result" for item in snapshots)
    assert any(
        item.node_name == "parent-trend-query"
        and item.metadata_json.get("memory_context_used") is True
        for item in traces
    )


def test_parent_message_reflexion_writes_trace_and_snapshot_and_uses_memory(tmp_path, monkeypatch):
    sqlite_path = tmp_path / "parent-message-memory.db"
    configure_memory_backend(monkeypatch, backend="sqlite", sqlite_path=str(sqlite_path))
    seed_child_memory()

    orchestrator = build_orchestrator()
    result = asyncio.run(
        orchestrator.parent_message_reflexion(
            {
                "targetChildId": "child-1",
                "teacherNote": "drop-off still needs support before nap",
                "issueSummary": "drop-off has emotional swings and needs more accompaniment",
                "currentInterventionCard": {
                    "summary": "reduce communication pressure first and observe tonight",
                    "tonightHomeAction": "keep a stable bedtime rhythm and note how long calming takes",
                    "reviewIn48h": "send feedback tomorrow morning and review within 48 hours",
                },
                "visibleChildren": [{"id": "child-1", "name": "child-one"}],
                "debugMemory": True,
                "debugLoop": True,
            }
        )
    )

    traces = asyncio.run(orchestrator.memory.get_recent_traces(child_id="child-1", limit=20))
    snapshots = asyncio.run(orchestrator.repositories.list_recent_snapshots(limit=20, child_id="child-1"))

    assert result["evaluationMeta"]["memoryContextUsed"] is True
    assert result["memoryMeta"]["memory_context_used"] is True
    assert any(item.action_type == "parent-message-reflexion" and item.status == "succeeded" for item in traces)
    assert any(item.node_name == "parent-message-generator" for item in traces)
    assert any(item.node_name == "parent-message-evaluator" for item in traces)
    assert any(item.snapshot_type == "parent-message-reflexion-result" for item in snapshots)
    assert any(
        item.node_name == "parent-message-reflexion"
        and item.metadata_json.get("memory_context_used") is True
        for item in traces
    )


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


def test_parent_storybook_skips_request_thread_memory_and_background_persistence(monkeypatch):
    configure_memory_backend(monkeypatch, backend="memory")
    orchestrator = build_orchestrator()
    release_persistence = asyncio.Event()
    trace_calls: list[dict] = []
    snapshot_calls: list[dict] = []

    async def fail_memory_hydrate(*args, **kwargs):
        del args, kwargs
        raise AssertionError("parent-storybook should skip request-thread memory hydration")

    async def blocked_save_agent_trace(**kwargs):
        trace_calls.append(kwargs)
        await release_persistence.wait()

    async def blocked_save_snapshot(**kwargs):
        snapshot_calls.append(kwargs)
        await release_persistence.wait()

    async def stub_run_parent_storybook(payload: dict) -> dict:
        return {
            "storyId": "storybook-parent-storybook-hotfix",
            "childId": "c-1",
            "mode": "storybook",
            "title": "Story title",
            "summary": "Story summary",
            "moral": "Story moral",
            "parentNote": "Story parent note",
            "source": "rule",
            "fallback": True,
            "generatedAt": "2026-04-11T00:00:00Z",
            "providerMeta": {
                "provider": "parent-storybook-rule",
                "mode": "fallback",
                "transport": "fastapi-brain",
                "imageProvider": "storybook-dynamic-fallback",
                "audioProvider": "storybook-mock-preview",
                "requestSource": payload.get("requestSource", "parent-storybook"),
                "highlightCount": 4,
                "sceneCount": 6,
            },
            "scenes": [],
        }

    monkeypatch.setattr(
        orchestrator.memory,
        "build_memory_context_for_prompt",
        fail_memory_hydrate,
    )
    monkeypatch.setattr(orchestrator.memory, "save_agent_trace", blocked_save_agent_trace)
    monkeypatch.setattr(
        orchestrator.memory,
        "save_consultation_snapshot",
        blocked_save_snapshot,
    )
    monkeypatch.setattr(
        "app.services.orchestrator.run_parent_storybook",
        stub_run_parent_storybook,
    )

    payload = {
        "childId": "c-1",
        "requestSource": "pytest-parent-storybook",
        "debugMemory": True,
        "snapshot": {
            "child": {
                "id": "c-1",
                "name": "Lin Xiaoyu",
                "className": "Sunrise Class",
            }
        },
        "highlightCandidates": [],
    }

    async def run_case() -> dict:
        result = await asyncio.wait_for(orchestrator.parent_storybook(payload), timeout=0.2)
        assert result["memoryMeta"]["memory_context_used"] is False
        assert result["memoryMeta"]["memory_context_count"] == 0
        assert result["memoryMeta"]["memory_context_skipped_reason"] == "parent-storybook-request-thread-sla"
        await asyncio.sleep(0)
        assert len(trace_calls) == 1
        assert len(snapshot_calls) == 1
        assert trace_calls[0]["metadata_json"]["memory_context_used"] is False
        assert (
            trace_calls[0]["metadata_json"]["memory_context_skipped_reason"]
            == "parent-storybook-request-thread-sla"
        )
        release_persistence.set()
        pending = list(orchestrator_module._BACKGROUND_TASKS)
        if pending:
            await asyncio.gather(*pending)
        return result

    result = asyncio.run(run_case())

    assert result["providerMeta"]["transport"] == "fastapi-brain"
