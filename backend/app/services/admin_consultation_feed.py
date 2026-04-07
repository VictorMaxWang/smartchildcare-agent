from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.db.repositories import RepositoryBundle
from app.services.high_risk_consultation_contract import normalize_high_risk_consultation_result
from app.tools.summary_tools import safe_dict, safe_list, unique_texts


def _as_text(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def _coalesce_text(*values: Any, fallback: str = "") -> str:
    for value in values:
        text = _as_text(value)
        if text:
            return text
    return fallback


def _as_string_list(value: Any, *, limit: int = 8) -> list[str]:
    return unique_texts([_as_text(item) for item in safe_list(value)], limit=limit)


def _normalize_name(value: str | None) -> str:
    return (value or "").strip().casefold()


def _parse_datetime(value: Any) -> datetime:
    text = _as_text(value)
    if not text:
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


def _sort_key(item: dict[str, Any]) -> tuple[datetime, datetime]:
    return (
        _parse_datetime(item.get("generatedAt")),
        _parse_datetime(item.get("snapshotCreatedAt")),
    )


async def _load_latest_trace(
    *,
    repositories: RepositoryBundle,
    consultation_id: str,
    child_id: str,
) -> dict[str, Any] | None:
    traces = await repositories.get_recent_traces(
        limit=5,
        session_id=consultation_id or None,
        child_id=child_id or None,
    )
    if traces:
        return traces[0].model_dump(mode="json")

    if not child_id:
        return None
    traces = await repositories.get_recent_traces(limit=5, child_id=child_id)
    return traces[0].model_dump(mode="json") if traces else None


def _build_explainability_summary(result: dict[str, Any]) -> dict[str, Any]:
    trace_meta = safe_dict(result.get("traceMeta"))
    explainability = [safe_dict(item) for item in safe_list(result.get("explainability"))]
    evidence_highlights = unique_texts(
        [
            f"{_coalesce_text(item.get('label'), fallback='evidence')}: {_coalesce_text(item.get('detail'))}"
            for item in explainability
            if _coalesce_text(item.get("detail"))
        ],
        limit=4,
    )

    return {
        "agentParticipants": _as_string_list(
            trace_meta.get("agentParticipants") or [safe_dict(item).get("label") for item in safe_list(result.get("participants"))],
            limit=5,
        ),
        "keyFindings": _as_string_list(
            trace_meta.get("keyFindings") or result.get("keyFindings"),
            limit=4,
        ),
        "coordinationConclusion": _coalesce_text(
            trace_meta.get("coordinationConclusion"),
            safe_dict(result.get("coordinatorSummary")).get("finalConclusion"),
            result.get("summary"),
        ),
        "evidenceHighlights": evidence_highlights,
    }


def _build_provider_trace_summary(
    *,
    result: dict[str, Any],
    snapshot_json: dict[str, Any],
    trace_record: dict[str, Any] | None,
) -> dict[str, Any]:
    provider_trace = safe_dict(result.get("providerTrace"))
    trace_metadata = safe_dict(safe_dict(trace_record).get("metadata_json"))

    return {
        "traceId": _coalesce_text(
            snapshot_json.get("traceId"),
            safe_dict(trace_record).get("trace_id"),
        ),
        "status": _coalesce_text(safe_dict(trace_record).get("status")),
        "provider": _coalesce_text(
            provider_trace.get("provider"),
            trace_metadata.get("provider"),
            provider_trace.get("source"),
            fallback="unknown",
        ),
        "source": _coalesce_text(
            provider_trace.get("source"),
            trace_metadata.get("source"),
            fallback="unknown",
        ),
        "model": _coalesce_text(
            provider_trace.get("model"),
            trace_metadata.get("model"),
        ),
        "transport": _coalesce_text(
            provider_trace.get("transport"),
            trace_metadata.get("transport"),
        ),
        "transportSource": _coalesce_text(
            provider_trace.get("transportSource"),
            trace_metadata.get("transportSource"),
        ),
        "consultationSource": _coalesce_text(
            provider_trace.get("consultationSource"),
            trace_metadata.get("consultationSource"),
        ),
        "fallbackReason": _coalesce_text(
            provider_trace.get("fallbackReason"),
            trace_metadata.get("fallbackReason"),
        ),
        "brainProvider": _coalesce_text(
            provider_trace.get("brainProvider"),
            trace_metadata.get("brainProvider"),
            fallback="unknown",
        ),
        "realProvider": bool(provider_trace.get("realProvider")),
        "fallback": bool(provider_trace.get("fallback")),
    }


def _build_memory_meta_summary(result: dict[str, Any]) -> dict[str, Any]:
    memory_meta = safe_dict(result.get("memoryMeta"))
    return {
        "backend": _coalesce_text(memory_meta.get("backend"), fallback="unknown"),
        "degraded": bool(memory_meta.get("degraded")),
        "usedSources": _as_string_list(memory_meta.get("usedSources"), limit=4),
        "errors": _as_string_list(memory_meta.get("errors"), limit=4),
        "matchedSnapshotIds": _as_string_list(memory_meta.get("matchedSnapshotIds"), limit=4),
        "matchedTraceIds": _as_string_list(memory_meta.get("matchedTraceIds"), limit=4),
    }


def _matches_filters(
    *,
    item: dict[str, Any],
    child_id: str | None,
    risk_level: str | None,
    status: str | None,
    owner_name: str | None,
    escalated_only: bool,
) -> bool:
    if child_id and _as_text(item.get("childId")) != child_id:
        return False
    if risk_level and _normalize_name(_as_text(item.get("riskLevel"))) != _normalize_name(risk_level):
        return False
    if status and _normalize_name(_as_text(item.get("status"))) != _normalize_name(status):
        return False
    if owner_name and _normalize_name(owner_name) not in _normalize_name(_as_text(item.get("ownerName"))):
        return False
    if escalated_only and not bool(item.get("shouldEscalateToAdmin")):
        return False
    return True


async def list_high_risk_consultation_feed(
    *,
    repositories: RepositoryBundle,
    limit: int = 10,
    child_id: str | None = None,
    risk_level: str | None = None,
    status: str | None = None,
    owner_name: str | None = None,
    escalated_only: bool = False,
    brain_provider: str = "unknown",
) -> dict[str, Any]:
    candidate_limit = min(max(limit * 5, 25), 100)
    snapshots = await repositories.list_recent_snapshots(
        limit=candidate_limit,
        child_id=child_id,
        snapshot_types=["consultation-result"],
    )

    items: list[dict[str, Any]] = []
    for snapshot in snapshots:
        snapshot_json = snapshot.model_dump(mode="json").get("snapshot_json", {})
        if not isinstance(snapshot_json, dict):
            continue

        raw_result = safe_dict(snapshot_json.get("result"))
        if not raw_result:
            continue

        try:
            normalized_result = normalize_high_risk_consultation_result(
                raw_result,
                brain_provider=brain_provider,
                default_transport="fastapi-brain",
                default_transport_source="fastapi-brain",
                default_consultation_source=_coalesce_text(raw_result.get("source"), fallback="snapshot"),
                default_fallback_reason=_coalesce_text(
                    safe_dict(raw_result.get("providerTrace")).get("fallbackReason")
                ),
            )
        except ValueError:
            continue

        consultation_id = _coalesce_text(
            normalized_result.get("consultationId"),
            snapshot.session_id,
        )
        latest_trace = await _load_latest_trace(
            repositories=repositories,
            consultation_id=consultation_id,
            child_id=_as_text(normalized_result.get("childId")),
        )

        director_decision = safe_dict(normalized_result.get("directorDecisionCard"))
        item = {
            "consultationId": consultation_id,
            "childId": _as_text(normalized_result.get("childId")),
            "generatedAt": _as_text(normalized_result.get("generatedAt")),
            "snapshotCreatedAt": snapshot.created_at.isoformat(),
            "riskLevel": _as_text(normalized_result.get("riskLevel")),
            "triggerReason": _coalesce_text(
                normalized_result.get("triggerReason"),
                _as_string_list(normalized_result.get("triggerReasons"), limit=1)[0] if _as_string_list(normalized_result.get("triggerReasons"), limit=1) else "",
            ),
            "triggerReasons": _as_string_list(normalized_result.get("triggerReasons"), limit=6),
            "summary": _coalesce_text(normalized_result.get("summary")),
            "directorDecisionCard": director_decision,
            "status": _coalesce_text(director_decision.get("status"), fallback="pending"),
            "ownerName": _coalesce_text(director_decision.get("recommendedOwnerName")),
            "ownerRole": _coalesce_text(director_decision.get("recommendedOwnerRole")),
            "dueAt": _coalesce_text(director_decision.get("recommendedAt")),
            "shouldEscalateToAdmin": bool(normalized_result.get("shouldEscalateToAdmin")),
            "explainabilitySummary": _build_explainability_summary(normalized_result),
            "providerTraceSummary": _build_provider_trace_summary(
                result=normalized_result,
                snapshot_json=snapshot_json,
                trace_record=latest_trace,
            ),
            "memoryMetaSummary": _build_memory_meta_summary(normalized_result),
        }

        if _matches_filters(
            item=item,
            child_id=child_id,
            risk_level=risk_level,
            status=status,
            owner_name=owner_name,
            escalated_only=escalated_only,
        ):
            items.append(item)

    items.sort(key=_sort_key, reverse=True)
    count = len(items)
    trimmed = items[: max(limit, 1)]
    for item in trimmed:
        item.pop("snapshotCreatedAt", None)

    return {
        "items": trimmed,
        "count": count,
    }
