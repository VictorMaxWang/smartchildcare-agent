from __future__ import annotations

import argparse
import json
from typing import Any

import requests


DEFAULT_BASE_URL = "http://127.0.0.1:8000"
DEFAULT_CHILD_ID = "stage-demo-child"
EXPECTED_EVENTS = ("status", "text", "ui", "done")
EXPECTED_STAGES = ("long_term_profile", "recent_context", "current_recommendation")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke-test backend health, consultation SSE, and memory context.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Backend base URL, for example http://127.0.0.1:8000")
    parser.add_argument("--child-id", default=DEFAULT_CHILD_ID, help="Child id used for the smoke payload.")
    parser.add_argument("--timeout", type=float, default=20.0, help="Request timeout in seconds.")
    parser.add_argument(
        "--memory-check",
        choices=("off", "best-effort", "required"),
        default="best-effort",
        help="Whether memory presence is skipped, observed, or required.",
    )
    parser.add_argument(
        "--require-real-provider",
        action="store_true",
        help="Fail when the consultation run reports fallback or a non-vivo provider source.",
    )
    return parser.parse_args()


def as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def as_string(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def as_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def first_present(record: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in record and record[key] is not None:
            return record[key]
    return None


def merge_unique(*groups: list[str]) -> list[str]:
    merged: list[str] = []
    seen: set[str] = set()
    for group in groups:
        for item in group:
            if item in seen:
                continue
            seen.add(item)
            merged.append(item)
    return merged


def build_payload(child_id: str, teacher_note: str) -> dict[str, Any]:
    return {
        "targetChildId": child_id,
        "teacherNote": teacher_note,
        "currentUser": {"id": "teacher-stage", "name": "Stage Teacher", "className": "Sunshine"},
        "visibleChildren": [{"id": child_id, "name": "Stage Demo Child"}],
        "presentChildren": [{"id": child_id, "name": "Stage Demo Child"}],
        "healthCheckRecords": [],
        "growthRecords": [],
        "guardianFeedbacks": [],
        "debugMemory": True,
    }


def read_health(base_url: str, timeout: float) -> dict[str, Any]:
    base_url = base_url.rstrip("/")
    errors: list[str] = []

    for path in ("/health", "/api/v1/health"):
        url = f"{base_url}{path}"
        try:
            response = requests.get(url, timeout=timeout)
            response.raise_for_status()
            data = response.json()
            if data.get("status") != "ok":
                raise RuntimeError(f"{path} did not return status=ok")
            return {
                "url": url,
                "environment": data.get("environment"),
                "providers": data.get("providers"),
                "brain_provider": data.get("brain_provider"),
                "llm_provider_selected": data.get("llm_provider_selected"),
                "provider_assertion_scope": data.get("provider_assertion_scope"),
                "configured_memory_backend": data.get("configured_memory_backend"),
                "memory_backend": data.get("memory_backend"),
                "degraded": data.get("degraded"),
                "degradation_reasons": data.get("degradation_reasons"),
                "vivo_configured": data.get("vivo_configured"),
                "vivo_credentials_configured": data.get("vivo_credentials_configured"),
            }
        except Exception as error:
            errors.append(f"{path}:{error}")

    raise RuntimeError(f"health check failed for all known paths: {' | '.join(errors)}")


def collect_sse_events(base_url: str, payload: dict[str, Any], timeout: float) -> list[dict[str, Any]]:
    with requests.post(
        f"{base_url.rstrip('/')}/api/v1/agents/consultations/high-risk/stream",
        headers={"Accept": "text/event-stream", "Content-Type": "application/json"},
        json=payload,
        stream=True,
        timeout=(timeout, timeout),
    ) as response:
        response.raise_for_status()

        events: list[dict[str, Any]] = []
        event_name = ""
        data_lines: list[str] = []

        for raw_line in response.iter_lines(decode_unicode=True):
            line = raw_line if isinstance(raw_line, str) else ""
            if line == "":
                if event_name and data_lines:
                    payload_data = json.loads("\n".join(data_lines))
                    events.append({"event": event_name, "data": payload_data})
                    if event_name == "done":
                        break
                event_name = ""
                data_lines = []
                continue
            if line.startswith("event: "):
                event_name = line.removeprefix("event: ").strip()
                continue
            if line.startswith("data: "):
                data_lines.append(line.removeprefix("data: ").strip())

    if not events:
        raise RuntimeError("no SSE events were received")
    return events


def extract_stage_sequence(events: list[dict[str, Any]]) -> list[str]:
    stages: list[str] = []
    for item in events:
        if item.get("event") != "status":
            continue
        stage = as_string(as_dict(item.get("data")).get("stage"))
        if stage:
            stages.append(stage)
    return stages


def validate_event_contract(events: list[dict[str, Any]]) -> None:
    received_events = {as_string(item.get("event")) for item in events}
    missing_events = [name for name in EXPECTED_EVENTS if name not in received_events]
    if missing_events:
        raise RuntimeError(f"missing SSE events: {missing_events}")

    stages = extract_stage_sequence(events)
    missing_stages = [name for name in EXPECTED_STAGES if name not in stages]
    if missing_stages:
        raise RuntimeError(f"missing SSE stages: {missing_stages}")

    ordered_positions = [stages.index(name) for name in EXPECTED_STAGES]
    if ordered_positions != sorted(ordered_positions):
        raise RuntimeError(f"unexpected SSE stage order: {stages}")


def normalize_provider_trace(done_data: dict[str, Any]) -> dict[str, Any]:
    provider_trace = as_dict(done_data.get("providerTrace"))
    source = as_string(first_present(provider_trace, "source")) or "unknown"
    model = as_string(first_present(provider_trace, "model"))
    request_id = as_string(first_present(provider_trace, "requestId", "request_id"))
    transport = as_string(first_present(provider_trace, "transport"))
    transport_source = as_string(first_present(provider_trace, "transportSource")) or transport
    consultation_source = as_string(first_present(provider_trace, "consultationSource"))
    fallback_reason = as_string(first_present(provider_trace, "fallbackReason"))
    brain_provider = as_string(first_present(provider_trace, "brainProvider"))
    real_provider = bool(first_present(done_data, "realProvider", "real_provider"))
    if "realProvider" not in done_data and "real_provider" not in done_data:
        real_provider = bool(first_present(provider_trace, "realProvider", "real_provider"))
    fallback = bool(first_present(done_data, "fallback"))
    if "fallback" not in done_data:
        fallback = bool(first_present(provider_trace, "fallback"))
    return {
        "provider_source": source,
        "provider_model": model,
        "request_id": request_id,
        "transport": transport,
        "transport_source": transport_source,
        "consultation_source": consultation_source,
        "fallback_reason": fallback_reason,
        "brain_provider": brain_provider,
        "real_provider": real_provider,
        "fallback": fallback,
    }


def normalize_memory_meta(memory_meta: dict[str, Any]) -> dict[str, Any]:
    return {
        "memory_context_used": bool(first_present(memory_meta, "memory_context_used", "memoryContextUsed")),
        "memory_used_sources": as_string_list(first_present(memory_meta, "usedSources", "used_sources")),
        "matched_snapshot_ids": as_string_list(first_present(memory_meta, "matchedSnapshotIds", "matched_snapshot_ids")),
        "matched_trace_ids": as_string_list(first_present(memory_meta, "matchedTraceIds", "matched_trace_ids")),
    }


def summarize_events(events: list[dict[str, Any]]) -> dict[str, Any]:
    validate_event_contract(events)
    done_event = next(item for item in events if item.get("event") == "done")
    done_data = as_dict(done_event.get("data"))
    provider_summary = normalize_provider_trace(done_data)
    memory_summary = normalize_memory_meta(as_dict(done_data.get("memoryMeta")))

    return {
        "event_sequence": [as_string(item.get("event")) for item in events],
        "stage_sequence": extract_stage_sequence(events),
        "trace_id": as_string(first_present(done_data, "traceId", "trace_id")),
        **provider_summary,
        **memory_summary,
    }


def read_memory_context(base_url: str, child_id: str, timeout: float) -> dict[str, Any]:
    response = requests.post(
        f"{base_url.rstrip('/')}/api/v1/memory/context",
        headers={"Content-Type": "application/json"},
        json={
            "child_id": child_id,
            "workflow_type": "high-risk-consultation",
            "options": {"query": "follow-up note 48 hour recheck", "limit": 5, "top_k": 5},
        },
        timeout=timeout,
    )
    response.raise_for_status()
    return response.json()


def summarize_memory_context(payload: dict[str, Any]) -> dict[str, Any]:
    prompt_context = as_dict(payload.get("prompt_context"))
    meta = as_dict(payload.get("meta"))
    return {
        "backend": as_string(first_present(meta, "backend")),
        "used_sources": as_string_list(first_present(meta, "used_sources", "usedSources")),
        "matched_snapshot_ids": as_string_list(first_present(meta, "matched_snapshot_ids", "matchedSnapshotIds")),
        "matched_trace_ids": as_string_list(first_present(meta, "matched_trace_ids", "matchedTraceIds")),
        "recent_continuity_signals": as_string_list(
            first_present(prompt_context, "recent_continuity_signals", "recentContinuitySignals")
        ),
        "open_loops": as_string_list(first_present(prompt_context, "open_loops", "openLoops")),
    }


def evaluate_provider(summary: dict[str, Any], *, require_real_provider: bool) -> list[str]:
    if not require_real_provider:
        return []

    issues: list[str] = []
    if summary.get("brain_provider") != "vivo":
        issues.append(f"expected brain_provider='vivo', got {summary.get('brain_provider')!r}")
    if summary.get("provider_source") != "vivo":
        issues.append(f"expected provider_source='vivo', got {summary.get('provider_source')!r}")
    if not summary.get("provider_model"):
        issues.append("expected provider_model to be non-empty")
    if not summary.get("request_id"):
        issues.append("expected request_id to be non-empty")
    if summary.get("transport") != "fastapi-brain" and summary.get("transport_source") != "fastapi-brain":
        issues.append(
            "expected transport_source='fastapi-brain' or transport='fastapi-brain'"
        )
    if not summary.get("real_provider"):
        issues.append("expected real_provider=true")
    if summary.get("fallback"):
        issues.append("expected fallback=false")
    return issues


def evaluate_memory_check(
    summary: dict[str, Any],
    endpoint_summary: dict[str, Any] | None,
    *,
    mode: str,
    endpoint_error: str | None,
) -> dict[str, Any]:
    if mode == "off":
        return {
            "memory_check": "skipped",
            "ok": True,
            "warnings": [],
        }

    has_stream_memory = bool({"agent_state_snapshots", "agent_trace_log"} & set(summary["memory_used_sources"]))
    has_endpoint_memory = bool(
        endpoint_summary
        and (
            endpoint_summary["recent_continuity_signals"]
            or endpoint_summary["matched_snapshot_ids"]
            or endpoint_summary["matched_trace_ids"]
        )
    )
    warnings: list[str] = []

    if not has_stream_memory:
        warnings.append("second SSE run did not expose agent_state_snapshots or agent_trace_log")
    if endpoint_error:
        warnings.append(f"memory context endpoint failed: {endpoint_error}")
    elif not has_endpoint_memory:
        warnings.append("memory context endpoint did not return continuity signals or matched ids")

    if mode == "required":
        return {
            "memory_check": "present" if has_stream_memory and has_endpoint_memory else "absent",
            "ok": has_stream_memory and has_endpoint_memory,
            "warnings": warnings,
        }

    return {
        "memory_check": "present" if has_stream_memory or has_endpoint_memory or summary["memory_context_used"] else "absent",
        "ok": True,
        "warnings": warnings,
    }


def main() -> int:
    args = parse_args()
    base_url = str(args.base_url).rstrip("/")

    try:
        health = read_health(base_url, args.timeout)

        first_events = collect_sse_events(
            base_url,
            build_payload(args.child_id, "first smoke run should write consultation trace and snapshot state"),
            args.timeout,
        )
        second_events = collect_sse_events(
            base_url,
            build_payload(args.child_id, "second smoke run should read the prior trace and snapshot state"),
            args.timeout,
        )

        first_run = summarize_events(first_events)
        second_run = summarize_events(second_events)
        second_run["brain_provider"] = second_run["brain_provider"] or as_string(health.get("brain_provider"))

        memory_context_payload: dict[str, Any] | None = None
        memory_context_error: str | None = None
        if args.memory_check != "off":
            try:
                memory_context_payload = read_memory_context(base_url, args.child_id, args.timeout)
            except Exception as error:
                memory_context_error = str(error)

        memory_context = summarize_memory_context(memory_context_payload or {})
        memory_result = evaluate_memory_check(
            second_run,
            memory_context if memory_context_payload else None,
            mode=args.memory_check,
            endpoint_error=memory_context_error,
        )
        provider_issues = evaluate_provider(second_run, require_real_provider=args.require_real_provider)
        warnings = merge_unique(provider_issues, memory_result["warnings"])
        matched_snapshot_ids = merge_unique(second_run["matched_snapshot_ids"], memory_context["matched_snapshot_ids"])
        matched_trace_ids = merge_unique(second_run["matched_trace_ids"], memory_context["matched_trace_ids"])

        output = {
            "ok": not provider_issues and memory_result["ok"],
            "health": health,
            "first_run": first_run,
            "second_run": second_run,
            "event_sequence": second_run["event_sequence"],
            "stage_sequence": second_run["stage_sequence"],
            "provider_source": second_run["provider_source"],
            "provider_model": second_run["provider_model"],
            "request_id": second_run["request_id"],
            "transport": second_run["transport"],
            "transport_source": second_run["transport_source"],
            "consultation_source": second_run["consultation_source"],
            "fallback_reason": second_run["fallback_reason"],
            "brain_provider": second_run["brain_provider"],
            "real_provider": second_run["real_provider"],
            "fallback": second_run["fallback"],
            "memory_check": memory_result["memory_check"],
            "memory_context_used": second_run["memory_context_used"],
            "memory_used_sources": merge_unique(second_run["memory_used_sources"], memory_context["used_sources"]),
            "matched_snapshot_ids": matched_snapshot_ids,
            "matched_trace_ids": matched_trace_ids,
            "memory_context": memory_context,
            "warnings": warnings,
        }

        if not output["ok"]:
            output["error"] = "; ".join(warnings) or "consultation SSE smoke failed"
            print(json.dumps(output, ensure_ascii=False, indent=2))
            return 1

        print(json.dumps(output, ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": str(error),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
