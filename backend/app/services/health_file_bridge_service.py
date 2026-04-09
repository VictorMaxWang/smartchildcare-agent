from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.providers.vivo_ocr import VivoOcrProvider


DISCLAIMER = (
    "T8 extraction only: this bridge returns structured facts from file metadata and text hints. "
    "It does not perform verified binary OCR, medical diagnosis, daycare action mapping, writeback, or escalation dispatch."
)

FILE_TYPE_PRIORITY: tuple[str, ...] = (
    "recheck-slip",
    "checklist",
    "pdf",
    "report-screenshot",
    "unknown",
)

REPORT_KEYWORDS = (
    "report",
    "lab",
    "result",
    "检验",
    "检查",
    "报告",
)
CHECKLIST_KEYWORDS = (
    "checklist",
    "form",
    "sheet",
    "单",
    "表",
)
RECHECK_KEYWORDS = (
    "recheck",
    "follow-up",
    "follow up",
    "复查",
    "复诊",
    "复测",
    "复检",
)
ALLERGY_KEYWORDS = (
    "allergy",
    "allergic",
    "过敏",
)
MEDICATION_KEYWORDS = (
    "medication",
    "medicine",
    "prescription",
    "antibiotic",
    "nebulizer",
    "用药",
    "药",
    "处方",
    "抗生素",
    "雾化",
)
FEVER_KEYWORDS = (
    "fever",
    "temperature",
    "temp",
    "发热",
    "发烧",
    "体温",
)
ABNORMAL_KEYWORDS = (
    "abnormal",
    "positive",
    "elevated",
    "high",
    "low",
    "异常",
    "偏高",
    "偏低",
    "阳性",
)
FOLLOW_UP_HINT_KEYWORDS = (
    *RECHECK_KEYWORDS,
    "review",
    "复查",
    "随访",
    "明天",
    "tomorrow",
    "48h",
    "48小时",
)
TEMPERATURE_PATTERN = re.compile(r"(?<!\d)(3[5-9](?:\.\d)?)(?:\s*(?:°?\s*[cC]|℃))?")


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _coerce_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_text(value: Any) -> str:
    return (_coerce_string(value) or "").lower()


def _file_value(item: dict[str, Any], camel: str, snake: str) -> Any:
    return item.get(camel) if camel in item else item.get(snake)


def _collect_signals(payload: dict[str, Any], provider_result: dict[str, Any]) -> dict[str, Any]:
    files = payload.get("files") if isinstance(payload.get("files"), list) else []
    file_names = [_coerce_string(_file_value(item, "name", "name")) for item in files if isinstance(item, dict)]
    preview_texts = [
        _coerce_string(_file_value(item, "previewText", "preview_text"))
        for item in files
        if isinstance(item, dict)
    ]
    mime_types = [
        _coerce_string(_file_value(item, "mimeType", "mime_type"))
        for item in files
        if isinstance(item, dict)
    ]
    file_urls = [
        _coerce_string(_file_value(item, "fileUrl", "file_url"))
        for item in files
        if isinstance(item, dict)
    ]
    notes = _coerce_string(payload.get("optionalNotes") or payload.get("optional_notes")) or ""
    provider_text = _coerce_string(provider_result.get("text")) or ""

    haystack = _normalize_text(
        " ".join(
            [
                _coerce_string(payload.get("fileKind") or payload.get("file_kind")) or "",
                *[item for item in file_names if item],
                *[item for item in mime_types if item],
                *[item for item in preview_texts if item],
                *[item for item in file_urls if item],
                notes,
                provider_text,
            ]
        )
    )

    return {
        "files": files,
        "file_names": [item for item in file_names if item],
        "preview_texts": [item for item in preview_texts if item],
        "mime_types": [item for item in mime_types if item],
        "file_urls": [item for item in file_urls if item],
        "notes": notes,
        "provider_text": provider_text,
        "haystack": haystack,
    }


def _has_keyword(haystack: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword.lower() in haystack for keyword in keywords)


def _detect_file_type(payload: dict[str, Any], signals: dict[str, Any]) -> str:
    explicit_kind = _normalize_text(payload.get("fileKind") or payload.get("file_kind"))
    haystack = signals["haystack"]
    files = signals["files"]
    types: set[str] = set()

    for item in files:
        if not isinstance(item, dict):
            continue
        mime_type = _normalize_text(_file_value(item, "mimeType", "mime_type"))
        name = _normalize_text(_file_value(item, "name", "name"))
        if "pdf" in mime_type or name.endswith(".pdf"):
            types.add("pdf")
        elif mime_type.startswith("image/"):
            types.add("report-screenshot")

    if explicit_kind in {"lab-report", "health-note"} or _has_keyword(haystack, REPORT_KEYWORDS):
        types.add("report-screenshot" if "report-screenshot" in types else "pdf" if "pdf" in types else "report-screenshot")
    if explicit_kind in {"discharge-note"} or _has_keyword(haystack, RECHECK_KEYWORDS):
        types.add("recheck-slip")
    if explicit_kind in {"prescription"} or _has_keyword(haystack, CHECKLIST_KEYWORDS):
        types.add("checklist")

    types.discard("unknown")
    if not types:
        return "unknown"
    if len(types) == 1:
        return next(iter(types))
    ordered = [item for item in FILE_TYPE_PRIORITY if item in types]
    return ordered[0] if len(ordered) == 1 else "mixed"


def _extract_temperature_text(haystack: str) -> str | None:
    match = TEMPERATURE_PATTERN.search(haystack)
    if not match:
        return None
    return match.group(1)


def _base_facts(payload: dict[str, Any], signals: dict[str, Any], file_type: str) -> list[dict[str, str]]:
    file_count = len(payload.get("files") or [])
    source_role = payload.get("sourceRole") or payload.get("source_role")
    facts = [
        {
            "label": "File type",
            "detail": f"Detected fileType={file_type} from the uploaded file metadata and text hints.",
            "source": "derived:file-type",
        },
        {
            "label": "Source role",
            "detail": f"Current request came from {source_role}.",
            "source": "request-meta",
        },
        {
            "label": "Extraction mode",
            "detail": (
                f"T8 processed {file_count} file(s) using request-supplied preview text, notes, file names, and mime hints only."
            ),
            "source": "request-meta",
        },
    ]
    if signals["provider_text"]:
        facts.append(
            {
                "label": "Text evidence",
                "detail": "A text hint was available for structured extraction.",
                "source": "ocr:text-fallback",
            }
        )
    return facts


def _signal_facts(haystack: str) -> list[dict[str, str]]:
    facts: list[dict[str, str]] = []
    temperature = _extract_temperature_text(haystack)
    if temperature:
        facts.append(
            {
                "label": "Temperature mention",
                "detail": f"Detected a temperature-like value: {temperature}.",
                "source": "pattern:temperature",
            }
        )
    if _has_keyword(haystack, ALLERGY_KEYWORDS):
        facts.append(
            {
                "label": "Allergy mention",
                "detail": "Detected allergy-related wording in the provided text hints.",
                "source": "pattern:allergy",
            }
        )
    if _has_keyword(haystack, MEDICATION_KEYWORDS):
        facts.append(
            {
                "label": "Medication mention",
                "detail": "Detected medication or prescription-related wording in the provided text hints.",
                "source": "pattern:medication",
            }
        )
    if _has_keyword(haystack, ABNORMAL_KEYWORDS):
        facts.append(
            {
                "label": "Abnormal result wording",
                "detail": "Detected wording that usually appears around abnormal or flagged findings.",
                "source": "pattern:abnormal",
            }
        )
    if _has_keyword(haystack, FOLLOW_UP_HINT_KEYWORDS):
        facts.append(
            {
                "label": "Follow-up wording",
                "detail": "Detected recheck, review, or follow-up wording in the available text hints.",
                "source": "pattern:follow-up",
            }
        )
    return facts


def _risk_items(haystack: str) -> list[dict[str, str]]:
    risks: list[dict[str, str]] = []
    temperature = _extract_temperature_text(haystack)
    if temperature:
        severity = "high" if float(temperature) >= 38 else "medium"
        risks.append(
            {
                "title": "Temperature-related signal needs manual confirmation",
                "severity": severity,
                "detail": "A temperature mention was detected in the uploaded material. Staff should verify the original document and the child's current status before operational use.",
                "source": "pattern:temperature",
            }
        )
    if _has_keyword(haystack, ALLERGY_KEYWORDS):
        risks.append(
            {
                "title": "Potential allergy-related instruction detected",
                "severity": "high",
                "detail": "Allergy wording was detected, but the exact allergen and scope were not independently verified from binary OCR.",
                "source": "pattern:allergy",
            }
        )
    if _has_keyword(haystack, MEDICATION_KEYWORDS):
        risks.append(
            {
                "title": "Medication wording should not be treated as verified administration guidance",
                "severity": "medium",
                "detail": "Prescription or medication wording was detected, but T8 only extracts structure and does not verify dosage, authorization, or daycare execution rules.",
                "source": "pattern:medication",
            }
        )
    if _has_keyword(haystack, ABNORMAL_KEYWORDS):
        risks.append(
            {
                "title": "Abnormal or flagged result wording detected",
                "severity": "medium",
                "detail": "The text hints contain abnormal-result wording that may require review against the original document.",
                "source": "pattern:abnormal",
            }
        )
    if not risks:
        risks.append(
            {
                "title": "Low-confidence extraction from limited text hints",
                "severity": "low",
                "detail": "The current request does not include enough verified text to infer more specific medical facts safely.",
                "source": "fallback:text-hints",
            }
        )
    return risks


def _contraindications(haystack: str) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    if _has_keyword(haystack, ALLERGY_KEYWORDS):
        items.append(
            {
                "title": "Do not assume allergen exposure is acceptable",
                "detail": "Allergy-related wording was detected, so meals, activity materials, or medication exposure should not be inferred as safe from this file alone.",
                "source": "pattern:allergy",
            }
        )
    if _has_keyword(haystack, MEDICATION_KEYWORDS):
        items.append(
            {
                "title": "Do not infer a daycare medication plan from the file alone",
                "detail": "Medication wording was detected, but dosage and administration authority were not verified by binary OCR or writeback flows.",
                "source": "pattern:medication",
            }
        )
    temperature = _extract_temperature_text(haystack)
    if temperature and float(temperature) >= 38:
        items.append(
            {
                "title": "Avoid treating the file as a diagnosis clearance",
                "detail": "A fever-range value was detected. The upload should not be used as proof that normal activity is already cleared.",
                "source": "pattern:temperature",
            }
        )
    return items


def _follow_up_hints(haystack: str, file_type: str) -> list[dict[str, str]]:
    hints: list[dict[str, str]] = []
    if file_type == "recheck-slip" or _has_keyword(haystack, FOLLOW_UP_HINT_KEYWORDS):
        hints.append(
            {
                "title": "Keep the original follow-up timing visible",
                "detail": "The upload appears to contain recheck or follow-up wording. Preserve the original timeline from the source document for later T9/T10 mapping.",
                "source": "pattern:follow-up",
            }
        )
    if _has_keyword(haystack, MEDICATION_KEYWORDS):
        hints.append(
            {
                "title": "Capture the exact medication wording for later review",
                "detail": "If this file is reused downstream, keep the original medication phrasing rather than paraphrasing it into an action prematurely.",
                "source": "pattern:medication",
            }
        )
    if not hints:
        hints.append(
            {
                "title": "Preserve the original file for manual walkthrough",
                "detail": "T8 extracted only structured hints. A later walkthrough should compare these hints against the original screenshot or PDF before mapping actions.",
                "source": "fallback:text-hints",
            }
        )
    return hints


def _dedupe(items: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for item in items:
        value = _coerce_string(item.get(key))
        if not value or value in seen:
            continue
        seen.add(value)
        result.append(item)
    return result


def _confidence(signals: dict[str, Any], facts: list[dict[str, Any]], file_type: str) -> float:
    score = 0.18
    if signals["preview_texts"]:
        score += 0.34
    if signals["notes"]:
        score += 0.14
    if signals["file_urls"]:
        score += 0.08
    if file_type != "unknown":
        score += 0.12
    score += min(len(facts), 5) * 0.04
    if not signals["provider_text"]:
        score -= 0.06
    return round(max(0.1, min(score, 0.92)), 2)


async def run_health_file_bridge(payload: dict[str, Any]) -> dict[str, Any]:
    files = payload.get("files")
    if not isinstance(files, list) or len(files) == 0:
        raise ValueError("files must include at least one file item")

    source_role = _coerce_string(payload.get("sourceRole") or payload.get("source_role"))
    if source_role not in {"parent", "teacher"}:
        raise ValueError("sourceRole must be 'parent' or 'teacher'")

    request_source = _coerce_string(payload.get("requestSource") or payload.get("request_source"))
    if not request_source:
        raise ValueError("requestSource cannot be empty")

    provider = VivoOcrProvider(get_settings())
    provider_result = provider.extract(
        files=files,
        optional_notes=_coerce_string(payload.get("optionalNotes") or payload.get("optional_notes")),
    )
    signals = _collect_signals(payload, provider_result)
    file_type = _detect_file_type(payload, signals)
    facts = _dedupe(
        [*_base_facts(payload, signals, file_type), *_signal_facts(signals["haystack"])],
        "label",
    )
    risks = _dedupe(_risk_items(signals["haystack"]), "title")
    contraindications = _dedupe(_contraindications(signals["haystack"]), "title")
    follow_up_hints = _dedupe(_follow_up_hints(signals["haystack"], file_type), "title")
    confidence = _confidence(signals, facts, file_type)

    return {
        "childId": payload.get("childId") or payload.get("child_id"),
        "sourceRole": source_role,
        "fileKind": payload.get("fileKind") or payload.get("file_kind"),
        "fileType": file_type,
        "summary": "T8 extracted structured health-file hints only. Daycare action mapping remains out of scope for this step.",
        "extractedFacts": facts,
        "riskItems": risks,
        "contraindications": contraindications,
        "followUpHints": follow_up_hints,
        "confidence": confidence,
        "disclaimer": DISCLAIMER,
        "source": "backend-text-fallback",
        "fallback": True,
        "mock": True,
        "liveReadyButNotVerified": bool(provider_result.get("liveReadyButNotVerified")),
        "generatedAt": _iso_now(),
        "provider": str(provider_result.get("provider") or provider.provider_name),
        "model": str(provider_result.get("model") or provider.model_name),
    }
