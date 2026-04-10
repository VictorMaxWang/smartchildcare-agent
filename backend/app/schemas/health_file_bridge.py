from __future__ import annotations

from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


def _to_camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part[:1].upper() + part[1:] for part in parts[1:])


JsonDict = dict[str, Any]
HealthFileBridgeSourceRole = Literal["parent", "teacher"]
HealthFileBridgeSource = Literal["backend-text-fallback", "next-local-extractor"]
HealthFileBridgeRiskLevel = Literal["low", "medium", "high"]
HealthFileBridgeFileType = Literal[
    "report-screenshot",
    "pdf",
    "checklist",
    "recheck-slip",
    "mixed",
    "unknown",
]
HealthFileBridgeEscalationLevel = Literal["routine", "heightened", "same-day-review"]


class HealthFileBridgeModel(BaseModel):
    model_config = ConfigDict(alias_generator=_to_camel, populate_by_name=True, extra="ignore")


class HealthFileBridgeFile(HealthFileBridgeModel):
    file_id: str | None = Field(default=None, validation_alias=AliasChoices("fileId", "file_id"))
    name: str
    mime_type: str | None = Field(default=None, validation_alias=AliasChoices("mimeType", "mime_type"))
    size_bytes: int | None = Field(default=None, validation_alias=AliasChoices("sizeBytes", "size_bytes"))
    page_count: int | None = Field(default=None, validation_alias=AliasChoices("pageCount", "page_count"))
    file_url: str | None = Field(default=None, validation_alias=AliasChoices("fileUrl", "file_url"))
    preview_text: str | None = Field(default=None, validation_alias=AliasChoices("previewText", "preview_text"))
    meta: JsonDict = Field(default_factory=dict)


class HealthFileBridgeRequest(HealthFileBridgeModel):
    child_id: str | None = Field(default=None, validation_alias=AliasChoices("childId", "child_id"))
    source_role: HealthFileBridgeSourceRole = Field(
        validation_alias=AliasChoices("sourceRole", "source_role")
    )
    files: list[HealthFileBridgeFile] = Field(default_factory=list, min_length=1)
    file_kind: str | None = Field(default=None, validation_alias=AliasChoices("fileKind", "file_kind"))
    request_source: str = Field(validation_alias=AliasChoices("requestSource", "request_source"))
    optional_notes: str | None = Field(default=None, validation_alias=AliasChoices("optionalNotes", "optional_notes"))
    trace_id: str | None = Field(default=None, validation_alias=AliasChoices("traceId", "trace_id"))
    debug_memory: bool = Field(default=False, validation_alias=AliasChoices("debugMemory", "debug_memory"))


class HealthFileBridgeFact(HealthFileBridgeModel):
    label: str
    detail: str
    source: str


class HealthFileBridgeRiskItem(HealthFileBridgeModel):
    title: str
    severity: HealthFileBridgeRiskLevel
    detail: str
    source: str


class HealthFileBridgeContraindication(HealthFileBridgeModel):
    title: str
    detail: str
    source: str


class HealthFileBridgeFollowUpHint(HealthFileBridgeModel):
    title: str
    detail: str
    source: str


class HealthFileBridgeActionItem(HealthFileBridgeModel):
    title: str
    detail: str
    source: str
    based_on: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("basedOn", "based_on"),
    )


class HealthFileBridgeEscalationSuggestion(HealthFileBridgeModel):
    should_upgrade_attention: bool = Field(
        validation_alias=AliasChoices("shouldUpgradeAttention", "should_upgrade_attention")
    )
    level: HealthFileBridgeEscalationLevel
    reason: str


class HealthFileBridgeActionMapping(HealthFileBridgeModel):
    school_today_actions: list[HealthFileBridgeActionItem] = Field(
        default_factory=list,
        validation_alias=AliasChoices("schoolTodayActions", "school_today_actions"),
    )
    family_tonight_actions: list[HealthFileBridgeActionItem] = Field(
        default_factory=list,
        validation_alias=AliasChoices("familyTonightActions", "family_tonight_actions"),
    )
    follow_up_plan: list[HealthFileBridgeActionItem] = Field(
        default_factory=list,
        validation_alias=AliasChoices("followUpPlan", "follow_up_plan"),
    )
    escalation_suggestion: HealthFileBridgeEscalationSuggestion = Field(
        validation_alias=AliasChoices("escalationSuggestion", "escalation_suggestion")
    )
    teacher_draft_hint: str = Field(
        validation_alias=AliasChoices("teacherDraftHint", "teacher_draft_hint")
    )
    parent_communication_draft_hint: str = Field(
        validation_alias=AliasChoices(
            "parentCommunicationDraftHint", "parent_communication_draft_hint"
        )
    )


class HealthFileBridgeResponse(HealthFileBridgeModel):
    child_id: str | None = Field(default=None, validation_alias=AliasChoices("childId", "child_id"))
    source_role: HealthFileBridgeSourceRole = Field(
        validation_alias=AliasChoices("sourceRole", "source_role")
    )
    file_kind: str | None = Field(default=None, validation_alias=AliasChoices("fileKind", "file_kind"))
    file_type: HealthFileBridgeFileType = Field(
        validation_alias=AliasChoices("fileType", "file_type")
    )
    summary: str
    extracted_facts: list[HealthFileBridgeFact] = Field(
        default_factory=list,
        validation_alias=AliasChoices("extractedFacts", "extracted_facts"),
    )
    risk_items: list[HealthFileBridgeRiskItem] = Field(
        default_factory=list,
        validation_alias=AliasChoices("riskItems", "risk_items"),
    )
    contraindications: list[HealthFileBridgeContraindication] = Field(default_factory=list)
    follow_up_hints: list[HealthFileBridgeFollowUpHint] = Field(
        default_factory=list,
        validation_alias=AliasChoices("followUpHints", "follow_up_hints"),
    )
    action_mapping: HealthFileBridgeActionMapping | None = Field(
        default=None,
        validation_alias=AliasChoices("actionMapping", "action_mapping"),
    )
    confidence: float
    disclaimer: str
    source: HealthFileBridgeSource
    fallback: bool = False
    mock: bool = True
    live_ready_but_not_verified: bool = Field(
        validation_alias=AliasChoices("liveReadyButNotVerified", "live_ready_but_not_verified")
    )
    generated_at: str = Field(validation_alias=AliasChoices("generatedAt", "generated_at"))
    provider: str | None = None
    model: str | None = None
