from __future__ import annotations

import requests
import pytest
from pydantic import SecretStr

from app.core.config import Settings
from app.providers.base import (
    ProviderAuthenticationError,
    ProviderConfigurationError,
    ProviderResponseError,
)
from app.providers.mock import MockTextProvider
from app.providers.resolver import resolve_text_provider
from app.providers.vivo_llm import VivoLlmProvider


class FakeResponse:
    def __init__(self, status_code: int, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


def build_settings(**overrides) -> Settings:
    defaults = {
        "brain_provider": "vivo",
        "enable_mock_provider": False,
        "request_timeout_seconds": 15,
        "vivo_app_id": "app-id",
        "vivo_app_key": SecretStr("app-key"),
        "vivo_llm_model": "Volc-DeepSeek-V3.2",
    }
    defaults.update(overrides)
    return Settings(**defaults)


def test_vivo_llm_success(monkeypatch):
    def fake_post(url, **kwargs):
        assert url == "https://api-ai.vivo.com.cn/v1/chat/completions"
        assert kwargs["params"]["requestId"]
        assert kwargs["headers"]["Authorization"] == "Bearer app-key"
        assert kwargs["json"]["model"] == "Volc-DeepSeek-V3.2"
        assert kwargs["json"]["stream"] is False
        return FakeResponse(
            200,
            {
                "id": "chatcmpl-vivo-123",
                "created": 1712300000,
                "model": "Volc-DeepSeek-V3.2",
                "usage": {"prompt_tokens": 12, "completion_tokens": 18, "total_tokens": 30},
                "choices": [
                    {
                        "finish_reason": "stop",
                        "message": {"content": "Real vivo response."},
                    }
                ],
            },
        )

    monkeypatch.setattr(requests, "post", fake_post)

    result = VivoLlmProvider(build_settings()).summarize(prompt="test", fallback="fallback")

    assert result.provider == "vivo-llm"
    assert result.source == "vivo"
    assert result.fallback is False
    assert result.text == "Real vivo response."
    assert result.content == result.text
    assert result.usage == {"prompt_tokens": 12, "completion_tokens": 18, "total_tokens": 30}
    assert result.meta["finish_reason"] == "stop"
    assert result.meta["upstream_id"] == "chatcmpl-vivo-123"
    assert result.meta["created"] == 1712300000
    assert result.raw["id"] == "chatcmpl-vivo-123"
    assert result.request_id


def test_vivo_llm_authentication_failure_does_not_fallback(monkeypatch):
    monkeypatch.setattr(requests, "post", lambda *args, **kwargs: FakeResponse(401, {"error": "unauthorized"}))

    with pytest.raises(ProviderAuthenticationError):
        VivoLlmProvider(build_settings(enable_mock_provider=True)).summarize(prompt="test", fallback="fallback")


def test_vivo_llm_server_error_falls_back_when_enabled(monkeypatch):
    monkeypatch.setattr(requests, "post", lambda *args, **kwargs: FakeResponse(503, {"error": "unavailable"}))

    result = VivoLlmProvider(build_settings(enable_mock_provider=True)).summarize(prompt="test", fallback="fallback")

    assert result.provider == "vivo-llm"
    assert result.source == "mock"
    assert result.fallback is True
    assert result.text == "fallback"
    assert result.meta["reason"] == "upstream-server-error"
    assert result.meta["status_code"] == 503
    assert result.meta["attempted_provider"] == "vivo-llm"
    assert result.request_id


def test_vivo_llm_rate_limit_falls_back_when_enabled(monkeypatch):
    monkeypatch.setattr(requests, "post", lambda *args, **kwargs: FakeResponse(429, {"error": "limited"}))

    result = VivoLlmProvider(build_settings(enable_mock_provider=True)).summarize(prompt="test", fallback="fallback")

    assert result.source == "mock"
    assert result.fallback is True
    assert result.meta["reason"] == "rate-limited"
    assert result.meta["status_code"] == 429


def test_vivo_llm_timeout_falls_back_when_enabled(monkeypatch):
    def fake_post(*args, **kwargs):
        raise requests.Timeout("request timed out")

    monkeypatch.setattr(requests, "post", fake_post)

    result = VivoLlmProvider(build_settings(enable_mock_provider=True)).summarize(prompt="test", fallback="fallback")

    assert result.provider == "vivo-llm"
    assert result.source == "mock"
    assert result.fallback is True
    assert result.meta["reason"] == "timeout"


def test_vivo_llm_missing_configuration_raises():
    provider = VivoLlmProvider(build_settings(vivo_app_id=None))

    with pytest.raises(ProviderConfigurationError):
        provider.summarize(prompt="test", fallback="fallback")


def test_resolve_text_provider_prefers_vivo_only_with_full_config():
    provider = resolve_text_provider(build_settings())
    assert isinstance(provider, VivoLlmProvider)

    fallback_provider = resolve_text_provider(build_settings(vivo_app_key=None))
    assert isinstance(fallback_provider, MockTextProvider)


def test_resolve_text_provider_prefer_vivo_overrides_default_brain_provider():
    provider = resolve_text_provider(build_settings(brain_provider="mock"), prefer_vivo=True)
    assert isinstance(provider, VivoLlmProvider)


def test_vivo_llm_empty_content_falls_back_with_raw_payload(monkeypatch):
    monkeypatch.setattr(
        requests,
        "post",
        lambda *args, **kwargs: FakeResponse(
            200,
            {
                "id": "chatcmpl-vivo-empty",
                "created": 1712301111,
                "choices": [{"message": {"content": ""}, "finish_reason": "stop"}],
            },
        ),
    )

    result = VivoLlmProvider(build_settings(enable_mock_provider=True)).summarize(prompt="test", fallback="fallback")

    assert result.source == "mock"
    assert result.fallback is True
    assert result.meta["reason"] == "empty-content"
    assert result.raw["id"] == "chatcmpl-vivo-empty"


def test_vivo_llm_server_error_raises_when_mock_disabled(monkeypatch):
    monkeypatch.setattr(requests, "post", lambda *args, **kwargs: FakeResponse(503, {"error": "unavailable"}))

    with pytest.raises(ProviderResponseError):
        VivoLlmProvider(build_settings(enable_mock_provider=False)).summarize(prompt="test", fallback="fallback")
