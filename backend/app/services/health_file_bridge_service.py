from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal


DISCLAIMER = (
    "T7 skeleton: this bridge turns external health file context into daycare actions only. "
    "It does not perform verified OCR, diagnosis, writeback, or escalation dispatch."
)

RuleBucket = Literal[
    "fever_or_temperature",
    "allergy_or_medication",
    "recheck_or_follow_up",
    "generic_unknown",
]

BUCKET_PRIORITY: tuple[RuleBucket, ...] = (
    "allergy_or_medication",
    "fever_or_temperature",
    "recheck_or_follow_up",
    "generic_unknown",
)

FEVER_KEYWORDS = (
    "fever",
    "temperature",
    "temp",
    "38.",
    "37.",
    "\u53d1\u70ed",
    "\u53d1\u70e7",
    "\u4f53\u6e29",
    "\u9000\u70ed",
)

ALLERGY_OR_MEDICATION_KEYWORDS = (
    "allergy",
    "medication",
    "medicine",
    "prescription",
    "antibiotic",
    "nebulizer",
    "\u8fc7\u654f",
    "\u7528\u836f",
    "\u836f\u7269",
    "\u5904\u65b9",
    "\u6297\u751f\u7d20",
    "\u96fe\u5316",
)

FOLLOW_UP_KEYWORDS = (
    "follow-up",
    "follow up",
    "followup",
    "recheck",
    "review",
    "revisit",
    "\u590d\u67e5",
    "\u590d\u8bca",
    "\u590d\u6d4b",
    "\u968f\u8bbf",
    "\u89c2\u5bdf",
    "\u8ffd\u8e2a",
)


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


def _collect_signals(payload: dict[str, Any]) -> dict[str, Any]:
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
    notes = _coerce_string(payload.get("optionalNotes") or payload.get("optional_notes")) or ""

    haystack = _normalize_text(
        " ".join(
            [
                _coerce_string(payload.get("fileKind") or payload.get("file_kind")) or "",
                *[item for item in file_names if item],
                *[item for item in preview_texts if item],
                *[item for item in mime_types if item],
                notes,
            ]
        )
    )

    return {
        "file_names": [item for item in file_names if item],
        "preview_texts": [item for item in preview_texts if item],
        "notes": notes,
        "haystack": haystack,
    }


def _has_keyword(haystack: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword.lower() in haystack for keyword in keywords)


def _detect_buckets(haystack: str) -> list[RuleBucket]:
    buckets: set[RuleBucket] = set()

    if _has_keyword(haystack, FEVER_KEYWORDS):
        buckets.add("fever_or_temperature")
    if _has_keyword(haystack, ALLERGY_OR_MEDICATION_KEYWORDS):
        buckets.add("allergy_or_medication")
    if _has_keyword(haystack, FOLLOW_UP_KEYWORDS):
        buckets.add("recheck_or_follow_up")
    if not buckets:
        buckets.add("generic_unknown")

    return [bucket for bucket in BUCKET_PRIORITY if bucket in buckets]


def _base_facts(payload: dict[str, Any]) -> list[dict[str, str]]:
    file_count = len(payload.get("files") or [])
    return [
        {
            "label": "Bridge mode",
            "detail": f"T7 skeleton received {file_count} external health file(s) for daycare action bridging.",
            "source": "request-meta",
        },
        {
            "label": "Source role",
            "detail": f"Current request came from {payload.get('sourceRole') or payload.get('source_role')}.",
            "source": "request-meta",
        },
        {
            "label": "Binary processing",
            "detail": "This run uses file metadata and optional text hints only. Real OCR/PDF parsing is not executed in T7.",
            "source": "request-meta",
        },
    ]


def _bucket_facts(bucket: RuleBucket, signals: dict[str, Any]) -> list[dict[str, str]]:
    if bucket == "fever_or_temperature":
        return [
            {
                "label": "Temperature signal",
                "detail": "The external file context mentions fever or temperature-related information that should be rechecked in daycare.",
                "source": "rule:fever_or_temperature",
            }
        ]
    if bucket == "allergy_or_medication":
        return [
            {
                "label": "Allergy or medication signal",
                "detail": "The external file context appears to include allergy or medication-related information that staff should review before routine care.",
                "source": "rule:allergy_or_medication",
            }
        ]
    if bucket == "recheck_or_follow_up":
        return [
            {
                "label": "Follow-up signal",
                "detail": "The external file context mentions recheck or follow-up instructions that should be bridged into daycare reminders.",
                "source": "rule:recheck_or_follow_up",
            }
        ]
    return [
        {
            "label": "Manual bridge needed",
            "detail": (
                "A teacher should manually extract the key actionable points from the provided notes before using them inside daycare."
                if signals.get("notes") or signals.get("preview_texts")
                else "Only file metadata is currently available, so a teacher should manually confirm the key actionable points from the original file."
            ),
            "source": "rule:generic_unknown",
        }
    ]


def _bucket_risk(bucket: RuleBucket) -> dict[str, str]:
    if bucket == "fever_or_temperature":
        return {
            "title": "Need same-day health recheck in daycare",
            "severity": "medium",
            "detail": "This is a bridge reminder only. Teachers should recheck the child status in daycare instead of treating the external file as a diagnosis.",
            "source": "rule:fever_or_temperature",
        }
    if bucket == "allergy_or_medication":
        return {
            "title": "Need teacher review before routine care",
            "severity": "high",
            "detail": "Potential allergy or medication instructions should be confirmed by staff before meals, activity, or nap routines.",
            "source": "rule:allergy_or_medication",
        }
    if bucket == "recheck_or_follow_up":
        return {
            "title": "Need follow-up reminder alignment",
            "severity": "medium",
            "detail": "The external file suggests a follow-up timeline that should be bridged into daycare reminders and parent handoff.",
            "source": "rule:recheck_or_follow_up",
        }
    return {
        "title": "Need manual interpretation by teacher",
        "severity": "low",
        "detail": "The current T7 skeleton cannot interpret the original file content automatically, so a teacher should confirm the actionable points first.",
        "source": "rule:generic_unknown",
    }


def _bucket_school_action(bucket: RuleBucket) -> dict[str, str]:
    if bucket == "fever_or_temperature":
        return {
            "title": "Recheck temperature and energy level after arrival",
            "detail": "Record the same-day observation in a teacher note and keep the activity plan conservative until the child status looks stable.",
            "ownerRole": "teacher",
            "timing": "today at arrival",
            "source": "rule:fever_or_temperature",
        }
    if bucket == "allergy_or_medication":
        return {
            "title": "Review allergy or medication instructions with the care team",
            "detail": "Confirm meal, medication, and classroom precautions before daily routines continue.",
            "ownerRole": "teacher",
            "timing": "before meals and routine care",
            "source": "rule:allergy_or_medication",
        }
    if bucket == "recheck_or_follow_up":
        return {
            "title": "Create a same-day reminder for the follow-up point",
            "detail": "Bridge the external recheck note into a daycare reminder so teachers know what to observe today.",
            "ownerRole": "teacher",
            "timing": "today before pickup",
            "source": "rule:recheck_or_follow_up",
        }
    return {
        "title": "Teacher manually summarizes the external file into a daycare note",
        "detail": "Capture only observable and actionable items; do not copy the file as a diagnosis conclusion.",
        "ownerRole": "teacher",
        "timing": "today before action planning",
        "source": "rule:generic_unknown",
    }


def _bucket_family_action(bucket: RuleBucket) -> dict[str, str]:
    if bucket == "fever_or_temperature":
        return {
            "title": "Keep one short evening status update for pickup handoff",
            "detail": "Parents should record temperature or visible status changes tonight so the daycare team can compare next-day observations.",
            "ownerRole": "family",
            "timing": "tonight",
            "source": "rule:fever_or_temperature",
        }
    if bucket == "allergy_or_medication":
        return {
            "title": "Prepare the exact medication or allergy wording for tomorrow handoff",
            "detail": "Parents should bring or restate the relevant instruction so teachers do not rely on memory alone.",
            "ownerRole": "family",
            "timing": "tonight",
            "source": "rule:allergy_or_medication",
        }
    if bucket == "recheck_or_follow_up":
        return {
            "title": "Keep the follow-up timing visible for tomorrow handoff",
            "detail": "Parents should note what needs to be rechecked and when, so the daycare plan matches the external advice.",
            "ownerRole": "family",
            "timing": "tonight",
            "source": "rule:recheck_or_follow_up",
        }
    return {
        "title": "Add one manual summary sentence for the daycare team",
        "detail": "Parents should write the single most actionable point from the external file instead of sending only the file itself.",
        "ownerRole": "family",
        "timing": "tonight",
        "source": "rule:generic_unknown",
    }


def _bucket_follow_up(bucket: RuleBucket) -> dict[str, str]:
    if bucket == "fever_or_temperature":
        return {
            "title": "Compare tonight status with next-day daycare observation",
            "detail": "Use the next handoff to confirm whether the temperature-related concern still needs closer monitoring.",
            "ownerRole": "teacher",
            "due": "next morning handoff",
            "source": "rule:fever_or_temperature",
        }
    if bucket == "allergy_or_medication":
        return {
            "title": "Confirm classroom precautions were followed",
            "detail": "Review whether the care team and family used the same allergy or medication instruction wording.",
            "ownerRole": "teacher",
            "due": "next care cycle",
            "source": "rule:allergy_or_medication",
        }
    if bucket == "recheck_or_follow_up":
        return {
            "title": "Check that the follow-up milestone was not missed",
            "detail": "Bridge the external recheck date into the next daycare review point.",
            "ownerRole": "teacher",
            "due": "next scheduled review",
            "source": "rule:recheck_or_follow_up",
        }
    return {
        "title": "Confirm the core actionable point with the family",
        "detail": "Before using the external file in a daycare plan, verify the one action that teachers should actually take.",
        "ownerRole": "teacher",
        "due": "next family handoff",
        "source": "rule:generic_unknown",
    }


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


def _build_escalation_suggestion(buckets: list[RuleBucket]) -> dict[str, Any]:
    if "allergy_or_medication" in buckets:
        return {
            "shouldEscalate": True,
            "level": "school-health-review",
            "reason": "Potential allergy or medication instructions usually need a same-day staff review before routine care.",
            "nextStep": "Ask the responsible teacher or school health contact to confirm the actionable precautions.",
            "source": "rule:allergy_or_medication",
        }
    if "fever_or_temperature" in buckets or "recheck_or_follow_up" in buckets:
        return {
            "shouldEscalate": True,
            "level": "teacher-review",
            "reason": "The external file adds same-day monitoring or follow-up information that should be acknowledged by the teacher team.",
            "nextStep": "Bridge the note into a teacher review item instead of assuming the external file has already been acted on.",
            "source": "rule:fever_or_temperature" if "fever_or_temperature" in buckets else "rule:recheck_or_follow_up",
        }
    return {
        "shouldEscalate": False,
        "level": "none",
        "reason": "The current input does not justify escalation beyond a teacher-side manual review in T7.",
        "nextStep": "Keep this as a bridge note and confirm the actionable point with the family.",
        "source": "rule:generic_unknown",
    }


def _build_writeback_suggestion(
    payload: dict[str, Any],
    facts: list[dict[str, Any]],
    risks: list[dict[str, Any]],
) -> dict[str, Any]:
    files = payload.get("files") if isinstance(payload.get("files"), list) else []
    return {
        "shouldWriteback": True,
        "destination": "teacher-health-note-draft",
        "summary": "Create a draft daycare note with the external-file facts, bridge risks, and same-day actions. Do not auto-write it in T7.",
        "payload": {
            "childId": payload.get("childId") or payload.get("child_id"),
            "sourceRole": payload.get("sourceRole") or payload.get("source_role"),
            "fileKind": payload.get("fileKind") or payload.get("file_kind"),
            "fileNames": [_file_value(item, "name", "name") for item in files if isinstance(item, dict)],
            "extractedFactLabels": [item.get("label") for item in facts],
            "riskTitles": [item.get("title") for item in risks],
        },
        "source": "rule:writeback-draft",
        "status": "placeholder",
    }


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

    signals = _collect_signals(payload)
    buckets = _detect_buckets(signals["haystack"])

    facts = _dedupe(
        [*_base_facts(payload), *[fact for bucket in buckets for fact in _bucket_facts(bucket, signals)]],
        "label",
    )
    risks = _dedupe([_bucket_risk(bucket) for bucket in buckets], "title")
    school_actions = _dedupe([_bucket_school_action(bucket) for bucket in buckets], "title")
    family_actions = _dedupe([_bucket_family_action(bucket) for bucket in buckets], "title")
    follow_up_plan = _dedupe([_bucket_follow_up(bucket) for bucket in buckets], "title")
    escalation_suggestion = _build_escalation_suggestion(buckets)
    writeback_suggestion = _build_writeback_suggestion(payload, facts, risks)

    return {
        "childId": payload.get("childId") or payload.get("child_id"),
        "sourceRole": source_role,
        "fileKind": payload.get("fileKind") or payload.get("file_kind"),
        "summary": (
            "T7 skeleton bridged external health file context into daycare actions. "
            "Teachers still need to manually review the original file before using the suggestions operationally."
        ),
        "extractedFacts": facts,
        "riskItems": risks,
        "schoolTodayActions": school_actions,
        "familyTonightActions": family_actions,
        "followUpPlan": follow_up_plan,
        "escalationSuggestion": escalation_suggestion,
        "writebackSuggestion": writeback_suggestion,
        "disclaimer": DISCLAIMER,
        "source": "backend-rule",
        "fallback": False,
        "mock": True,
        "liveReadyButNotVerified": True,
        "generatedAt": _iso_now(),
        "provider": "health-file-bridge-rule",
        "model": "t7-health-file-bridge-skeleton",
    }
