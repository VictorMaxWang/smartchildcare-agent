import asyncio

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.db.repositories import reset_repository_bundle_cache
from app.main import app
from app.services.orchestrator import build_memory_service, reset_orchestrator_runtime


client = TestClient(app)


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


def test_memory_context_endpoint_returns_prompt_context(tmp_path, monkeypatch):
    sqlite_path = tmp_path / "memory-endpoint.db"
    configure_memory_backend(monkeypatch, backend="sqlite", sqlite_path=str(sqlite_path))

    memory = build_memory_service()
    asyncio.run(
        memory.upsert_child_profile_memory(
            "child-1",
            {
                "nickname": "child-one",
                "temperament": "needs calm transitions before group play",
            },
            source="teacher-agent",
        )
    )
    asyncio.run(
        memory.save_consultation_snapshot(
            child_id="child-1",
            session_id="consult-1",
            snapshot_type="consultation-result",
            input_summary="high risk consultation",
            snapshot_json={
                "result": {
                    "summary": "watch hydration again tonight",
                    "tonightAtHomeActions": ["record hydration tonight"],
                    "nextCheckpoints": ["check the feedback tomorrow morning"],
                }
            },
        )
    )

    response = client.post(
        "/api/v1/memory/context",
        json={
            "child_id": "child-1",
            "workflow_type": "high-risk-consultation",
            "options": {"query": "hydration tonight", "limit": 5, "top_k": 5},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["child_id"] == "child-1"
    assert body["prompt_context"]["long_term_traits"]
    assert body["prompt_context"]["open_loops"]
