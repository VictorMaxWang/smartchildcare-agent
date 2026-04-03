from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import get_settings
from app.providers.base import (
    ProviderAuthenticationError,
    ProviderConfigurationError,
    ProviderResponseError,
)
from app.providers.resolver import can_use_vivo_text_provider, resolve_text_provider

DEFAULT_PROMPT = "Please return one concise Chinese sentence for the SmartChildcare vivo LLM smoke test."
DEFAULT_FALLBACK = "smoke fallback triggered"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a direct vivo LLM smoke test without Next.js fallback.")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--strict", dest="strict", action="store_true", help="Require a live vivo result.")
    group.add_argument(
        "--allow-fallback",
        dest="strict",
        action="store_false",
        help="Allow mock fallback when vivo is unavailable.",
    )
    parser.set_defaults(strict=True)
    parser.add_argument("--prompt", default=DEFAULT_PROMPT, help="Prompt sent to the provider.")
    parser.add_argument("--fallback", default=DEFAULT_FALLBACK, help="Fallback text used by the provider.")
    parser.add_argument("--include-raw", action="store_true", help="Include raw upstream JSON in the output.")
    return parser.parse_args()


def build_output(result: Any, *, include_raw: bool) -> dict[str, Any]:
    raw = result.raw if isinstance(result.raw, dict) else {}
    output = {
        "ok": True,
        "provider": result.provider,
        "source": result.source,
        "model": result.model,
        "fallback": result.fallback,
        "request_id": result.request_id,
        "usage": result.usage,
        "meta": result.meta,
        "upstream_markers": {
            "id": raw.get("id"),
            "created": raw.get("created"),
        },
        "content_preview": (result.content or "")[:160],
    }
    if include_raw:
        output["raw"] = raw
    return output


def validate_strict(result: Any) -> tuple[bool, str]:
    raw = result.raw if isinstance(result.raw, dict) else {}
    has_upstream_markers = bool(result.usage) or raw.get("id") is not None or raw.get("created") is not None

    if result.provider != "vivo-llm":
        return False, f"expected provider=vivo-llm, got {result.provider!r}"
    if result.source != "vivo":
        return False, f"expected source=vivo, got {result.source!r}"
    if result.fallback:
        return False, "expected fallback=false"
    if not has_upstream_markers:
        return False, "missing upstream vivo markers such as usage/id/created"
    return True, ""


def main() -> int:
    args = parse_args()
    settings = get_settings().model_copy(update={"enable_mock_provider": False} if args.strict else {})

    if args.strict and not can_use_vivo_text_provider(settings):
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "strict smoke requires BRAIN_PROVIDER=vivo and both VIVO_APP_ID/VIVO_APP_KEY.",
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 1

    provider = resolve_text_provider(settings)

    try:
        result = provider.summarize(prompt=args.prompt, fallback=args.fallback)
    except ProviderConfigurationError as exc:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": str(exc),
                    "kind": "config",
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 1
    except ProviderAuthenticationError as exc:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": str(exc),
                    "kind": "auth",
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 1
    except ProviderResponseError as exc:
        message = str(exc).lower()
        kind = "response"
        if "timeout" in message:
            kind = "timeout"
        elif "network" in message or "connection" in message:
            kind = "network"
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": str(exc),
                    "kind": kind,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 1

    output = build_output(result, include_raw=args.include_raw)
    if args.strict:
        passed, reason = validate_strict(result)
        if not passed:
            output["ok"] = False
            output["error"] = reason
            print(json.dumps(output, ensure_ascii=False, indent=2))
            return 1

    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
