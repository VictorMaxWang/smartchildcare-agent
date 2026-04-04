from __future__ import annotations

from uuid import uuid4

from app.core.config import Settings
from app.providers.base import AsrProviderInput, AsrTranscription, ProviderResult


def _normalize_text(value: str | None) -> str:
    return (value or "").strip()


def _build_mock_transcript(input: AsrProviderInput) -> str:
    transcript = _normalize_text(input.fallback_text)
    if transcript:
        return transcript

    attachment_name = _normalize_text(input.attachment_name) or "teacher-voice-note.webm"
    return (
        f"{attachment_name} 转写结果：小朋友今天午睡前情绪波动，"
        "老师需要记录体温、饮水和离园后的家庭观察反馈。"
    )


def _build_meta(input: AsrProviderInput, *, reason: str) -> dict[str, object]:
    return {
        "attachment_name": input.attachment_name,
        "mime_type": input.mime_type,
        "duration_ms": input.duration_ms,
        "scene": input.scene,
        "language": input.language,
        "reason": reason,
    }


class MockAsrProvider:
    provider_name = "mock-asr"

    def transcribe(self, input: AsrProviderInput) -> ProviderResult[AsrTranscription]:
        transcript = _normalize_text(input.transcript)
        request_id = uuid4().hex
        if transcript:
            return ProviderResult(
                provider=self.provider_name,
                mode="mock",
                source="provided_transcript",
                request_id=request_id,
                output=AsrTranscription(
                    transcript=transcript,
                    confidence=None,
                    meta=_build_meta(input, reason="provided-transcript"),
                    raw={"path": "provided_transcript"},
                    fallback=False,
                ),
            )

        mock_transcript = _build_mock_transcript(input)
        return ProviderResult(
            provider=self.provider_name,
            mode="mock",
            source="mock",
            request_id=request_id,
            output=AsrTranscription(
                transcript=mock_transcript,
                confidence=0.62,
                meta=_build_meta(input, reason="mock-transcript"),
                raw={"path": "mock-fallback"},
                fallback=True,
            ),
        )


class VivoAsrProvider:
    provider_name = "vivo-asr-stub"

    def __init__(self, settings: Settings):
        self.settings = settings

    def transcribe(self, input: AsrProviderInput) -> ProviderResult[AsrTranscription]:
        transcript = _normalize_text(input.transcript)
        request_id = uuid4().hex
        if transcript:
            return ProviderResult(
                provider=self.provider_name,
                mode="mock",
                source="provided_transcript",
                request_id=request_id,
                output=AsrTranscription(
                    transcript=transcript,
                    confidence=None,
                    meta=_build_meta(input, reason="provided-transcript"),
                    raw={"path": "provided_transcript"},
                    fallback=False,
                ),
            )

        mock_transcript = _build_mock_transcript(input)
        return ProviderResult(
            provider=self.provider_name,
            mode="mock",
            source="mock",
            model="vivo-asr-stub",
            request_id=request_id,
            output=AsrTranscription(
                transcript=mock_transcript,
                confidence=0.66,
                meta={
                    **_build_meta(input, reason="official-doc-transport-pending"),
                    "official_doc_required": True,
                },
                raw={"path": "official-doc-transport-pending"},
                fallback=True,
            ),
        )
