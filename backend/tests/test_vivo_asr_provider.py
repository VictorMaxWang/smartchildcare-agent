from __future__ import annotations

from pydantic import SecretStr

from app.core.config import Settings
from app.providers.base import AsrProviderInput
from app.providers.resolver import resolve_asr_provider
from app.providers.vivo_asr import MockAsrProvider, VivoAsrProvider


def build_settings(**overrides) -> Settings:
    defaults = {
        "brain_provider": "vivo",
        "enable_mock_provider": True,
        "request_timeout_seconds": 15,
    }
    defaults.update(overrides)
    return Settings(**defaults)


def test_resolve_asr_provider_without_vivo_credentials_uses_mock():
    provider = resolve_asr_provider(build_settings(vivo_app_id=None, vivo_app_key=None), prefer_vivo=True)
    assert isinstance(provider, MockAsrProvider)

    result = provider.transcribe(
        AsrProviderInput(
            attachment_name="voice.webm",
            mime_type="audio/webm",
            duration_ms=12000,
            scene="teacher-global-fab",
        )
    )

    assert result.provider == "mock-asr"
    assert result.mode == "mock"
    assert result.source == "mock"
    assert result.output.transcript
    assert result.output.fallback is True


def test_resolve_asr_provider_with_vivo_credentials_uses_stub_provider():
    provider = resolve_asr_provider(
        build_settings(vivo_app_id="app-id", vivo_app_key=SecretStr("app-key")),
        prefer_vivo=True,
    )
    assert isinstance(provider, VivoAsrProvider)

    result = provider.transcribe(AsrProviderInput(transcript="小明今天体温37.6度，需要继续观察。"))

    assert result.provider == "vivo-asr-stub"
    assert result.source == "provided_transcript"
    assert result.output.transcript == "小明今天体温37.6度，需要继续观察。"
    assert result.output.fallback is False


def test_vivo_asr_stub_never_leaks_secret_values_in_meta_or_raw():
    provider = VivoAsrProvider(build_settings(vivo_app_id="real-id", vivo_app_key=SecretStr("real-key")))
    result = provider.transcribe(
        AsrProviderInput(
            attachment_name="voice.webm",
            mime_type="audio/webm",
            duration_ms=9000,
            scene="teacher-global-fab",
        )
    )

    serialized_meta = str(result.output.meta)
    serialized_raw = str(result.output.raw)
    assert "real-key" not in serialized_meta
    assert "real-key" not in serialized_raw
    assert result.output.meta["reason"] == "official-doc-transport-pending"
