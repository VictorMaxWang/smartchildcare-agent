from __future__ import annotations

from typing import Any

from app.tools.summary_tools import safe_dict, safe_list, unique_texts


def _as_text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _as_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes"}:
            return True
        if normalized in {"false", "0", "no"}:
            return False
    return default


def _as_string_list(value: Any, *, limit: int = 24) -> list[str]:
    return unique_texts([_as_text(item) for item in safe_list(value)], limit=limit)


def _first_list_text(value: Any) -> str:
    items = _as_string_list(value, limit=1)
    return items[0] if items else ""


def _coalesce_text(*values: Any, fallback: str = "") -> str:
    for value in values:
        text = _as_text(value)
        if text:
            return text
    return fallback


def _normalize_memory_meta(
    value: Any,
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    record = safe_dict(value)
    trace_meta = safe_dict(payload.get("_memory_trace_meta")) if payload else {}

    normalized: dict[str, Any] = {
        "backend": _coalesce_text(
            record.get("backend"),
            record.get("memoryContextBackend"),
            trace_meta.get("memory_context_backend"),
            fallback="unknown",
        ),
        "degraded": _as_bool(
            record.get("degraded"),
            _as_bool(trace_meta.get("memory_context_degraded")),
        ),
        "usedSources": _as_string_list(
            record.get("usedSources")
            or record.get("used_sources")
            or trace_meta.get("memory_used_sources")
        ),
        "errors": _as_string_list(record.get("errors")),
        "matchedSnapshotIds": _as_string_list(
            record.get("matchedSnapshotIds") or record.get("matched_snapshot_ids")
        ),
        "matchedTraceIds": _as_string_list(
            record.get("matchedTraceIds") or record.get("matched_trace_ids")
        ),
    }

    matched_search_sources = _as_string_list(
        record.get("matchedSearchSources") or record.get("matched_search_sources")
    )
    if matched_search_sources:
        normalized["matchedSearchSources"] = matched_search_sources

    if "memory_context_used" in trace_meta:
        normalized["memoryContextUsed"] = _as_bool(trace_meta.get("memory_context_used"))
    if "memory_context_count" in trace_meta:
        try:
            normalized["memoryContextCount"] = int(trace_meta["memory_context_count"])
        except (TypeError, ValueError):
            pass
    if trace_meta.get("memory_context_child_ids"):
        normalized["memoryContextChildIds"] = _as_string_list(
            trace_meta.get("memory_context_child_ids")
        )

    return normalized


def _normalize_provider_trace(
    value: Any,
    result: dict[str, Any],
    *,
    brain_provider: str = "unknown",
    default_transport: str = "",
    default_transport_source: str = "",
    default_consultation_source: str = "",
    default_fallback_reason: str = "",
) -> dict[str, Any]:
    record = safe_dict(value)
    source = _coalesce_text(record.get("source"), result.get("source"), fallback="unknown")
    provider = _coalesce_text(
        record.get("provider"),
        record.get("llm"),
        result.get("provider"),
        source,
        fallback="unknown",
    )
    model = _coalesce_text(record.get("model"), result.get("model"))
    request_id = _coalesce_text(record.get("requestId"), record.get("request_id"))
    transport = _coalesce_text(record.get("transport"), default_transport)
    transport_source = _coalesce_text(
        record.get("transportSource"),
        default_transport_source,
        transport,
    )
    consultation_source = _coalesce_text(
        record.get("consultationSource"),
        default_consultation_source,
        result.get("source"),
    )
    fallback_reason = _coalesce_text(
        record.get("fallbackReason"),
        record.get("fallback_reason"),
        default_fallback_reason,
    )
    fallback = (
        _as_bool(record.get("fallback"))
        if "fallback" in record
        else source != "vivo"
    )
    real_provider = (
        _as_bool(record.get("realProvider"))
        if "realProvider" in record
        else source == "vivo" and not fallback
    )

    normalized = {
        "provider": provider,
        "source": source,
        "model": model,
        "requestId": request_id,
        "transport": transport,
        "transportSource": transport_source,
        "consultationSource": consultation_source,
        "fallbackReason": fallback_reason,
        "brainProvider": _coalesce_text(
            record.get("brainProvider"),
            brain_provider,
            fallback="unknown",
        ),
        "realProvider": real_provider,
        "fallback": fallback,
    }

    for key in ("llm", "ocr", "asr", "tts", "modes", "meta"):
        if key in record:
            normalized[key] = record[key]

    return normalized


def _normalize_participants(value: Any) -> list[dict[str, str]]:
    participants: list[dict[str, str]] = []
    for item in safe_list(value):
        record = safe_dict(item)
        participant_id = _coalesce_text(record.get("id"), fallback="unknown")
        label = _coalesce_text(record.get("label"), participant_id, fallback="unknown")
        participants.append({"id": participant_id, "label": label})
    return participants


def _normalize_coordinator_summary(result: dict[str, Any]) -> dict[str, Any]:
    record = safe_dict(result.get("coordinatorSummary"))
    summary = _coalesce_text(result.get("summary"))
    school_action = _coalesce_text(
        record.get("schoolAction"),
        _first_list_text(result.get("todayInSchoolActions")),
        result.get("schoolAction"),
        fallback="\u4eca\u5929\u5148\u8865\u9f50\u56ed\u5185\u89c2\u5bdf\u8bb0\u5f55\u3002",
    )
    home_action = _coalesce_text(
        record.get("homeAction"),
        _first_list_text(result.get("tonightAtHomeActions")),
        result.get("homeAction"),
        fallback="\u4eca\u665a\u5f62\u6210\u4e00\u6761\u660e\u786e\u7684\u5bb6\u5ead\u53cd\u9988\u3002",
    )
    observation_points = _as_string_list(
        record.get("observationPoints")
        or result.get("observationPoints")
        or result.get("nextCheckpoints")
    )
    review_in_48h = _coalesce_text(
        record.get("reviewIn48h"),
        result.get("reviewIn48h"),
        _first_list_text(result.get("followUp48h")),
    )
    should_escalate = _as_bool(
        record.get("shouldEscalateToAdmin"),
        _as_bool(result.get("shouldEscalateToAdmin")),
    )

    return {
        "finalConclusion": _coalesce_text(
            record.get("finalConclusion"),
            summary,
            fallback=summary,
        ),
        "riskLevel": _coalesce_text(
            record.get("riskLevel"),
            result.get("riskLevel"),
            fallback="medium",
        ),
        "problemDefinition": _coalesce_text(
            record.get("problemDefinition"),
            _first_list_text(result.get("keyFindings")),
            summary,
        ),
        "schoolAction": school_action,
        "homeAction": home_action,
        "observationPoints": observation_points,
        "reviewIn48h": review_in_48h,
        "shouldEscalateToAdmin": should_escalate,
    }


def _normalize_director_decision_card(
    result: dict[str, Any],
    *,
    escalation: bool,
) -> dict[str, Any]:
    record = safe_dict(result.get("directorDecisionCard"))
    recommended_owner_role = _coalesce_text(
        record.get("recommendedOwnerRole"),
        "admin" if escalation else "teacher",
    )
    recommended_owner_name = _coalesce_text(
        record.get("recommendedOwnerName"),
        "\u56ed\u957f" if recommended_owner_role == "admin" else "\u73ed\u7ea7\u8001\u5e08",
    )

    return {
        "title": _coalesce_text(
            record.get("title"),
            fallback="\u56ed\u957f\u51b3\u7b56\u5361",
        ),
        "reason": _coalesce_text(
            record.get("reason"),
            safe_dict(result.get("coordinatorSummary")).get("problemDefinition"),
            result.get("summary"),
            fallback="\u5f53\u524d\u9ad8\u98ce\u9669\u4f1a\u8bca\u9700\u8981\u7ee7\u7eed\u63a8\u8fdb\u95ed\u73af\u52a8\u4f5c\u3002",
        ),
        "recommendedOwnerRole": recommended_owner_role,
        "recommendedOwnerName": recommended_owner_name,
        "recommendedAt": _coalesce_text(record.get("recommendedAt"), fallback="today"),
        "status": _coalesce_text(record.get("status"), fallback="pending"),
    }


def _normalize_explainability(
    result: dict[str, Any],
    participants: list[dict[str, str]],
    key_findings: list[str],
    coordination_conclusion: str,
) -> list[dict[str, str]]:
    participant_labels = unique_texts([item["label"] for item in participants], limit=8)
    canonical = [
        {
            "label": "Agent \u53c2\u4e0e",
            "detail": (
                "\u3001".join(participant_labels)
                if participant_labels
                else "\u9ad8\u98ce\u9669\u4f1a\u8bca\u4e3b\u94fe\u5df2\u53c2\u4e0e\u534f\u540c\u3002"
            ),
        },
        {
            "label": "\u5173\u952e\u53d1\u73b0",
            "detail": (
                "\u3001".join(key_findings[:3])
                if key_findings
                else "\u5f53\u524d\u9700\u8981\u56f4\u7ed5\u98ce\u9669\u4fe1\u53f7\u7ee7\u7eed\u4fdd\u7559\u95ed\u73af\u89c2\u5bdf\u3002"
            ),
        },
        {
            "label": "\u534f\u8c03\u7ed3\u8bba",
            "detail": coordination_conclusion or _coalesce_text(result.get("summary")),
        },
    ]

    seen = {(item["label"], item["detail"]) for item in canonical}
    extras: list[dict[str, str]] = []
    for item in safe_list(result.get("explainability")):
        record = safe_dict(item)
        label = _coalesce_text(record.get("label"), fallback="\u8bf4\u660e")
        detail = _coalesce_text(record.get("detail"))
        if not detail:
            continue
        key = (label, detail)
        if key in seen:
            continue
        seen.add(key)
        extras.append({"label": label, "detail": detail})

    return canonical + extras


def _validate_required_fields(result: dict[str, Any]) -> None:
    issues: list[str] = []

    for key in (
        "consultationId",
        "childId",
        "generatedAt",
        "riskLevel",
        "source",
        "summary",
        "parentMessageDraft",
        "reviewIn48h",
    ):
        if not _as_text(result.get(key)):
            issues.append(key)

    for key in (
        "triggerReasons",
        "keyFindings",
        "todayInSchoolActions",
        "tonightAtHomeActions",
        "followUp48h",
        "nextCheckpoints",
        "explainability",
    ):
        if not isinstance(result.get(key), list):
            issues.append(key)

    for key in (
        "providerTrace",
        "memoryMeta",
        "traceMeta",
        "coordinatorSummary",
        "directorDecisionCard",
        "interventionCard",
    ):
        if not safe_dict(result.get(key)):
            issues.append(key)

    if not isinstance(result.get("shouldEscalateToAdmin"), bool):
        issues.append("shouldEscalateToAdmin")

    if not safe_dict(safe_dict(result.get("traceMeta")).get("memory")):
        issues.append("traceMeta.memory")

    if issues:
        raise ValueError(
            f"normalized consultation result missing required fields: {', '.join(issues)}"
        )


def normalize_high_risk_consultation_result(
    raw_result: dict[str, Any],
    *,
    payload: dict[str, Any] | None = None,
    brain_provider: str = "unknown",
    default_transport: str = "",
    default_transport_source: str = "",
    default_consultation_source: str = "",
    default_fallback_reason: str = "",
) -> dict[str, Any]:
    result = dict(raw_result)
    participants = _normalize_participants(result.get("participants"))
    trigger_reasons = _as_string_list(result.get("triggerReasons"))
    key_findings = _as_string_list(result.get("keyFindings"))
    today_in_school_actions = _as_string_list(result.get("todayInSchoolActions"))
    tonight_at_home_actions = _as_string_list(result.get("tonightAtHomeActions"))
    follow_up_48h = _as_string_list(result.get("followUp48h"))
    next_checkpoints = _as_string_list(result.get("nextCheckpoints"))
    continuity_notes = _as_string_list(result.get("continuityNotes"))

    provider_trace = _normalize_provider_trace(
        result.get("providerTrace"),
        result,
        brain_provider=brain_provider,
        default_transport=default_transport,
        default_transport_source=default_transport_source,
        default_consultation_source=default_consultation_source,
        default_fallback_reason=default_fallback_reason,
    )
    memory_meta = _normalize_memory_meta(
        result.get("memoryMeta") or safe_dict(result.get("traceMeta")).get("memory"),
        payload,
    )
    coordinator_summary = _normalize_coordinator_summary(result)
    director_decision_card = _normalize_director_decision_card(
        result,
        escalation=coordinator_summary["shouldEscalateToAdmin"],
    )
    explainability = _normalize_explainability(
        result,
        participants,
        key_findings,
        coordinator_summary["finalConclusion"],
    )

    existing_trace_meta = safe_dict(result.get("traceMeta"))
    trace_meta = {
        **existing_trace_meta,
        "provider": provider_trace["provider"],
        "source": provider_trace["source"],
        "model": provider_trace["model"],
        "requestId": provider_trace["requestId"],
        "transport": provider_trace["transport"],
        "transportSource": provider_trace["transportSource"],
        "consultationSource": provider_trace["consultationSource"],
        "fallbackReason": provider_trace["fallbackReason"],
        "brainProvider": provider_trace["brainProvider"],
        "fallback": provider_trace["fallback"],
        "realProvider": provider_trace["realProvider"],
        "memory": memory_meta,
        "agentParticipants": [item["label"] for item in participants],
        "coordinationConclusion": coordinator_summary["finalConclusion"],
        "keyFindings": key_findings,
    }

    normalized = {
        **result,
        "consultationId": _coalesce_text(result.get("consultationId"), fallback=""),
        "childId": _coalesce_text(result.get("childId"), fallback=""),
        "generatedAt": _coalesce_text(result.get("generatedAt"), fallback=""),
        "riskLevel": _coalesce_text(result.get("riskLevel"), fallback="medium"),
        "source": _coalesce_text(
            result.get("source"),
            provider_trace["source"],
            fallback="mock",
        ),
        "provider": provider_trace["provider"],
        "model": provider_trace["model"],
        "realProvider": provider_trace["realProvider"],
        "fallback": provider_trace["fallback"],
        "triggerReason": _coalesce_text(
            result.get("triggerReason"),
            trigger_reasons[0] if trigger_reasons else "",
        ),
        "triggerReasons": trigger_reasons,
        "keyFindings": key_findings,
        "todayInSchoolActions": today_in_school_actions,
        "tonightAtHomeActions": tonight_at_home_actions,
        "followUp48h": follow_up_48h,
        "nextCheckpoints": next_checkpoints,
        "continuityNotes": continuity_notes,
        "participants": participants,
        "shouldEscalateToAdmin": coordinator_summary["shouldEscalateToAdmin"],
        "coordinatorSummary": coordinator_summary,
        "directorDecisionCard": director_decision_card,
        "providerTrace": provider_trace,
        "memoryMeta": memory_meta,
        "traceMeta": trace_meta,
        "explainability": explainability,
        "reviewIn48h": _coalesce_text(
            result.get("reviewIn48h"),
            coordinator_summary["reviewIn48h"],
            follow_up_48h[0] if follow_up_48h else "",
        ),
        "parentMessageDraft": _coalesce_text(
            result.get("parentMessageDraft"),
            fallback="",
        ),
    }

    _validate_required_fields(normalized)
    return normalized


def build_high_risk_done_event(
    *,
    trace_id: str,
    result: dict[str, Any] | None,
    payload: dict[str, Any] | None = None,
    brain_provider: str = "unknown",
    default_transport: str = "",
    default_transport_source: str = "",
    default_consultation_source: str = "",
    default_fallback_reason: str = "",
) -> dict[str, Any]:
    normalized_result = (
        normalize_high_risk_consultation_result(
            result,
            payload=payload,
            brain_provider=brain_provider,
            default_transport=default_transport,
            default_transport_source=default_transport_source,
            default_consultation_source=default_consultation_source,
            default_fallback_reason=default_fallback_reason,
        )
        if isinstance(result, dict)
        else None
    )

    if normalized_result is None:
        provider_trace = _normalize_provider_trace(
            {},
            {},
            brain_provider=brain_provider,
            default_transport=default_transport,
            default_transport_source=default_transport_source,
            default_consultation_source=default_consultation_source,
            default_fallback_reason=default_fallback_reason,
        )
        memory_meta = _normalize_memory_meta({}, payload)
    else:
        provider_trace = safe_dict(normalized_result.get("providerTrace"))
        memory_meta = safe_dict(normalized_result.get("memoryMeta"))

    return {
        "traceId": trace_id,
        "result": normalized_result,
        "providerTrace": provider_trace,
        "memoryMeta": memory_meta,
        "realProvider": _as_bool(provider_trace.get("realProvider")),
        "fallback": _as_bool(provider_trace.get("fallback"), default=True),
    }
