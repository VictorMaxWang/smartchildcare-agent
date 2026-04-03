from __future__ import annotations

import time
from uuid import uuid4

import requests

from app.core.config import Settings
from app.providers.base import (
    ProviderAuthenticationError,
    ProviderConfigurationError,
    ProviderResponseError,
    ProviderTextResult,
)
from app.providers.mock import MockTextProvider

DEFAULT_SYSTEM_PROMPT = "You are the SmartChildcare AI assistant. Respond in concise, actionable Chinese for a mobile UI."


class VivoLlmProviderError(RuntimeError):
    """Raised when the vivo LLM provider cannot satisfy a request safely."""


class VivoLlmProvider:
    provider_name = "vivo-llm"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._mock_provider = MockTextProvider()

    def _request_id(self) -> str:
        return uuid4().hex

    def _require_credentials(self) -> tuple[str, str]:
        app_id = (self.settings.vivo_app_id or "").strip()
        app_key = self.settings.vivo_app_key.get_secret_value().strip() if self.settings.vivo_app_key else ""
        if not app_id or not app_key:
            raise ProviderConfigurationError("VIVO_APP_ID and VIVO_APP_KEY are required for vivo text requests")
        return app_id, app_key

    def _fallback(
        self,
        *,
        fallback: str,
        request_id: str,
        reason: str,
        status_code: int | None = None,
        raw: dict | None = None,
        latency_ms: int | None = None,
    ) -> ProviderTextResult:
        if not self.settings.enable_mock_provider:
            raise ProviderResponseError(f"Vivo LLM request failed: {reason}")

        result = self._mock_provider.summarize(prompt="", fallback=fallback)
        result.provider = self.provider_name
        result.source = "mock"
        result.fallback = True
        result.request_id = request_id
        result.meta = {
            "reason": reason,
            "status_code": status_code,
            "latency_ms": latency_ms,
            "attempted_provider": self.provider_name,
            "attempted_model": self.settings.vivo_llm_model,
        }
        result.raw = raw
        return result

    def summarize(self, prompt: str, fallback: str) -> ProviderTextResult:
        _app_id, app_key = self._require_credentials()
        request_id = self._request_id()
        started_at = time.perf_counter()

        try:
            response = requests.post(
                f"{self.settings.vivo_llm_base_url.rstrip('/')}/chat/completions",
                params={"requestId": request_id},
                headers={
                    "Authorization": f"Bearer {app_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.settings.vivo_llm_model,
                    "stream": False,
                    "messages": [
                        {"role": "system", "content": DEFAULT_SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                },
                timeout=self.settings.request_timeout_seconds,
            )
        except requests.Timeout:
            return self._fallback(
                fallback=fallback,
                request_id=request_id,
                reason="timeout",
                latency_ms=self._latency_ms(started_at),
            )
        except requests.RequestException as error:
            return self._fallback(
                fallback=fallback,
                request_id=request_id,
                reason=type(error).__name__.lower(),
                latency_ms=self._latency_ms(started_at),
            )

        if response.status_code in {401, 403}:
            raise ProviderAuthenticationError(f"Vivo LLM authentication failed with status {response.status_code}")
        if response.status_code == 429:
            return self._fallback(
                fallback=fallback,
                request_id=request_id,
                reason="rate-limited",
                status_code=response.status_code,
                latency_ms=self._latency_ms(started_at),
            )
        if response.status_code >= 500:
            return self._fallback(
                fallback=fallback,
                request_id=request_id,
                reason="upstream-server-error",
                status_code=response.status_code,
                latency_ms=self._latency_ms(started_at),
            )
        if response.status_code >= 400:
            raise ProviderResponseError(f"Vivo LLM request failed with status {response.status_code}")

        try:
            payload = response.json()
        except Exception as error:  # pragma: no cover - defensive path
            return self._fallback(
                fallback=fallback,
                request_id=request_id,
                reason=type(error).__name__.lower(),
                latency_ms=self._latency_ms(started_at),
            )

        choices = payload.get("choices") if isinstance(payload, dict) else None
        first_choice = choices[0] if isinstance(choices, list) and choices else {}
        message = first_choice.get("message") if isinstance(first_choice, dict) else {}
        content = message.get("content") if isinstance(message, dict) else None
        text = self._extract_text_content(content)
        if not text:
            return self._fallback(
                fallback=fallback,
                request_id=request_id,
                reason="empty-content",
                raw=payload if isinstance(payload, dict) else None,
                latency_ms=self._latency_ms(started_at),
            )

        return ProviderTextResult(
            text=text,
            content=text,
            source="vivo",
            model=str(payload.get("model") or self.settings.vivo_llm_model),
            provider=self.provider_name,
            usage=payload.get("usage") if isinstance(payload, dict) else None,
            meta={
                "finish_reason": first_choice.get("finish_reason") if isinstance(first_choice, dict) else None,
                "status_code": response.status_code,
                "latency_ms": self._latency_ms(started_at),
                "upstream_id": payload.get("id") if isinstance(payload, dict) else None,
                "created": payload.get("created") if isinstance(payload, dict) else None,
                "tool_call_count": len(message.get("tool_calls", [])) if isinstance(message, dict) and isinstance(message.get("tool_calls"), list) else 0,
            },
            raw=payload if isinstance(payload, dict) else None,
            fallback=False,
            request_id=request_id,
        )

    @staticmethod
    def _extract_text_content(content: object) -> str:
        if isinstance(content, str):
            return content.strip()
        if not isinstance(content, list):
            return ""

        parts: list[str] = []
        for item in content:
            if isinstance(item, str) and item.strip():
                parts.append(item.strip())
                continue
            if not isinstance(item, dict):
                continue
            text_value = item.get("text")
            if isinstance(text_value, str) and text_value.strip():
                parts.append(text_value.strip())
                continue
            if isinstance(text_value, dict):
                nested_value = text_value.get("value")
                if isinstance(nested_value, str) and nested_value.strip():
                    parts.append(nested_value.strip())

        return "\n".join(parts).strip()

    @staticmethod
    def _latency_ms(started_at: float) -> int:
        return int((time.perf_counter() - started_at) * 1000)
