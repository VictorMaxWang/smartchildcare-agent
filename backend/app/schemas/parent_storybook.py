from __future__ import annotations

from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


def _to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part[:1].upper() + part[1:] for part in parts[1:])


JsonDict = dict[str, Any]
ParentStoryBookMode = Literal["storybook", "card"]
ParentStoryBookRequestMode = Literal["storybook", "card", "auto"]
ParentStoryBookResultSource = Literal["ai", "fallback", "mock", "rule", "vivo"]
ParentStoryBookMediaStatus = Literal["ready", "mock", "fallback", "empty"]
ParentStoryBookHighlightKind = Literal[
    "todayGrowth",
    "warningSuggestion",
    "consultationSummary",
    "consultationAction",
    "guardianFeedback",
    "weeklyTrend",
]


class ParentStoryBookModel(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True, extra="ignore")


class ParentStoryBookHighlightCandidate(ParentStoryBookModel):
    kind: ParentStoryBookHighlightKind
    title: str
    detail: str
    priority: int = 1
    source: str | None = None


class ParentStoryBookProviderMeta(ParentStoryBookModel):
    provider: str
    mode: str
    transport: str | None = None
    image_provider: str
    audio_provider: str
    request_source: str | None = None
    fallback_reason: str | None = None
    real_provider: bool = False
    highlight_count: int = 0
    scene_count: int = 0


class ParentStoryBookScene(ParentStoryBookModel):
    scene_index: int
    scene_title: str
    scene_text: str
    image_prompt: str
    image_url: str | None = None
    asset_ref: str | None = None
    image_status: ParentStoryBookMediaStatus
    audio_url: str | None = None
    audio_ref: str | None = None
    audio_script: str
    audio_status: ParentStoryBookMediaStatus
    voice_style: str
    highlight_source: str


class ParentStoryBookRequest(ParentStoryBookModel):
    child_id: str | None = Field(default=None, validation_alias=AliasChoices("childId", "child_id"))
    story_mode: ParentStoryBookRequestMode | None = Field(
        default=None,
        validation_alias=AliasChoices("storyMode", "story_mode"),
    )
    request_source: str | None = Field(
        default=None,
        validation_alias=AliasChoices("requestSource", "request_source"),
    )
    snapshot: JsonDict
    highlight_candidates: list[ParentStoryBookHighlightCandidate] = Field(
        default_factory=list,
        validation_alias=AliasChoices("highlightCandidates", "highlight_candidates"),
    )
    latest_intervention_card: JsonDict | None = Field(
        default=None,
        validation_alias=AliasChoices("latestInterventionCard", "latest_intervention_card"),
    )
    latest_consultation: JsonDict | None = Field(
        default=None,
        validation_alias=AliasChoices("latestConsultation", "latest_consultation"),
    )
    trace_id: str | None = Field(default=None, validation_alias=AliasChoices("traceId", "trace_id"))
    debug_memory: bool = Field(default=False, validation_alias=AliasChoices("debugMemory", "debug_memory"))


class ParentStoryBookResponse(ParentStoryBookModel):
    story_id: str
    child_id: str
    mode: ParentStoryBookMode
    title: str
    summary: str
    moral: str
    parent_note: str
    source: ParentStoryBookResultSource
    fallback: bool = False
    fallback_reason: str | None = None
    generated_at: str
    provider_meta: ParentStoryBookProviderMeta
    scenes: list[ParentStoryBookScene] = Field(default_factory=list)
