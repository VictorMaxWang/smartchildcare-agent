from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


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
        env_file=("backend/.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [item.strip() for item in self.allow_origins.split(",") if item.strip()]

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
            return self.brain_memory_sqlite_path

        repo_root = Path(__file__).resolve().parents[3]
        return str(repo_root / "backend" / ".local" / "agent-memory.db")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
