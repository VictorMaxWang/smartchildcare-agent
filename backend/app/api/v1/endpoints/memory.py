from __future__ import annotations

from fastapi import APIRouter, Depends

from app.schemas.memory import MemoryContextBuildRequest
from app.services.memory_service import MemoryService
from app.services.orchestrator import build_memory_service

router = APIRouter(tags=["memory"])


def get_memory_service() -> MemoryService:
    return build_memory_service()


@router.post("/memory/context")
async def build_memory_context(
    payload: MemoryContextBuildRequest,
    memory_service: MemoryService = Depends(get_memory_service),
):
    return await memory_service.build_memory_context_for_prompt(
        payload.child_id,
        payload.workflow_type,
        payload.options,
    )
