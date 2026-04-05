from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from functools import lru_cache
from time import perf_counter
from typing import Any, AsyncIterator, Awaitable, Callable
from uuid import uuid4

from app.agents.admin_agent import run_admin_agent
from app.agents.high_risk_consultation import (
    run_high_risk_consultation,
    stream_high_risk_consultation as run_high_risk_consultation_stream,
)
from app.agents.parent_agent import run_parent_follow_up, run_parent_suggestions
from app.agents.teacher_agent import run_teacher_agent
from app.core.config import get_settings
from app.db.repositories import (
    RepositoryBundle,
    RepositoryError,
    build_repository_bundle,
    close_repository_bundle,
    reset_repository_bundle_cache,
)
from app.memory.session_memory import SessionMemory
from app.memory.vector_store import SimpleVectorStore
from app.providers.mock import build_mock_diet_evaluation, build_mock_vision_meal
from app.services.memory_service import MemoryService
from app.services.parent_trend_service import run_parent_trend_query
from app.services.react_runner import ReactRunner
from app.services.streaming import encode_sse, mock_agent_stream
from app.schemas.memory import MemoryContextBuildOptions
from app.schemas.react_tools import ReactRunRequest


logger = logging.getLogger(__name__)


Runner = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]


def _create_trace_id(task: str) -> str:
    return f"trace-{task}-{uuid4().hex}"


def _coerce_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _summarize_value(value: Any, limit: int = 480) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
    else:
        text = json.dumps(value, ensure_ascii=False, default=str)
    if not text:
        return None
    return text if len(text) <= limit else f"{text[: limit - 3]}..."


def _extract_child_id(*values: Any) -> str | None:
    keys = ("child_id", "childId", "targetChildId", "target_child_id")
    for value in values:
        if not isinstance(value, dict):
            continue
        for key in keys:
            item = _coerce_string(value.get(key))
            if item:
                return item
        snapshot = value.get("snapshot")
        if isinstance(snapshot, dict):
            child = snapshot.get("child")
            if isinstance(child, dict):
                item = _coerce_string(child.get("id"))
                if item:
                    return item
        visible_children = value.get("visibleChildren")
        if isinstance(visible_children, list):
            for child in visible_children:
                if isinstance(child, dict):
                    item = _coerce_string(child.get("id"))
                    if item:
                        return item
    return None


def _extract_child_ids(value: dict[str, Any], limit: int = 3) -> list[str]:
    child_ids: list[str] = []

    target_child_id = (
        _coerce_string(value.get("targetChildId"))
        or _coerce_string(value.get("childId"))
        or _coerce_string(value.get("child_id"))
    )
    if target_child_id:
        child_ids.append(target_child_id)

    snapshot = value.get("snapshot")
    if isinstance(snapshot, dict):
        child = snapshot.get("child")
        if isinstance(child, dict):
            item = _coerce_string(child.get("id"))
            if item:
                child_ids.append(item)

    visible_children = value.get("visibleChildren")
    if isinstance(visible_children, list):
        for child in visible_children:
            if not isinstance(child, dict):
                continue
            item = _coerce_string(child.get("id"))
            if item:
                child_ids.append(item)

    deduped: list[str] = []
    seen: set[str] = set()
    for item in child_ids:
        if item in seen:
            continue
        seen.add(item)
        deduped.append(item)
        if len(deduped) >= limit:
            break

    return deduped


def _extract_session_id(*values: Any) -> str | None:
    keys = ("session_id", "sessionId", "consultationId", "consultation_id")
    for value in values:
        if not isinstance(value, dict):
            continue
        for key in keys:
            item = _coerce_string(value.get(key))
            if item:
                return item
    return None


def _build_trace_metadata(task: str, payload: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    metadata: dict[str, Any] = {"task": task}

    for source in (result, payload):
        if not isinstance(source, dict):
            continue
        for key in ("workflow", "source", "model", "mode", "title"):
            value = source.get(key)
            if value is not None and key not in metadata:
                metadata[key] = value

    child_id = _extract_child_id(result, payload)
    session_id = _extract_session_id(result, payload)
    if child_id:
        metadata["child_id"] = child_id
    if session_id:
        metadata["session_id"] = session_id

    memory_trace_meta = payload.get("_memory_trace_meta")
    if isinstance(memory_trace_meta, dict):
        metadata.update(memory_trace_meta)

    return metadata


def _extract_memory_meta(payload: dict[str, Any]) -> dict[str, Any]:
    memory_context = payload.get("memory_context")
    if not isinstance(memory_context, dict):
        return {}
    meta = memory_context.get("meta")
    return meta if isinstance(meta, dict) else {}


def _debug_memory_enabled(payload: dict[str, Any]) -> bool:
    explicit = payload.get("debugMemory")
    if isinstance(explicit, bool):
        return explicit
    return get_settings().environment != "production"


def _memory_query(task: str, payload: dict[str, Any]) -> str | None:
    for key in ("question", "teacherNote"):
        value = _coerce_string(payload.get(key))
        if value:
            return value
    if task == "high-risk-consultation":
        return "最近会诊 风险 闭环 家长反馈"
    if task in {"teacher-agent", "parent-follow-up"}:
        return "最近跟进 家长反馈 连续观察"
    if task == "parent-trend-query":
        return "最近儿童趋势 变化 家长问答"
    if task == "weekly-report":
        return "最近重点儿童 风险 闭环 周报"
    return None


@dataclass
class Orchestrator:
    repositories: RepositoryBundle
    memory: MemoryService

    async def _safe_save_trace(self, **kwargs: Any) -> None:
        try:
            await self.memory.save_agent_trace(**kwargs)
        except RepositoryError as error:
            logger.warning("Failed to persist agent trace (%s/%s): %s", error.backend, error.operation, error)

    async def _safe_save_snapshot(self, **kwargs: Any) -> None:
        try:
            await self.memory.save_consultation_snapshot(**kwargs)
        except RepositoryError as error:
            logger.warning("Failed to persist agent snapshot (%s/%s): %s", error.backend, error.operation, error)

    async def _prepare_payload_with_memory(self, task: str, payload: dict[str, Any]) -> dict[str, Any]:
        effective_payload = dict(payload)
        effective_payload["debugMemory"] = _debug_memory_enabled(effective_payload)

        memory_task = task
        workflow = _coerce_string(effective_payload.get("workflow"))
        child_ids: list[str] = []
        if task == "high-risk-consultation":
            child_ids = _extract_child_ids(effective_payload, limit=1)
        elif task == "parent-follow-up":
            child_ids = _extract_child_ids(effective_payload, limit=1)
        elif task == "parent-trend-query":
            child_ids = _extract_child_ids(effective_payload, limit=1)
        elif task == "teacher-agent":
            if workflow == "weekly-summary":
                memory_task = "weekly-report"
                child_ids = _extract_child_ids(effective_payload, limit=3)
            else:
                child_ids = _extract_child_ids(effective_payload, limit=1)
        elif task == "admin-agent" and workflow == "weekly-ops-report":
            memory_task = "weekly-report"
            child_ids = _extract_child_ids(effective_payload, limit=3)
        elif task == "weekly-report":
            child_ids = _extract_child_ids(effective_payload, limit=3)

        if not child_ids:
            effective_payload["_memory_trace_meta"] = {
                "memory_context_used": False,
                "memory_context_count": 0,
                "memory_context_backend": self.repositories.backend,
            }
            return effective_payload

        memory_contexts = []
        for child_id in child_ids:
            context = await self.memory.build_memory_context_for_prompt(
                child_id,
                memory_task,
                MemoryContextBuildOptions(
                    limit=5,
                    top_k=5,
                    query=_memory_query(memory_task, effective_payload),
                    session_id=_extract_session_id(effective_payload),
                ),
            )
            memory_contexts.append(context.model_dump(mode="json"))

        primary_context = memory_contexts[0]
        effective_payload["memory_context"] = primary_context
        if len(memory_contexts) > 1:
            effective_payload["memory_contexts"] = memory_contexts

        used_sources = primary_context.get("meta", {}).get("used_sources", []) if isinstance(primary_context, dict) else []
        degraded = any(
            isinstance(context, dict) and isinstance(context.get("meta"), dict) and bool(context["meta"].get("degraded"))
            for context in memory_contexts
        )
        effective_payload["_memory_trace_meta"] = {
            "memory_context_used": True,
            "memory_context_count": len(memory_contexts),
            "memory_context_child_ids": child_ids,
            "memory_context_backend": self.repositories.backend,
            "memory_context_degraded": degraded,
            "memory_used_sources": used_sources,
        }
        return effective_payload

    async def _run_with_trace(
        self,
        *,
        task: str,
        payload: dict[str, Any],
        runner: Runner,
        node_name: str,
        snapshot_type: str | None = None,
    ) -> dict[str, Any]:
        effective_payload = await self._prepare_payload_with_memory(task, payload)
        trace_id = _coerce_string(effective_payload.get("trace_id")) or _coerce_string(effective_payload.get("traceId")) or _create_trace_id(task)
        started_at = perf_counter()

        try:
            result = await runner(effective_payload)
        except Exception as error:
            duration_ms = max(0, int((perf_counter() - started_at) * 1000))
            await self._safe_save_trace(
                trace_id=trace_id,
                child_id=_extract_child_id(effective_payload),
                session_id=_extract_session_id(effective_payload),
                node_name=node_name,
                action_type=task,
                input_summary=_summarize_value(effective_payload),
                output_summary=_summarize_value({"error": str(error), "type": type(error).__name__}),
                status="failed",
                duration_ms=duration_ms,
                metadata_json={
                    "task": task,
                    "error_type": type(error).__name__,
                    **(effective_payload.get("_memory_trace_meta") if isinstance(effective_payload.get("_memory_trace_meta"), dict) else {}),
                },
            )
            raise

        duration_ms = max(0, int((perf_counter() - started_at) * 1000))
        child_id = _extract_child_id(result, effective_payload)
        session_id = _extract_session_id(result, effective_payload)

        if effective_payload.get("debugMemory") and isinstance(result, dict):
            memory_meta = result.get("memoryMeta")
            if isinstance(memory_meta, dict):
                result = {
                    **result,
                    "memoryMeta": {
                        **memory_meta,
                        **(effective_payload.get("_memory_trace_meta") if isinstance(effective_payload.get("_memory_trace_meta"), dict) else {}),
                    },
                }
            else:
                result = {
                    **result,
                    "memoryMeta": effective_payload.get("_memory_trace_meta"),
                }

        await self._safe_save_trace(
            trace_id=trace_id,
            child_id=child_id,
            session_id=session_id,
            node_name=node_name,
            action_type=task,
            input_summary=_summarize_value(effective_payload),
            output_summary=_summarize_value(result),
            status="succeeded",
            duration_ms=duration_ms,
            metadata_json=_build_trace_metadata(task, effective_payload, result),
        )

        if snapshot_type and (child_id or session_id):
            await self._safe_save_snapshot(
                child_id=child_id,
                session_id=session_id,
                snapshot_type=snapshot_type,
                input_summary=_summarize_value(effective_payload),
                snapshot_json={"task": task, "traceId": trace_id, "result": result},
            )

        return result

    async def parent_suggestions(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._run_with_trace(
            task="parent-suggestions",
            payload=payload,
            runner=run_parent_suggestions,
            node_name="parent-suggestions",
        )

    async def parent_follow_up(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._run_with_trace(
            task="parent-follow-up",
            payload=payload,
            runner=run_parent_follow_up,
            node_name="parent-follow-up",
            snapshot_type="parent-follow-up-result",
        )

    async def parent_trend_query(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._run_with_trace(
            task="parent-trend-query",
            payload=payload,
            runner=run_parent_trend_query,
            node_name="parent-trend-query",
            snapshot_type="parent-trend-result",
        )

    async def teacher_run(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._run_with_trace(
            task="teacher-agent",
            payload=payload,
            runner=run_teacher_agent,
            node_name="teacher-agent",
            snapshot_type="teacher-agent-result",
        )

    async def admin_run(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._run_with_trace(
            task="admin-agent",
            payload=payload,
            runner=run_admin_agent,
            node_name="admin-agent",
            snapshot_type="admin-agent-result",
        )

    async def weekly_report(self, payload: dict[str, Any]) -> dict[str, Any]:
        weekly_payload = {**payload, "workflow": "weekly-ops-report"}
        return await self._run_with_trace(
            task="weekly-report",
            payload=weekly_payload,
            runner=run_admin_agent,
            node_name="weekly-report",
            snapshot_type="weekly-report-result",
        )

    async def high_risk_consultation(self, payload: dict[str, Any]) -> dict[str, Any]:
        return await self._run_with_trace(
            task="high-risk-consultation",
            payload=payload,
            runner=run_high_risk_consultation,
            node_name="high-risk-consultation",
            snapshot_type="consultation-result",
        )

    async def stream_high_risk_consultation(self, payload: dict[str, Any]) -> AsyncIterator[str]:
        trace_id = (
            _coerce_string(payload.get("trace_id"))
            or _coerce_string(payload.get("traceId"))
            or _create_trace_id("high-risk-consultation")
        )
        started_at = perf_counter()

        async def event_source() -> AsyncIterator[str]:
            effective_payload = dict(payload)
            child_id = _extract_child_id(effective_payload)
            session_id = _extract_session_id(effective_payload)
            final_result: dict[str, Any] | None = None

            try:
                # Force an immediate frame so proxy/TLS smoke checks can prove the
                # stream is alive before memory hydration and provider work finish.
                yield ": stream-open\n\n"
                effective_payload = await self._prepare_payload_with_memory("high-risk-consultation", effective_payload)
                child_id = _extract_child_id(effective_payload)
                session_id = _extract_session_id(effective_payload)
                async for event, data in run_high_risk_consultation_stream(effective_payload, trace_id):
                    if event == "done":
                        result = data.get("result")
                        if isinstance(result, dict):
                            final_result = result
                            child_id = _extract_child_id(result, effective_payload)
                            session_id = _extract_session_id(result, effective_payload)
                            duration_ms = max(0, int((perf_counter() - started_at) * 1000))
                            await self._safe_save_trace(
                                trace_id=trace_id,
                                child_id=child_id,
                                session_id=session_id,
                                node_name="high-risk-consultation",
                                action_type="high-risk-consultation",
                                input_summary=_summarize_value(effective_payload),
                                output_summary=_summarize_value(result),
                                status="succeeded",
                                duration_ms=duration_ms,
                                metadata_json=_build_trace_metadata("high-risk-consultation", effective_payload, result),
                            )
                            if child_id or session_id:
                                await self._safe_save_snapshot(
                                    child_id=child_id,
                                    session_id=session_id,
                                    snapshot_type="consultation-result",
                                    input_summary=_summarize_value(effective_payload),
                                    snapshot_json={
                                        "task": "high-risk-consultation",
                                        "traceId": trace_id,
                                        "result": result,
                                    },
                                )
                    yield encode_sse(event, data)
            except Exception as error:
                duration_ms = max(0, int((perf_counter() - started_at) * 1000))
                await self._safe_save_trace(
                    trace_id=trace_id,
                    child_id=child_id,
                    session_id=session_id,
                    node_name="high-risk-consultation",
                    action_type="high-risk-consultation",
                    input_summary=_summarize_value(effective_payload),
                    output_summary=_summarize_value({"error": type(error).__name__}),
                    status="failed",
                    duration_ms=duration_ms,
                    metadata_json={
                        "task": "high-risk-consultation",
                        "error_type": type(error).__name__,
                        **(
                            effective_payload.get("_memory_trace_meta")
                            if isinstance(effective_payload.get("_memory_trace_meta"), dict)
                            else {}
                        ),
                    },
                )
                yield encode_sse(
                    "error",
                    {
                        "traceId": trace_id,
                        "message": "high-risk consultation stream failed",
                        "errorType": type(error).__name__,
                    },
                )
                yield encode_sse(
                    "done",
                    {
                        "traceId": trace_id,
                        "result": final_result,
                        "memoryMeta": _extract_memory_meta(effective_payload),
                        "realProvider": False,
                        "fallback": True,
                    },
                )

        return event_source()

    async def vision_meal(self, payload: dict[str, Any]) -> dict[str, Any]:
        trace_id = _coerce_string(payload.get("trace_id")) or _coerce_string(payload.get("traceId")) or _create_trace_id("vision-meal")
        started_at = perf_counter()
        result = build_mock_vision_meal(payload)
        duration_ms = max(0, int((perf_counter() - started_at) * 1000))
        await self._safe_save_trace(
            trace_id=trace_id,
            child_id=_extract_child_id(payload),
            session_id=_extract_session_id(payload),
            node_name="vision-meal",
            action_type="vision-meal",
            input_summary=_summarize_value(payload),
            output_summary=_summarize_value(result.output),
            status="succeeded",
            duration_ms=duration_ms,
            metadata_json={"task": "vision-meal", "source": result.mode, "model": result.model},
        )
        return {"foods": result.output, "source": result.mode, "model": result.model}

    async def diet_evaluation(self, payload: dict[str, Any]) -> dict[str, Any]:
        trace_id = _coerce_string(payload.get("trace_id")) or _coerce_string(payload.get("traceId")) or _create_trace_id("diet-evaluation")
        started_at = perf_counter()
        result = build_mock_diet_evaluation(payload)
        duration_ms = max(0, int((perf_counter() - started_at) * 1000))
        await self._safe_save_trace(
            trace_id=trace_id,
            child_id=_extract_child_id(payload),
            session_id=_extract_session_id(payload),
            node_name="diet-evaluation",
            action_type="diet-evaluation",
            input_summary=_summarize_value(payload),
            output_summary=_summarize_value(result),
            status="succeeded",
            duration_ms=duration_ms,
            metadata_json={"task": "diet-evaluation", "source": result.get("source"), "model": result.get("model")},
        )
        return result

    async def react_run(self, payload: dict[str, Any]) -> dict[str, Any]:
        request = ReactRunRequest.model_validate(payload)
        runner = ReactRunner(repositories=self.repositories, memory=self.memory)
        result = await runner.run(request)
        return result.model_dump(mode="json", by_alias=True)

    async def stream_agent(self, task: str, payload: dict[str, Any]):
        return mock_agent_stream(task, payload)


@lru_cache(maxsize=1)
def _get_shared_session_memory() -> SessionMemory:
    return SessionMemory()


@lru_cache(maxsize=1)
def _get_shared_vector_store() -> SimpleVectorStore:
    return SimpleVectorStore()


@lru_cache(maxsize=1)
def _get_shared_memory_service() -> MemoryService:
    repositories = build_repository_bundle()
    return MemoryService(
        repositories=repositories,
        session_memory=_get_shared_session_memory(),
        vector_store=_get_shared_vector_store(),
    )


def build_orchestrator() -> Orchestrator:
    repositories = build_repository_bundle()
    return Orchestrator(repositories=repositories, memory=_get_shared_memory_service())


def build_memory_service() -> MemoryService:
    return _get_shared_memory_service()


def reset_orchestrator_runtime() -> None:
    reset_repository_bundle_cache()
    _get_shared_session_memory.cache_clear()
    _get_shared_vector_store.cache_clear()
    _get_shared_memory_service.cache_clear()


async def shutdown_orchestrator_runtime() -> None:
    try:
        await close_repository_bundle()
    finally:
        reset_orchestrator_runtime()
