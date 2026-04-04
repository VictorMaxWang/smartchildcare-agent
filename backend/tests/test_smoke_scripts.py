from __future__ import annotations

import importlib.util
from pathlib import Path
from types import SimpleNamespace

import pytest


REPO_ROOT = Path(__file__).resolve().parents[2]


def load_module(name: str, relative_path: str):
    module_path = REPO_ROOT / relative_path
    spec = importlib.util.spec_from_file_location(name, module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"failed to load module from {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


vivo_smoke = load_module("vivo_llm_smoke", "backend/scripts/vivo_llm_smoke.py")
consultation_smoke = load_module("consultation_sse_smoke", "backend/scripts/consultation_sse_smoke.py")


def build_result(**overrides):
    defaults = {
        "provider": "vivo-llm",
        "source": "vivo",
        "model": "Volc-DeepSeek-V3.2",
        "fallback": False,
        "request_id": "req-123",
        "usage": {"total_tokens": 42},
        "meta": {"finish_reason": "stop"},
        "raw": {"id": "chatcmpl-123", "created": 1712300000},
        "content": "真实返回",
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_validate_strict_accepts_real_vivo_result():
    passed, reason = vivo_smoke.validate_strict(build_result())
    assert passed is True
    assert reason == ""


def test_validate_strict_rejects_mock_fallback():
    passed, reason = vivo_smoke.validate_strict(build_result(source="mock", fallback=True))
    assert passed is False
    assert "source=vivo" in reason


def test_validate_strict_rejects_missing_upstream_markers():
    passed, reason = vivo_smoke.validate_strict(build_result(usage=None, raw={}))
    assert passed is False
    assert "missing upstream vivo markers" in reason


def build_stream_events():
    return [
        {"event": "status", "data": {"stage": "long_term_profile"}},
        {"event": "text", "data": {"stage": "long_term_profile"}},
        {"event": "ui", "data": {"stage": "long_term_profile"}},
        {"event": "status", "data": {"stage": "recent_context"}},
        {"event": "text", "data": {"stage": "recent_context"}},
        {"event": "ui", "data": {"stage": "recent_context"}},
        {"event": "status", "data": {"stage": "current_recommendation"}},
        {"event": "text", "data": {"stage": "current_recommendation"}},
        {"event": "ui", "data": {"stage": "current_recommendation"}},
        {
            "event": "done",
            "data": {
                "traceId": "trace-123",
                "realProvider": True,
                "fallback": False,
                "providerTrace": {"source": "vivo", "model": "Volc-DeepSeek-V3.2"},
                "memoryMeta": {
                    "memory_context_used": True,
                    "usedSources": ["agent_state_snapshots", "agent_trace_log"],
                    "matchedSnapshotIds": ["snapshot-1"],
                    "matchedTraceIds": ["trace-row-1"],
                },
            },
        },
    ]


def test_summarize_events_extracts_provider_and_memory_fields():
    summary = consultation_smoke.summarize_events(build_stream_events())

    assert summary["event_sequence"] == [
        "status",
        "text",
        "ui",
        "status",
        "text",
        "ui",
        "status",
        "text",
        "ui",
        "done",
    ]
    assert summary["stage_sequence"] == [
        "long_term_profile",
        "recent_context",
        "current_recommendation",
    ]
    assert summary["provider_source"] == "vivo"
    assert summary["provider_model"] == "Volc-DeepSeek-V3.2"
    assert summary["real_provider"] is True
    assert summary["fallback"] is False
    assert summary["memory_context_used"] is True
    assert summary["memory_used_sources"] == ["agent_state_snapshots", "agent_trace_log"]
    assert summary["matched_snapshot_ids"] == ["snapshot-1"]
    assert summary["matched_trace_ids"] == ["trace-row-1"]


def test_summarize_events_rejects_missing_required_stage():
    broken_events = [event for event in build_stream_events() if event["data"].get("stage") != "recent_context"]

    with pytest.raises(RuntimeError, match="missing SSE stages"):
        consultation_smoke.summarize_events(broken_events)


def test_evaluate_provider_requires_real_vivo_when_requested():
    issues = consultation_smoke.evaluate_provider(
        {
            "provider_source": "mock",
            "real_provider": False,
            "fallback": True,
        },
        require_real_provider=True,
    )

    assert issues == [
        "expected provider_source='vivo', got 'mock'",
        "expected real_provider=true",
        "expected fallback=false",
    ]


def test_memory_check_best_effort_does_not_fail_when_memory_is_absent():
    result = consultation_smoke.evaluate_memory_check(
        {
            "memory_context_used": False,
            "memory_used_sources": [],
        },
        None,
        mode="best-effort",
        endpoint_error=None,
    )

    assert result["memory_check"] == "absent"
    assert result["ok"] is True
    assert "second SSE run did not expose agent_state_snapshots or agent_trace_log" in result["warnings"]


def test_memory_check_required_needs_stream_and_endpoint_signals():
    success = consultation_smoke.evaluate_memory_check(
        {
            "memory_context_used": True,
            "memory_used_sources": ["agent_trace_log"],
        },
        {
            "recent_continuity_signals": ["follow-up scheduled"],
            "matched_snapshot_ids": [],
            "matched_trace_ids": ["trace-row-1"],
        },
        mode="required",
        endpoint_error=None,
    )
    failure = consultation_smoke.evaluate_memory_check(
        {
            "memory_context_used": False,
            "memory_used_sources": [],
        },
        {
            "recent_continuity_signals": [],
            "matched_snapshot_ids": [],
            "matched_trace_ids": [],
        },
        mode="required",
        endpoint_error=None,
    )

    assert success["memory_check"] == "present"
    assert success["ok"] is True
    assert failure["memory_check"] == "absent"
    assert failure["ok"] is False
