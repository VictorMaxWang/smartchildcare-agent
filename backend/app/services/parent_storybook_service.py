from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.config import get_settings
from app.providers.story_audio_provider import resolve_story_audio_provider
from app.providers.story_image_provider import resolve_story_image_provider


def _payload_get(payload: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in payload:
            return payload.get(key)
    return None


def _coerce_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_text(value: Any) -> str:
    return " ".join(_coerce_text(value).split())


def _stable_hash(seed: str) -> str:
    return hashlib.sha1(seed.encode("utf-8")).hexdigest()[:12]


def _stable_timestamp(seed: str) -> str:
    base = datetime(2026, 4, 7, 12, 0, 0, tzinfo=UTC)
    offset_seconds = int(_stable_hash(seed), 16) % (24 * 60 * 60)
    return (base + timedelta(seconds=offset_seconds)).isoformat().replace("+00:00", "Z")


def _build_fallback_highlights(snapshot: dict[str, Any]) -> list[dict[str, Any]]:
    fallback_items = snapshot.get("ruleFallback")
    if not isinstance(fallback_items, list):
        return []

    results: list[dict[str, Any]] = []
    for index, item in enumerate(fallback_items, start=1):
        if not isinstance(item, dict):
            continue
        detail = _normalize_text(item.get("description") or item.get("title"))
        if not detail:
            continue
        results.append(
            {
                "kind": "weeklyTrend",
                "title": _normalize_text(item.get("title")) or f"亮点 {index}",
                "detail": detail,
                "priority": index,
                "source": "ruleFallback",
            }
        )
        if len(results) >= 3:
            break
    return results


def _normalize_highlights(payload: dict[str, Any]) -> list[dict[str, Any]]:
    raw_items = _payload_get(payload, "highlightCandidates", "highlight_candidates")
    results: list[dict[str, Any]] = []

    if isinstance(raw_items, list):
      for item in raw_items:
          if not isinstance(item, dict):
              continue
          detail = _normalize_text(item.get("detail") or item.get("title"))
          if not detail:
              continue
          results.append(
              {
                  "kind": _normalize_text(item.get("kind")) or "todayGrowth",
                  "title": _normalize_text(item.get("title")) or "今日亮点",
                  "detail": detail,
                  "priority": int(item.get("priority") or 99),
                  "source": _normalize_text(item.get("source")) or _normalize_text(item.get("kind")) or "highlight",
              }
          )

    if results:
        return sorted(results, key=lambda item: item["priority"])

    snapshot = _payload_get(payload, "snapshot")
    if isinstance(snapshot, dict):
        return _build_fallback_highlights(snapshot)
    return []


def _normalize_card(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _memory_prompt_context(payload: dict[str, Any]) -> dict[str, list[str]]:
    memory_context = _payload_get(payload, "memory_context")
    if not isinstance(memory_context, dict):
        return {"longTermTraits": [], "recentContinuitySignals": [], "lastConsultationTakeaways": [], "openLoops": []}

    prompt_context = memory_context.get("promptContext")
    if not isinstance(prompt_context, dict):
        prompt_context = memory_context.get("prompt_context")
    if not isinstance(prompt_context, dict):
        return {"longTermTraits": [], "recentContinuitySignals": [], "lastConsultationTakeaways": [], "openLoops": []}

    result: dict[str, list[str]] = {}
    for key in ("longTermTraits", "recentContinuitySignals", "lastConsultationTakeaways", "openLoops"):
        value = prompt_context.get(key)
        if value is None:
            snake_key = "".join([f"_{char.lower()}" if char.isupper() else char for char in key]).lstrip("_")
            value = prompt_context.get(snake_key)
        if isinstance(value, list):
            result[key] = [_normalize_text(item) for item in value if _normalize_text(item)]
        else:
            result[key] = []
    return result


def _build_story_mode(payload: dict[str, Any], highlights: list[dict[str, Any]]) -> str:
    snapshot = _payload_get(payload, "snapshot")
    child = snapshot.get("child") if isinstance(snapshot, dict) else {}
    child_id = child.get("id") if isinstance(child, dict) else None
    summary = snapshot.get("summary") if isinstance(snapshot, dict) else {}
    growth = summary.get("growth") if isinstance(summary, dict) else {}
    feedback = summary.get("feedback") if isinstance(summary, dict) else {}
    requested_mode = _coerce_text(_payload_get(payload, "storyMode", "story_mode"))

    if requested_mode == "card":
        return "card"
    if not _coerce_text(child_id):
        return "card"
    if not highlights:
        return "card"
    if int(growth.get("recordCount") or 0) == 0 and int(feedback.get("count") or 0) == 0:
        return "card"
    return "storybook"


def _build_parent_note(
    child_name: str,
    mode: str,
    highlights: list[dict[str, Any]],
    latest_intervention_card: dict[str, Any],
    latest_consultation: dict[str, Any],
) -> str:
    if mode == "card":
        return f"今晚先读一张轻量成长故事卡，帮 {child_name} 把今天值得记住的小进步收好。"

    action = (
        _normalize_text(latest_intervention_card.get("tonightHomeAction"))
        or _normalize_text(latest_consultation.get("homeAction"))
        or _normalize_text(latest_consultation.get("summary"))
        or (highlights[1]["detail"] if len(highlights) > 1 else "")
    )
    if action:
        return f"听完故事后，今晚只做一件小事：{action}"
    return f"听完故事后，和 {child_name} 一起回顾今天最亮的一幕，再轻轻把一天收尾。"


def _build_moral(child_name: str, highlights: list[dict[str, Any]]) -> str:
    primary = highlights[0]["detail"] if highlights else f"{child_name} 又向前走了一小步"
    return f"成长不需要一下子完成，只要有人看见 {primary}，孩子就会更愿意继续往前。"


def _build_scene_script(index: int, child_name: str, class_name: str, highlights: list[dict[str, Any]], memory_hint: str) -> tuple[str, str]:
    primary = highlights[index]["detail"] if index < len(highlights) else highlights[-1]["detail"]
    next_detail = highlights[index + 1]["detail"] if index + 1 < len(highlights) else memory_hint

    if index == 0:
        title = "今天的小亮点"
        text = f"{child_name}{f' 在{class_name}' if class_name else ''} 今天最值得被看见的是：{primary}。这像一颗轻轻亮起来的小星星。"
    elif index == 1:
        title = "有人陪着慢慢来"
        support = next_detail or "老师和家人的稳定陪伴，让这份努力更容易发生。"
        text = f"故事来到第二幕，大人没有催促，只是轻轻陪着 {child_name} 再试一次。{support}"
    else:
        title = "晚安继续长大"
        closing = next_detail or "明天再回头看，会发现成长就是这样一点点长出来的。"
        text = f"到了晚上，这份小进步慢慢变成一则可以带回家的晚安故事。{closing}"

    return title, text


async def run_parent_storybook(payload: dict[str, Any]) -> dict[str, Any]:
    snapshot = _payload_get(payload, "snapshot")
    if not isinstance(snapshot, dict):
        raise ValueError("snapshot is required")

    child = snapshot.get("child")
    if not isinstance(child, dict):
        raise ValueError("snapshot.child is required")

    child_id = _normalize_text(child.get("id")) or _normalize_text(_payload_get(payload, "childId", "child_id"))
    child_name = _normalize_text(child.get("name")) or "孩子"
    class_name = _normalize_text(child.get("className"))
    highlights = _normalize_highlights(payload)
    mode = _build_story_mode(payload, highlights)
    latest_intervention_card = _normalize_card(_payload_get(payload, "latestInterventionCard", "latest_intervention_card"))
    latest_consultation = _normalize_card(_payload_get(payload, "latestConsultation", "latest_consultation"))
    memory_context = _memory_prompt_context(payload)
    memory_hint = (
        (memory_context["recentContinuitySignals"][0] if memory_context["recentContinuitySignals"] else "")
        or (memory_context["lastConsultationTakeaways"][0] if memory_context["lastConsultationTakeaways"] else "")
        or (memory_context["longTermTraits"][0] if memory_context["longTermTraits"] else "")
    )
    parent_note = _build_parent_note(child_name, mode, highlights, latest_intervention_card, latest_consultation)
    moral = _build_moral(child_name, highlights)

    story_seed = "::".join(
        [
            child_id or "unknown-child",
            mode,
            child_name,
            class_name,
            "|".join(f"{item['kind']}:{item['title']}:{item['detail']}" for item in highlights),
            _normalize_text(_payload_get(payload, "requestSource", "request_source")),
        ]
    )
    story_id = f"storybook-{_stable_hash(story_seed)}"
    generated_at = _stable_timestamp(story_seed)

    settings = get_settings()
    image_provider = resolve_story_image_provider(settings)
    audio_provider = resolve_story_audio_provider(settings)

    scene_total = 1 if mode == "card" else 3
    if not highlights:
        highlights = [
            {
                "kind": "weeklyTrend",
                "title": "成长故事卡",
                "detail": "今天先用一张轻量故事卡，把值得记住的小变化收好。",
                "priority": 1,
                "source": "rule",
            }
        ]

    scenes: list[dict[str, Any]] = []
    for index in range(scene_total):
        scene_title, scene_text = _build_scene_script(index, child_name, class_name, highlights, memory_hint)
        image_result = image_provider.render_scene(
            story_mode=mode,
            scene_index=index,
            child_name=child_name,
            scene_title=scene_title,
            scene_text=scene_text,
        )
        audio_result = audio_provider.render_scene(
            story_mode=mode,
            scene_index=index,
            child_name=child_name,
            scene_title=scene_title,
            scene_text=scene_text,
        )
        source_item = highlights[min(index, len(highlights) - 1)]
        scenes.append(
            {
                "sceneIndex": index + 1,
                "sceneTitle": scene_title,
                "sceneText": scene_text if index < scene_total - 1 else f"{scene_text} {parent_note}",
                "imagePrompt": image_result.output["imagePrompt"],
                "imageUrl": image_result.output.get("imageUrl"),
                "assetRef": image_result.output.get("assetRef"),
                "imageStatus": image_result.output.get("imageStatus", "fallback"),
                "audioUrl": audio_result.output.get("audioUrl"),
                "audioRef": audio_result.output.get("audioRef"),
                "audioScript": audio_result.output.get("audioScript", scene_text),
                "audioStatus": audio_result.output.get("audioStatus", "fallback"),
                "voiceStyle": audio_result.output.get("voiceStyle", "gentle-bedtime"),
                "highlightSource": _normalize_text(source_item.get("source")) or _normalize_text(source_item.get("kind")) or "highlight",
            }
        )

    primary_detail = highlights[0]["detail"] if highlights else "今天多了一点值得被看见的进步"
    summary = (
        f"{child_name} 的今天，可以用“{primary_detail}”来概括。"
        if mode == "storybook"
        else f"{child_name} 的今天适合先用一张轻量成长故事卡轻轻收尾。"
    )

    fallback_reason = "mock-storybook-pipeline" if mode == "storybook" else "sparse-parent-context"
    return {
        "storyId": story_id,
        "childId": child_id or "unknown-child",
        "mode": mode,
        "title": f"{child_name} 的晚安小绘本" if mode == "storybook" else f"{child_name} 的成长小卡",
        "summary": summary,
        "moral": moral,
        "parentNote": parent_note,
        "source": "rule",
        "fallback": True,
        "fallbackReason": fallback_reason,
        "generatedAt": generated_at,
        "providerMeta": {
            "provider": "parent-storybook-rule",
            "mode": "fallback",
            "transport": "fastapi-brain",
            "imageProvider": image_provider.provider_name,
            "audioProvider": audio_provider.provider_name,
            "requestSource": _normalize_text(_payload_get(payload, "requestSource", "request_source")) or "parent-storybook",
            "fallbackReason": fallback_reason,
            "realProvider": False,
            "highlightCount": len(highlights),
            "sceneCount": len(scenes),
        },
        "scenes": scenes,
    }
