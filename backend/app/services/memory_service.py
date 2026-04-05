from __future__ import annotations

import json
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any

from app.db.repositories import RepositoryBundle, RepositoryError
from app.memory.session_memory import SessionMemory
from app.memory.vector_store import SimpleVectorStore
from app.schemas.memory import (
    AgentStateSnapshotRecord,
    AgentTraceLogRecord,
    ChildProfileMemoryRecord,
    MemoryContextBuildOptions,
    MemoryContextEnvelope,
    MemoryContextMeta,
    MemoryPromptContext,
    MemorySearchHit,
)


PROFILE_FIELD_LABELS = {
    "nickname": "常用称呼",
    "age_band": "年龄段",
    "ageBand": "年龄段",
    "allergies": "过敏史",
    "special_notes": "长期提醒",
    "specialNotes": "长期提醒",
    "temperament": "气质特点",
    "diet_preferences": "饮食偏好",
    "dietPreferences": "饮食偏好",
    "sleep_pattern": "睡眠规律",
    "sleepPattern": "睡眠规律",
    "communication_style": "沟通方式",
    "communicationStyle": "沟通方式",
    "sensitive_points": "敏感点",
    "sensitivePoints": "敏感点",
    "strengths": "优势特点",
    "support_strategies": "有效安抚方式",
    "supportStrategies": "有效安抚方式",
    "risk_level": "长期风险级别",
    "riskLevel": "长期风险级别",
}


def _coerce_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _safe_json_text(value: Any, limit: int = 240) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
    else:
        text = json.dumps(value, ensure_ascii=False, default=str)
    if not text:
        return None
    return text if len(text) <= limit else f"{text[: limit - 3]}..."


def _limit(value: int, default: int, maximum: int = 10) -> int:
    if value <= 0:
        return default
    return min(value, maximum)


def _take_unique(items: list[str], limit: int) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()

    for item in items:
        text = item.strip()
        if not text or text in seen:
            continue
        seen.add(text)
        result.append(text)
        if len(result) >= limit:
            break

    return result


def _format_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, list):
        parts = [_coerce_string(item) for item in value]
        filtered = [item for item in parts if item]
        return "、".join(filtered) if filtered else None
    if isinstance(value, dict):
        return None
    return _coerce_string(value)


def _profile_traits(profile_json: dict[str, Any], limit: int = 6) -> list[str]:
    traits: list[str] = []

    for key, value in profile_json.items():
        rendered = _format_value(value)
        if not rendered:
            continue
        label = PROFILE_FIELD_LABELS.get(key, key)
        traits.append(f"{label}：{rendered}")

    return _take_unique(traits, limit=limit)


def _snapshot_summary(record: AgentStateSnapshotRecord) -> str | None:
    result = record.snapshot_json.get("result") if isinstance(record.snapshot_json, dict) else None
    if isinstance(result, dict):
        summary = (
            _coerce_string(result.get("summary"))
            or _coerce_string(result.get("assistantAnswer"))
            or _coerce_string(result.get("title"))
        )
        if summary:
            return summary

        coordinator = result.get("coordinatorSummary")
        if isinstance(coordinator, dict):
            final_conclusion = _coerce_string(coordinator.get("finalConclusion"))
            if final_conclusion:
                return final_conclusion

    return _coerce_string(record.input_summary) or _safe_json_text(record.snapshot_json)


def _consultation_takeaways(consultations: list[AgentStateSnapshotRecord], limit: int = 5) -> list[str]:
    takeaways: list[str] = []

    for record in consultations:
        result = record.snapshot_json.get("result") if isinstance(record.snapshot_json, dict) else None
        if not isinstance(result, dict):
            continue

        summary = _coerce_string(result.get("summary"))
        if summary:
            takeaways.append(f"上次会诊结论：{summary}")

        coordinator = result.get("coordinatorSummary")
        if isinstance(coordinator, dict):
            problem_definition = _coerce_string(coordinator.get("problemDefinition"))
            if problem_definition:
                takeaways.append(f"核心问题：{problem_definition}")

        key_findings = result.get("keyFindings")
        if isinstance(key_findings, list):
            for item in key_findings[:2]:
                finding = _coerce_string(item)
                if finding:
                    takeaways.append(f"关键发现：{finding}")

    return _take_unique(takeaways, limit=limit)


def _open_loops(
    consultations: list[AgentStateSnapshotRecord],
    traces: list[AgentTraceLogRecord],
    limit: int = 5,
) -> list[str]:
    loops: list[str] = []

    for record in consultations:
        result = record.snapshot_json.get("result") if isinstance(record.snapshot_json, dict) else None
        if not isinstance(result, dict):
            continue

        for key, prefix in (
            ("todayInSchoolActions", "园内待继续"),
            ("tonightAtHomeActions", "家庭侧待验证"),
            ("nextCheckpoints", "后续观察点"),
        ):
            value = result.get(key)
            if isinstance(value, list):
                for item in value[:2]:
                    text = _coerce_string(item)
                    if text:
                        loops.append(f"{prefix}：{text}")

        review_in_48h = _coerce_string(result.get("reviewIn48h"))
        if review_in_48h:
            loops.append(f"48小时复查：{review_in_48h}")

    for record in traces:
        if record.status in {"failed", "fallback"}:
            loops.append(f"最近一次 {record.node_name} 走了{record.status}，建议复看本轮闭环输出。")

    return _take_unique(loops, limit=limit)


def _snapshot_signals(records: list[AgentStateSnapshotRecord], limit: int = 6) -> list[str]:
    signals: list[str] = []
    for record in records:
        summary = _snapshot_summary(record)
        if not summary:
            continue
        prefix = "最近会诊" if record.snapshot_type == "consultation-result" else "最近上下文"
        signals.append(f"{prefix}：{summary}")
    return _take_unique(signals, limit=limit)


def _trace_signals(records: list[AgentTraceLogRecord], limit: int = 6) -> list[str]:
    signals: list[str] = []
    for record in records:
        summary = _coerce_string(record.output_summary) or _coerce_string(record.input_summary)
        if not summary:
            continue
        signals.append(f"{record.node_name}：{summary}")
    return _take_unique(signals, limit=limit)


def _score_query_match(query: str, text: str) -> float:
    query_text = query.strip()
    content = text.strip()
    if not query_text or not content:
        return 0.0

    score = SequenceMatcher(a=query_text, b=content).ratio()
    if query_text in content:
        score += 0.5
    return score


def _build_empty_envelope(
    *,
    child_id: str,
    workflow_type: str,
    backend: str,
    degraded: bool = False,
    errors: list[str] | None = None,
) -> MemoryContextEnvelope:
    return MemoryContextEnvelope(
        child_id=child_id,
        workflow_type=workflow_type,
        meta=MemoryContextMeta(
            backend=backend,
            degraded=degraded,
            errors=errors or [],
        ),
    )


def _workflow_snapshot_types(workflow_type: str) -> list[str]:
    if workflow_type == "high-risk-consultation":
        return ["consultation-result", "teacher-agent-result", "parent-follow-up-result"]
    if workflow_type in {"teacher-agent", "teacher-follow-up", "parent-follow-up"}:
        return ["consultation-result", "teacher-agent-result", "parent-follow-up-result", "session-message"]
    if workflow_type == "parent-trend-query":
        return ["consultation-result", "teacher-agent-result", "parent-follow-up-result", "parent-trend-result", "session-message"]
    if workflow_type == "weekly-report":
        return ["consultation-result", "weekly-report-result", "teacher-agent-result", "admin-agent-result"]
    return ["consultation-result", "session-message"]


@dataclass
class MemoryService:
    repositories: RepositoryBundle
    session_memory: SessionMemory
    vector_store: SimpleVectorStore

    async def get_child_profile_memory(self, child_id: str) -> ChildProfileMemoryRecord | None:
        return await self.repositories.get_child_profile_memory(child_id)

    async def upsert_child_profile_memory(
        self,
        child_id: str,
        payload: dict[str, Any],
        source: str = "agent",
    ) -> ChildProfileMemoryRecord:
        record = await self.repositories.upsert_child_profile_memory(child_id, payload, source)
        text = _safe_json_text(payload, limit=600)
        if text:
            self.vector_store.add(
                text,
                metadata={
                    "child_id": child_id,
                    "source_type": "profile",
                    "source_id": record.id,
                    "source": source,
                },
            )
        return record

    async def save_consultation_snapshot(
        self,
        *,
        child_id: str | None = None,
        session_id: str | None = None,
        snapshot_type: str,
        input_summary: str | None = None,
        snapshot_json: dict[str, Any],
    ) -> AgentStateSnapshotRecord:
        record = await self.repositories.save_consultation_snapshot(
            child_id=child_id,
            session_id=session_id,
            snapshot_type=snapshot_type,
            input_summary=input_summary,
            snapshot_json=snapshot_json,
        )
        indexed_text = _safe_json_text(
            {
                "input_summary": input_summary,
                "snapshot_type": snapshot_type,
                "snapshot_json": snapshot_json,
            },
            limit=600,
        )
        if indexed_text:
            self.vector_store.add(
                indexed_text,
                metadata={
                    "child_id": child_id,
                    "session_id": session_id,
                    "source_type": "snapshot",
                    "source_id": record.id,
                    "snapshot_type": snapshot_type,
                },
            )
        return record

    async def get_recent_snapshots(
        self,
        *,
        child_id: str | None = None,
        limit: int = 20,
        snapshot_types: list[str] | None = None,
        session_id: str | None = None,
    ) -> list[AgentStateSnapshotRecord]:
        return await self.repositories.list_recent_snapshots(
            limit=_limit(limit, default=5, maximum=20),
            child_id=child_id,
            session_id=session_id,
            snapshot_types=snapshot_types,
        )

    async def save_agent_trace(
        self,
        *,
        trace_id: str,
        child_id: str | None = None,
        session_id: str | None = None,
        node_name: str,
        action_type: str,
        input_summary: str | None = None,
        output_summary: str | None = None,
        status: str,
        duration_ms: int | None = None,
        metadata_json: dict[str, Any] | None = None,
    ) -> AgentTraceLogRecord:
        record = await self.repositories.save_agent_trace(
            trace_id=trace_id,
            child_id=child_id,
            session_id=session_id,
            node_name=node_name,
            action_type=action_type,
            input_summary=input_summary,
            output_summary=output_summary,
            status=status,
            duration_ms=duration_ms,
            metadata_json=metadata_json,
        )
        indexed_text = _safe_json_text(
            {
                "node_name": node_name,
                "action_type": action_type,
                "input_summary": input_summary,
                "output_summary": output_summary,
                "status": status,
            },
            limit=600,
        )
        if indexed_text:
            self.vector_store.add(
                indexed_text,
                metadata={
                    "child_id": child_id,
                    "session_id": session_id,
                    "source_type": "trace",
                    "source_id": record.id,
                    "trace_id": trace_id,
                    "node_name": node_name,
                },
            )
        return record

    async def get_recent_traces(
        self,
        *,
        limit: int = 20,
        trace_id: str | None = None,
        child_id: str | None = None,
        session_id: str | None = None,
    ) -> list[AgentTraceLogRecord]:
        return await self.repositories.get_recent_traces(
            limit=_limit(limit, default=5, maximum=20),
            trace_id=trace_id,
            child_id=child_id,
            session_id=session_id,
        )

    async def save_agent_run(self, record: dict[str, Any]) -> dict[str, Any]:
        return await self.repositories.save_agent_run(record)

    async def remember(self, session_id: str, message: dict[str, Any]) -> None:
        self.session_memory.append(session_id, message)
        await self.save_consultation_snapshot(
            session_id=session_id,
            snapshot_type="session-message",
            input_summary=str(message.get("content") or message.get("text") or "session message"),
            snapshot_json={"message": message},
        )
        text = str(message.get("content") or message.get("text") or "")
        if text.strip():
            self.vector_store.add(
                text,
                metadata={"session_id": session_id, "source_type": "vector", "source_id": f"session:{session_id}"},
            )

    async def search(self, query: str, limit: int = 5) -> list[dict[str, Any]]:
        return self.vector_store.search(query, limit=limit)

    async def search_memory_context(
        self,
        child_id: str,
        query: str | None = None,
        top_k: int = 5,
        *,
        workflow_type: str | None = None,
        session_id: str | None = None,
    ) -> list[MemorySearchHit]:
        normalized_limit = _limit(top_k, default=5)
        normalized_query = _coerce_string(query) or workflow_type or "持续跟进"
        hits: list[MemorySearchHit] = []

        if normalized_query:
            vector_hits = self.vector_store.search(normalized_query, limit=normalized_limit)
            for item in vector_hits:
                metadata = item.get("metadata") if isinstance(item, dict) else {}
                if not isinstance(metadata, dict):
                    continue
                metadata_child_id = _coerce_string(metadata.get("child_id"))
                metadata_session_id = _coerce_string(metadata.get("session_id"))
                if metadata_child_id and metadata_child_id != child_id:
                    continue
                if session_id and metadata_session_id and metadata_session_id != session_id:
                    continue

                summary = _coerce_string(item.get("text"))
                if not summary:
                    continue
                hits.append(
                    MemorySearchHit(
                        source_type="vector",
                        source_id=_coerce_string(metadata.get("source_id")) or "vector",
                        score=float(item.get("score") or 0.0),
                        summary=summary[:140],
                        excerpt=summary[:240],
                        metadata={k: v for k, v in metadata.items() if v is not None},
                    )
                )

        profile = await self.get_child_profile_memory(child_id)
        snapshots = await self.get_recent_snapshots(
            child_id=child_id,
            limit=max(normalized_limit * 2, 6),
            session_id=session_id,
        )
        traces = await self.get_recent_traces(
            child_id=child_id,
            session_id=session_id,
            limit=max(normalized_limit * 2, 6),
        )

        if profile:
            profile_text = _safe_json_text(profile.profile_json, limit=400)
            if profile_text:
                hits.append(
                    MemorySearchHit(
                        source_type="profile",
                        source_id=profile.id,
                        score=_score_query_match(normalized_query, profile_text),
                        summary="长期画像",
                        excerpt=profile_text,
                        metadata={"updated_at": profile.updated_at.isoformat(), "source": profile.source},
                    )
                )

        for snapshot in snapshots:
            summary = _snapshot_summary(snapshot)
            if not summary:
                continue
            hits.append(
                MemorySearchHit(
                    source_type="snapshot",
                    source_id=snapshot.id,
                    score=_score_query_match(normalized_query, summary),
                    summary=f"{snapshot.snapshot_type}：{summary[:60]}",
                    excerpt=summary[:240],
                    metadata={"snapshot_type": snapshot.snapshot_type, "created_at": snapshot.created_at.isoformat()},
                )
            )

        for trace in traces:
            summary = _coerce_string(trace.output_summary) or _coerce_string(trace.input_summary)
            if not summary:
                continue
            hits.append(
                MemorySearchHit(
                    source_type="trace",
                    source_id=trace.id,
                    score=_score_query_match(normalized_query, summary),
                    summary=f"{trace.node_name}：{summary[:60]}",
                    excerpt=summary[:240],
                    metadata={"status": trace.status, "created_at": trace.created_at.isoformat()},
                )
            )

        hits.sort(key=lambda item: item.score, reverse=True)
        deduped: list[MemorySearchHit] = []
        seen: set[tuple[str, str]] = set()
        for item in hits:
            key = (item.source_type, item.source_id)
            if key in seen:
                continue
            seen.add(key)
            deduped.append(item)
            if len(deduped) >= normalized_limit:
                break

        return deduped

    async def build_memory_context_for_prompt(
        self,
        child_id: str,
        workflow_type: str,
        options: MemoryContextBuildOptions | None = None,
    ) -> MemoryContextEnvelope:
        build_options = options or MemoryContextBuildOptions()
        limit = _limit(build_options.limit, default=5)
        top_k = _limit(build_options.top_k, default=5)
        envelope = _build_empty_envelope(
            child_id=child_id,
            workflow_type=workflow_type,
            backend=self.repositories.backend,
        )
        used_sources: list[str] = []
        errors: list[str] = []

        try:
            profile = await self.get_child_profile_memory(child_id)
            if profile:
                envelope.child_profile = profile
                used_sources.append("child_profile_memory")
        except Exception as error:  # pragma: no cover - defensive fallback
            errors.append(f"child_profile_memory:{type(error).__name__}")

        snapshot_types = build_options.snapshot_types or _workflow_snapshot_types(workflow_type)
        try:
            snapshots = await self.get_recent_snapshots(
                child_id=child_id,
                limit=limit,
                snapshot_types=snapshot_types,
                session_id=build_options.session_id,
            )
            envelope.recent_snapshots = snapshots
            envelope.recent_consultations = [
                item for item in snapshots if item.snapshot_type == "consultation-result"
            ]
            if snapshots:
                used_sources.append("agent_state_snapshots")
        except Exception as error:  # pragma: no cover - defensive fallback
            errors.append(f"agent_state_snapshots:{type(error).__name__}")

        try:
            traces = await self.get_recent_traces(
                child_id=child_id,
                session_id=build_options.session_id,
                limit=limit,
            )
            envelope.relevant_traces = traces
            if traces:
                used_sources.append("agent_trace_log")
        except Exception as error:  # pragma: no cover - defensive fallback
            errors.append(f"agent_trace_log:{type(error).__name__}")

        search_hits: list[MemorySearchHit] = []
        try:
            search_hits = await self.search_memory_context(
                child_id,
                query=build_options.query,
                top_k=top_k,
                workflow_type=workflow_type,
                session_id=build_options.session_id,
            )
            if search_hits:
                used_sources.append("memory_search")
        except RepositoryError as error:  # pragma: no cover - defensive fallback
            errors.append(f"memory_search:{error.code}")
        except Exception as error:  # pragma: no cover - defensive fallback
            errors.append(f"memory_search:{type(error).__name__}")

        profile_traits = _profile_traits(envelope.child_profile.profile_json if envelope.child_profile else {})
        continuity_signals = _take_unique(
            _snapshot_signals(envelope.recent_snapshots)
            + _trace_signals(envelope.relevant_traces)
            + [item.summary for item in search_hits],
            limit=6,
        )
        last_consultation_takeaways = _consultation_takeaways(envelope.recent_consultations)
        open_loops = _open_loops(envelope.recent_consultations, envelope.relevant_traces)

        envelope.prompt_context = MemoryPromptContext(
            long_term_traits=profile_traits,
            recent_continuity_signals=continuity_signals,
            last_consultation_takeaways=last_consultation_takeaways,
            open_loops=open_loops,
        )
        envelope.meta = MemoryContextMeta(
            backend=self.repositories.backend,
            degraded=bool(errors),
            used_sources=_take_unique(used_sources, limit=6),
            errors=errors,
            matched_snapshot_ids=[item.id for item in envelope.recent_snapshots[:limit]],
            matched_trace_ids=[item.id for item in envelope.relevant_traces[:limit]],
            matched_search_sources=[f"{item.source_type}:{item.source_id}" for item in search_hits],
        )
        return envelope
