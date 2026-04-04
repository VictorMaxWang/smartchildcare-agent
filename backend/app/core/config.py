import os
from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_DIR = REPO_ROOT / "backend"
DEFAULT_ENV_FILE_CANDIDATES = (
    BACKEND_DIR / ".env.release",
    REPO_ROOT / ".env.release",
    BACKEND_DIR / ".env",
    REPO_ROOT / ".env",
)


def resolve_repo_path(value: str | Path) -> Path:
    candidate = Path(value).expanduser()
    if not candidate.is_absolute():
        candidate = REPO_ROOT / candidate
    return candidate.resolve()


def resolve_settings_env_files() -> tuple[str, ...]:
    override = (os.getenv("BRAIN_ENV_FILE") or "").strip()
    if override:
        return tuple(str(resolve_repo_path(item.strip())) for item in override.split(",") if item.strip())

    return tuple(str(candidate) for candidate in DEFAULT_ENV_FILE_CANDIDATES if candidate.exists())


class Settings(BaseSettings):
    app_name: str = "SmartChildcare Agent Brain"
    app_version: str = "0.1.0"
    environment: str = "development"
    log_level: str = "INFO"
    api_v1_prefix: str = "/api/v1"

    app_host: str = "0.0.0.0"
    app_port: int = Field(default=8000, validation_alias=AliasChoices("APP_PORT", "PORT"))
    app_debug: bool = True

    allow_origins: str = "http://127.0.0.1:3000,http://localhost:3000"
    enable_mock_provider: bool = True
    brain_provider: str = "mock"
    brain_timeout_ms: int = 20_000
    request_timeout_seconds: float = 20.0

    vivo_app_id: str | None = None
    vivo_app_key: SecretStr | None = None
    vivo_base_url: str = "https://api-ai.vivo.com.cn"
    vivo_llm_model: str = "Volc-DeepSeek-V3.2"
    vivo_ocr_path: str = "/ocr/general_recognition"
    vivo_embedding_model: str = "m3e-base"

    mysql_url: str | None = None
    database_url: str | None = None
    brain_memory_backend: str = "memory"
    brain_memory_sqlite_path: str | None = None

    model_config = SettingsConfigDict(
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        origins: list[str] = []
        seen: set[str] = set()
        for item in self.allow_origins.split(","):
            candidate = item.strip()
            if not candidate or candidate in seen:
                continue
            seen.add(candidate)
            origins.append(candidate)
        return origins

    @property
    def app_env(self) -> str:
        return self.environment

    @property
    def vivo_llm_base_url(self) -> str:
        return f"{self.vivo_base_url.rstrip('/')}/v1"

    @property
    def resolved_mysql_url(self) -> str | None:
        return self.mysql_url or self.database_url

    @property
    def resolved_brain_memory_sqlite_path(self) -> str:
        if self.brain_memory_sqlite_path:
            return str(resolve_repo_path(self.brain_memory_sqlite_path))

        return str((BACKEND_DIR / ".local" / "agent-memory.db").resolve())


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    env_files = resolve_settings_env_files()
    if env_files:
        return Settings(_env_file=env_files)
    return Settings(_env_file=None)
