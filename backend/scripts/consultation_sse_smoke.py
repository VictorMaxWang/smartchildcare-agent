from __future__ import annotations

import argparse
import json
import sys
from typing import Any

import requests


DEFAULT_BASE_URL = "http://127.0.0.1:8000"
DEFAULT_CHILD_ID = "stage-demo-child"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Smoke-test backend health, consultation SSE, and memory context.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Backend base URL, for example http://127.0.0.1:8000")
    parser.add_argument("--child-id", default=DEFAULT_CHILD_ID, help="Child id used for the smoke payload.")
    parser.add_argument("--timeout", type=float, default=20.0, help="Request timeout in seconds.")
    return parser.parse_args()


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
    response = requests.get(f"{base_url}/health", timeout=timeout)
    response.raise_for_status()
    data = response.json()
    if data.get("status") != "ok":
        raise RuntimeError("health check did not return status=ok")
    return data


def collect_sse_events(base_url: str, payload: dict[str, Any], timeout: float) -> list[dict[str, Any]]:
    response = requests.post(
        f"{base_url}/api/v1/agents/consultations/high-risk/stream",
        headers={"Accept": "text/event-stream", "Content-Type": "application/json"},
        json=payload,
        stream=True,
        timeout=(timeout, timeout),
    )
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

    required = {"status", "text", "ui", "done"}
    received = {item["event"] for item in events}
    if not required.issubset(received):
        raise RuntimeError(f"missing SSE events: expected {sorted(required)}, got {sorted(received)}")

    return events


def read_memory_context(base_url: str, child_id: str, timeout: float) -> dict[str, Any]:
    response = requests.post(
        f"{base_url}/api/v1/memory/context",
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


def build_summary(events: list[dict[str, Any]]) -> dict[str, Any]:
    done_event = next(item for item in events if item["event"] == "done")
    done_data = done_event["data"]
    memory_meta = done_data.get("memoryMeta") or {}
    provider_trace = done_data.get("providerTrace") or {}
    return {
        "event_sequence": [item["event"] for item in events],
        "trace_id": done_data.get("traceId"),
        "provider_source": provider_trace.get("source"),
        "provider_model": provider_trace.get("model"),
        "memory_used_sources": memory_meta.get("usedSources") or [],
        "memory_context_used": memory_meta.get("memory_context_used"),
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
        memory_context = read_memory_context(base_url, args.child_id, args.timeout)

        second_summary = build_summary(second_events)
        used_sources = set(second_summary["memory_used_sources"])
        if not ({"agent_state_snapshots", "agent_trace_log"} & used_sources):
            raise RuntimeError(
                "second consultation did not expose persisted snapshot/trace memory sources"
            )

        prompt_context = memory_context.get("prompt_context") or {}
        meta = memory_context.get("meta") or {}
        if not (prompt_context.get("recent_continuity_signals") or meta.get("matched_snapshot_ids") or meta.get("matched_trace_ids")):
            raise RuntimeError("memory context endpoint did not return persisted backend-owned context")

        output = {
            "ok": True,
            "health": {
                "environment": health.get("environment"),
                "providers": health.get("providers"),
                "configured_memory_backend": health.get("configured_memory_backend"),
                "memory_backend": health.get("memory_backend"),
                "degraded": health.get("degraded"),
            },
            "first_run": build_summary(first_events),
            "second_run": second_summary,
            "memory_context": {
                "backend": meta.get("backend"),
                "matched_snapshot_ids": meta.get("matched_snapshot_ids"),
                "matched_trace_ids": meta.get("matched_trace_ids"),
                "used_sources": meta.get("used_sources"),
            },
        }
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
