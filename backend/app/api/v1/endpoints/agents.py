from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.schemas.parent_message import ParentMessageReflexionRequest, ParentMessageReflexionResponse
from app.schemas.parent_storybook import ParentStoryBookRequest, ParentStoryBookResponse
from app.schemas.parent_trend import ParentTrendQueryRequest, ParentTrendQueryResponse
from app.schemas.react_tools import ReactRunRequest, ReactRunResponse
from app.services.orchestrator import Orchestrator, build_orchestrator

router = APIRouter(tags=["agents"])


def get_orchestrator() -> Orchestrator:
    return build_orchestrator()


@router.post("/agents/parent/suggestions")
async def parent_suggestions(payload: dict[str, Any], orchestrator: Orchestrator = Depends(get_orchestrator)):
    return await orchestrator.parent_suggestions(payload)


@router.post("/agents/parent/follow-up")
async def parent_follow_up(payload: dict[str, Any], orchestrator: Orchestrator = Depends(get_orchestrator)):
    return await orchestrator.parent_follow_up(payload)


@router.post("/agents/parent/message-reflexion", response_model=ParentMessageReflexionResponse)
async def parent_message_reflexion(
    payload: ParentMessageReflexionRequest,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    try:
        result = await orchestrator.parent_message_reflexion(payload.model_dump(mode="json", by_alias=True))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return ParentMessageReflexionResponse.model_validate(result)


@router.post("/agents/parent/trend-query", response_model=ParentTrendQueryResponse)
async def parent_trend_query(
    payload: ParentTrendQueryRequest,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    try:
        result = await orchestrator.parent_trend_query(payload.model_dump(mode="json", by_alias=True))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return ParentTrendQueryResponse.model_validate(result)


@router.post("/agents/parent/storybook", response_model=ParentStoryBookResponse)
async def parent_storybook(
    payload: ParentStoryBookRequest,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    try:
        result = await orchestrator.parent_storybook(payload.model_dump(mode="json", by_alias=True))
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return ParentStoryBookResponse.model_validate(result)


@router.post("/agents/teacher/run")
async def teacher_run(payload: dict[str, Any], orchestrator: Orchestrator = Depends(get_orchestrator)):
    return await orchestrator.teacher_run(payload)


@router.post("/agents/admin/run")
async def admin_run(payload: dict[str, Any], orchestrator: Orchestrator = Depends(get_orchestrator)):
    return await orchestrator.admin_run(payload)


@router.post("/agents/react/run", response_model=ReactRunResponse)
async def react_run(payload: ReactRunRequest, orchestrator: Orchestrator = Depends(get_orchestrator)):
    result = await orchestrator.react_run(payload.model_dump(mode="json", by_alias=True))
    return ReactRunResponse.model_validate(result)


@router.post("/agents/reports/weekly")
async def weekly_report(payload: dict[str, Any], orchestrator: Orchestrator = Depends(get_orchestrator)):
    return await orchestrator.weekly_report(payload)


@router.post("/agents/consultations/high-risk")
async def high_risk_consultation(
    payload: dict[str, Any],
    request: Request,
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    accept = request.headers.get("accept", "").lower()
    if "text/event-stream" in accept:
        stream = await orchestrator.stream_high_risk_consultation(payload)
        return StreamingResponse(
            stream,
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
    return await orchestrator.high_risk_consultation(payload)


@router.post("/agents/consultations/high-risk/stream")
async def high_risk_consultation_stream(
    payload: dict[str, Any],
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    stream = await orchestrator.stream_high_risk_consultation(payload)
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/agents/consultations/high-risk/feed")
async def high_risk_consultation_feed(
    limit: int = Query(default=10, ge=1, le=50),
    child_id: str | None = Query(default=None),
    risk_level: str | None = Query(default=None),
    status: str | None = Query(default=None),
    owner_name: str | None = Query(default=None),
    escalated_only: bool = Query(default=False),
    orchestrator: Orchestrator = Depends(get_orchestrator),
):
    return await orchestrator.high_risk_consultation_feed(
        limit=limit,
        child_id=child_id,
        risk_level=risk_level,
        status=status,
        owner_name=owner_name,
        escalated_only=escalated_only,
    )
