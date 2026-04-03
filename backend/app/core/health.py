from __future__ import annotations

from app.core.config import Settings
from app.db.repositories import build_repository_bundle
from app.providers.resolver import has_vivo_text_provider_config
from app.schemas.common import HealthResponse


def resolve_provider_modes(settings: Settings) -> dict[str, str]:
    llm_mode = "vivo" if settings.brain_provider.lower() == "vivo" and has_vivo_text_provider_config(settings) else "mock"
    return {
        "llm": llm_mode,
        "ocr": "mock",
        "asr": "mock",
        "tts": "mock",
    }


def build_health_response(settings: Settings) -> HealthResponse:
    repositories = build_repository_bundle()
    return HealthResponse(
        service=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
        providers=resolve_provider_modes(settings),
        configured_memory_backend=repositories.configured_backend,
        memory_backend=repositories.backend,
        degraded=repositories.degraded,
        degradation_reasons=list(repositories.errors),
        vivo_configured=has_vivo_text_provider_config(settings),
    )
