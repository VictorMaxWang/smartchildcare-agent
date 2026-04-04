from __future__ import annotations

from pathlib import Path

from app.core import config as config_module
from app.core.config import REPO_ROOT, Settings, get_settings, resolve_repo_path, resolve_settings_env_files


def test_resolve_settings_env_files_prefers_release_then_env(tmp_path, monkeypatch):
    release_file = tmp_path / "backend.env.release"
    env_file = tmp_path / "backend.env"
    ignored_file = tmp_path / "missing.env"
    release_file.write_text("APP_NAME=Release Brain\n", encoding="utf-8")
    env_file.write_text("APP_NAME=Local Brain\n", encoding="utf-8")

    monkeypatch.delenv("BRAIN_ENV_FILE", raising=False)
    monkeypatch.setattr(
        config_module,
        "DEFAULT_ENV_FILE_CANDIDATES",
        (release_file, ignored_file, env_file),
    )

    assert resolve_settings_env_files() == (str(release_file), str(env_file))


def test_brain_env_file_override_is_honored(tmp_path, monkeypatch):
    env_file = tmp_path / "custom.release.env"
    env_file.write_text("APP_NAME=Custom Release Brain\n", encoding="utf-8")
    monkeypatch.setenv("BRAIN_ENV_FILE", str(env_file))
    get_settings.cache_clear()

    try:
        settings = get_settings()
        assert settings.app_name == "Custom Release Brain"
    finally:
        get_settings.cache_clear()


def test_os_env_overrides_release_file(tmp_path, monkeypatch):
    env_file = tmp_path / "custom.release.env"
    env_file.write_text("APP_NAME=File Value\n", encoding="utf-8")
    monkeypatch.setenv("BRAIN_ENV_FILE", str(env_file))
    monkeypatch.setenv("APP_NAME", "Env Value")
    get_settings.cache_clear()

    try:
        settings = get_settings()
        assert settings.app_name == "Env Value"
    finally:
        get_settings.cache_clear()


def test_relative_sqlite_path_resolves_from_repo_root():
    settings = Settings(_env_file=None, brain_memory_sqlite_path="backend/.local/test-runtime.db")

    assert Path(settings.resolved_brain_memory_sqlite_path) == REPO_ROOT / "backend" / ".local" / "test-runtime.db"
    assert resolve_repo_path("backend/.local/test-runtime.db") == REPO_ROOT / "backend" / ".local" / "test-runtime.db"


def test_cors_origins_are_trimmed_and_deduplicated():
    settings = Settings(
        _env_file=None,
        allow_origins=" https://a.example.com,https://b.example.com,https://a.example.com ,, ",
    )

    assert settings.cors_origins == ["https://a.example.com", "https://b.example.com"]
