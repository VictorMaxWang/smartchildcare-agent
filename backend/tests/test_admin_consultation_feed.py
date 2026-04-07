from __future__ import annotations

import asyncio

from app.core.config import get_settings
from app.db.repositories import reset_repository_bundle_cache
from app.providers.mock import build_mock_high_risk_bundle
from app.services.high_risk_consultation_contract import normalize_high_risk_consultation_result
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


def build_consultation_result(
    *,
    child_id: str,
    child_name: str,
    generated_at: str,
    risk_level: str,
    should_escalate: bool,
    owner_role: str,
    owner_name: str,
    status: str,
    trigger_reason: str,
) -> tuple[dict, dict]:
    payload = {
        "targetChildId": child_id,
        "currentUser": {"className": "Sunshine"},
        "visibleChildren": [{"id": child_id, "name": child_name}],
        "presentChildren": [{"id": child_id, "name": child_name}],
        "healthCheckRecords": [],
        "growthRecords": [],
        "guardianFeedbacks": [],
        "debugMemory": True,
        "_memory_trace_meta": {
            "memory_context_used": True,
            "memory_context_count": 1,
            "memory_context_backend": "sqlite",
            "memory_context_degraded": False,
            "memory_used_sources": ["agent_state_snapshots", "agent_trace_log"],
        },
    }
    raw = build_mock_high_risk_bundle(payload)
    raw["generatedAt"] = generated_at
    raw["riskLevel"] = risk_level
    raw["summary"] = f"summary for {child_name}"
    raw["triggerReason"] = trigger_reason
    raw["triggerReasons"] = [trigger_reason, f"follow-up signal for {child_name}"]
    raw["shouldEscalateToAdmin"] = should_escalate
    raw["coordinatorSummary"] = {
        **raw["coordinatorSummary"],
        "finalConclusion": f"coordination conclusion for {child_name}",
        "riskLevel": risk_level,
        "problemDefinition": f"problem definition for {child_name}",
        "reviewIn48h": f"review {child_name} in 48 hours",
        "shouldEscalateToAdmin": should_escalate,
    }
    raw["directorDecisionCard"] = {
        **raw["directorDecisionCard"],
        "recommendedOwnerRole": owner_role,
        "recommendedOwnerName": owner_name,
        "recommendedAt": generated_at,
        "status": status,
    }
    raw["providerTrace"] = {
        **raw["providerTrace"],
        "provider": "mock-brain",
        "source": "mock",
        "model": "mock-high-risk-v1",
        "requestId": f"req-{child_id}",
        "transport": "fastapi-brain",
        "transportSource": "fastapi-brain",
        "consultationSource": "mock",
        "fallbackReason": "mock-provider",
        "brainProvider": "mock",
        "realProvider": False,
        "fallback": True,
    }

    normalized = normalize_high_risk_consultation_result(
        raw,
        payload=payload,
        brain_provider="mock",
        default_transport="fastapi-brain",
        default_transport_source="fastapi-brain",
        default_consultation_source="mock",
        default_fallback_reason="mock-provider",
    )
    return payload, normalized


def seed_feed_snapshots():
    memory = build_memory_service()

    _, result_one = build_consultation_result(
        child_id="child-1",
        child_name="Xiaoming",
        generated_at="2026-04-07T12:00:00+08:00",
        risk_level="high",
        should_escalate=True,
        owner_role="admin",
        owner_name="Director Wang",
        status="pending",
        trigger_reason="urgent family loop is still open",
    )
    _, result_two = build_consultation_result(
        child_id="child-2",
        child_name="Xiaohong",
        generated_at="2026-04-06T18:00:00+08:00",
        risk_level="medium",
        should_escalate=False,
        owner_role="teacher",
        owner_name="Class Teacher Li",
        status="completed",
        trigger_reason="follow-up is already stabilizing",
    )

    asyncio.run(
        memory.save_consultation_snapshot(
            child_id="child-1",
            session_id=result_one["consultationId"],
            snapshot_type="consultation-result",
            input_summary="feed item one",
            snapshot_json={
                "task": "high-risk-consultation",
                "traceId": "trace-feed-1",
                "result": result_one,
            },
        )
    )
    asyncio.run(
        memory.save_consultation_snapshot(
            child_id="child-2",
            session_id=result_two["consultationId"],
            snapshot_type="consultation-result",
            input_summary="feed item two",
            snapshot_json={
                "task": "high-risk-consultation",
                "traceId": "trace-feed-2",
                "result": result_two,
            },
        )
    )
    asyncio.run(
        memory.save_consultation_snapshot(
            child_id="child-invalid",
            session_id="consultation-invalid",
            snapshot_type="consultation-result",
            input_summary="invalid feed item",
            snapshot_json={"result": {"consultationId": "consultation-invalid"}},
        )
    )
    asyncio.run(
        memory.save_agent_trace(
            trace_id="trace-feed-1",
            child_id="child-1",
            session_id=result_one["consultationId"],
            node_name="high-risk-consultation",
            action_type="high-risk-consultation",
            input_summary="feed trace one",
            output_summary="provider/source trace enrichment",
            status="succeeded",
            duration_ms=18,
            metadata_json={
                "task": "high-risk-consultation",
                "source": "mock",
                "transport": "fastapi-brain",
                "transportSource": "fastapi-brain",
                "brainProvider": "mock",
            },
        )
    )
    asyncio.run(
        memory.save_agent_trace(
            trace_id="trace-feed-2",
            child_id="child-2",
            session_id=result_two["consultationId"],
            node_name="high-risk-consultation",
            action_type="high-risk-consultation",
            input_summary="feed trace two",
            output_summary="provider/source trace enrichment",
            status="succeeded",
            duration_ms=16,
            metadata_json={
                "task": "high-risk-consultation",
                "source": "mock",
                "transport": "fastapi-brain",
                "transportSource": "fastapi-brain",
                "brainProvider": "mock",
            },
        )
    )


def test_admin_consultation_feed_reads_snapshots_and_skips_invalid(tmp_path, monkeypatch):
    sqlite_path = tmp_path / "admin-feed.db"
    configure_memory_backend(monkeypatch, backend="sqlite", sqlite_path=str(sqlite_path))
    seed_feed_snapshots()

    orchestrator = build_orchestrator()
    feed = asyncio.run(orchestrator.high_risk_consultation_feed(limit=10))

    assert feed["count"] == 2
    assert [item["consultationId"] for item in feed["items"]] == [
        "consultation-child-1",
        "consultation-child-2",
    ]

    first_item = feed["items"][0]
    assert first_item["riskLevel"] == "high"
    assert first_item["status"] == "pending"
    assert first_item["ownerName"] == "Director Wang"
    assert first_item["directorDecisionCard"]["recommendedOwnerRole"] == "admin"
    assert first_item["explainabilitySummary"]["agentParticipants"]
    assert first_item["explainabilitySummary"]["coordinationConclusion"]
    assert first_item["providerTraceSummary"]["traceId"] == "trace-feed-1"
    assert first_item["providerTraceSummary"]["transport"] == "fastapi-brain"
    assert first_item["memoryMetaSummary"]["backend"] == "sqlite"
    assert first_item["memoryMetaSummary"]["usedSources"]


def test_admin_consultation_feed_filters_by_status_owner_and_escalation(tmp_path, monkeypatch):
    sqlite_path = tmp_path / "admin-feed-filters.db"
    configure_memory_backend(monkeypatch, backend="sqlite", sqlite_path=str(sqlite_path))
    seed_feed_snapshots()

    orchestrator = build_orchestrator()

    escalated_feed = asyncio.run(
        orchestrator.high_risk_consultation_feed(limit=10, escalated_only=True)
    )
    assert escalated_feed["count"] == 1
    assert escalated_feed["items"][0]["consultationId"] == "consultation-child-1"

    completed_feed = asyncio.run(
        orchestrator.high_risk_consultation_feed(limit=10, status="completed")
    )
    assert completed_feed["count"] == 1
    assert completed_feed["items"][0]["consultationId"] == "consultation-child-2"

    owner_feed = asyncio.run(
        orchestrator.high_risk_consultation_feed(limit=10, owner_name="Teacher Li")
    )
    assert owner_feed["count"] == 1
    assert owner_feed["items"][0]["consultationId"] == "consultation-child-2"

    child_feed = asyncio.run(
        orchestrator.high_risk_consultation_feed(limit=10, child_id="child-1")
    )
    assert child_feed["count"] == 1
    assert child_feed["items"][0]["consultationId"] == "consultation-child-1"
