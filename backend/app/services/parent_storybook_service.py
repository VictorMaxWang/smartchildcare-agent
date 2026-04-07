from __future__ import annotations

import asyncio
import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.config import get_settings
from app.providers.story_audio_provider import MockStoryAudioProvider, resolve_story_audio_provider
from app.providers.story_image_provider import MockStoryImageProvider, resolve_story_image_provider
from app.services.storybook_media_cache import get_storybook_media_cache

DEFAULT_STYLE_PRESET = "sunrise-watercolor"
STYLE_PRESET_PROMPTS = {
    "sunrise-watercolor": "晨光水彩儿童绘本风，暖金高光，纸面晕染，柔和治愈。",
    "moonlit-cutout": "月夜剪纸儿童绘本风，静蓝夜色，奶白层叠，像立体纸艺舞台。",
    "forest-crayon": "森林蜡笔儿童绘本风，浅绿木色，明显手绘蜡笔纹理，活泼但温和。",
}
PROVIDER_CACHE_WINDOW_SECONDS = 15 * 60


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


def _stable_hash(seed: str, *, length: int = 12) -> str:
    return hashlib.sha1(seed.encode("utf-8")).hexdigest()[:length]


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
            try:
                priority = int(item.get("priority") or 99)
            except (TypeError, ValueError):
                priority = 99
            results.append(
                {
                    "kind": _normalize_text(item.get("kind")) or "todayGrowth",
                    "title": _normalize_text(item.get("title")) or "今日亮点",
                    "detail": detail,
                    "priority": priority,
                    "source": _normalize_text(item.get("source"))
                    or _normalize_text(item.get("kind"))
                    or "highlight",
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
    memory_context = _payload_get(payload, "memoryContext", "memory_context")
    if not isinstance(memory_context, dict):
        return {
            "longTermTraits": [],
            "recentContinuitySignals": [],
            "lastConsultationTakeaways": [],
            "openLoops": [],
        }

    prompt_context = memory_context.get("promptContext")
    if not isinstance(prompt_context, dict):
        prompt_context = memory_context.get("prompt_context")
    if not isinstance(prompt_context, dict):
        return {
            "longTermTraits": [],
            "recentContinuitySignals": [],
            "lastConsultationTakeaways": [],
            "openLoops": [],
        }

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


def _resolve_style_preset(payload: dict[str, Any]) -> str:
    requested = _normalize_text(_payload_get(payload, "stylePreset", "style_preset"))
    if requested in STYLE_PRESET_PROMPTS:
        return requested
    return DEFAULT_STYLE_PRESET


def _resolve_style_prompt(payload: dict[str, Any], style_preset: str) -> str:
    explicit = _normalize_text(_payload_get(payload, "stylePrompt", "style_prompt"))
    if explicit:
        return explicit
    return STYLE_PRESET_PROMPTS.get(style_preset, STYLE_PRESET_PROMPTS[DEFAULT_STYLE_PRESET])


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
        return f"今晚先读一张轻量成长故事卡，帮 {child_name} 把今天最值得记住的小进步收好。"

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


def _build_scene_script(
    index: int,
    child_name: str,
    class_name: str,
    highlights: list[dict[str, Any]],
    memory_hint: str,
) -> tuple[str, str]:
    primary = highlights[index]["detail"] if index < len(highlights) else highlights[-1]["detail"]
    next_detail = highlights[index + 1]["detail"] if index + 1 < len(highlights) else memory_hint

    if index == 0:
        title = "今天的小亮点"
        text = f"{child_name}{f' 在 {class_name}' if class_name else ''} 今天最值得被看见的是：{primary}。这像一颗轻轻亮起来的小星星。"
    elif index == 1:
        title = "有人陪着慢慢来"
        support = next_detail or "老师和家人的稳定陪伴，让这份努力更容易发生。"
        text = f"故事来到第二幕，大人没有催促，只是轻轻陪着 {child_name} 再试一次。{support}"
    else:
        title = "晚安继续长大"
        closing = next_detail or "明天再回头看，会发现成长就是这样一点点长出来的。"
        text = f"到了晚上，这份小进步慢慢变成一则可以带回家的晚安故事。{closing}"

    return title, text


def _build_scene_voice_style(index: int) -> str:
    if index >= 2:
        return "gentle-bedtime"
    if index == 1:
        return "warm-storytelling"
    return "calm-encouraging"


def _build_scene_image_prompt(
    *,
    child_name: str,
    class_name: str | None,
    scene_title: str,
    scene_text: str,
    style_prompt: str,
) -> str:
    parts = [style_prompt]
    parts.append(
        f"儿童绘本插图，主角是{child_name}"
        f"{f'，场景为{class_name}' if class_name else ''}，"
        f"分镜标题“{scene_title}”，"
        f"核心文案“{scene_text[:90]}”，"
        "适合移动端家长睡前阅读，情绪温柔、清晰、可录屏展示。"
    )
    return " ".join(part for part in parts if part)


def _build_scene_audio_script(
    *,
    child_name: str,
    scene_index: int,
    scene_title: str,
    scene_text: str,
) -> str:
    return f"{child_name} 的第 {scene_index + 1} 幕：{scene_title}。{scene_text[:110]}".strip()


def _scene_blueprint(
    *,
    index: int,
    scene_total: int,
    story_id: str,
    child_id: str,
    child_name: str,
    class_name: str | None,
    highlights: list[dict[str, Any]],
    memory_hint: str,
    parent_note: str,
    style_prompt: str,
) -> dict[str, Any]:
    scene_title, base_scene_text = _build_scene_script(index, child_name, class_name or "", highlights, memory_hint)
    scene_text = base_scene_text if index < scene_total - 1 else f"{base_scene_text} {parent_note}"
    highlight = highlights[min(index, len(highlights) - 1)]

    return {
        "story_id": story_id,
        "child_id": child_id,
        "scene_index": index,
        "scene_title": scene_title,
        "scene_text": scene_text,
        "base_scene_text": base_scene_text,
        "voice_style": _build_scene_voice_style(index),
        "image_prompt": _build_scene_image_prompt(
            child_name=child_name,
            class_name=class_name,
            scene_title=scene_title,
            scene_text=base_scene_text,
            style_prompt=style_prompt,
        ),
        "audio_script": _build_scene_audio_script(
            child_name=child_name,
            scene_index=index,
            scene_title=scene_title,
            scene_text=base_scene_text,
        ),
        "highlight_source": _normalize_text(highlight.get("source"))
        or _normalize_text(highlight.get("kind"))
        or "highlight",
    }


def _render_with_fallback(
    *,
    primary_provider: Any,
    fallback_provider: Any,
    kwargs: dict[str, Any],
) -> Any:
    if primary_provider.__class__ is fallback_provider.__class__:
        return primary_provider.render_scene(**kwargs)
    try:
        return primary_provider.render_scene(**kwargs)
    except Exception:
        return fallback_provider.render_scene(**kwargs)


def _provider_mode_from_scenes(scenes: list[dict[str, Any]]) -> str:
    if scenes and all(scene["imageStatus"] == "ready" and scene["audioStatus"] == "ready" for scene in scenes):
        return "live"
    if any(scene["imageStatus"] == "ready" or scene["audioStatus"] == "ready" for scene in scenes):
        return "mixed"
    return "fallback"


def _provider_label(
    *,
    primary_name: str,
    fallback_name: str,
    scenes: list[dict[str, Any]],
    status_key: str,
) -> str:
    ready = any(scene[status_key] == "ready" for scene in scenes)
    fallback = any(scene[status_key] != "ready" for scene in scenes)
    if ready and fallback and primary_name != fallback_name:
        return f"{primary_name}+{fallback_name}"
    if ready:
        return primary_name
    return fallback_name


def _build_media_key(*, story_id: str, scene_index: int, audio_script: str) -> str:
    seed = "::".join([story_id, str(scene_index), audio_script[:96]])
    return f"storybook-media-{_stable_hash(seed, length=16)}"


def _maybe_store_audio_asset(
    *,
    story_id: str,
    scene_index: int,
    audio_script: str,
    voice_style: str,
    audio_status: str,
    audio_result: Any,
) -> tuple[str | None, str | None]:
    audio_url = audio_result.output.get("audioUrl")
    audio_ref = _coerce_text(audio_result.output.get("audioRef")) or None

    if audio_status != "ready":
        return audio_url, audio_ref

    audio_bytes = audio_result.output.get("audioBytes")
    if not isinstance(audio_bytes, (bytes, bytearray)) or len(audio_bytes) == 0:
        return audio_url, audio_ref

    media_key = _build_media_key(
        story_id=story_id,
        scene_index=scene_index,
        audio_script=audio_script,
    )
    content_type = _normalize_text(audio_result.output.get("audioContentType")) or "audio/wav"
    get_storybook_media_cache().put_audio(
        media_key,
        payload={
            "storyId": story_id,
            "sceneIndex": scene_index + 1,
            "voiceStyle": voice_style,
        },
        audio_bytes=bytes(audio_bytes),
        content_type=content_type,
    )
    return f"/api/ai/parent-storybook/media/{media_key}", media_key


async def run_parent_storybook(payload: dict[str, Any]) -> dict[str, Any]:
    snapshot = _payload_get(payload, "snapshot")
    if not isinstance(snapshot, dict):
        raise ValueError("snapshot is required")

    child = snapshot.get("child")
    if not isinstance(child, dict):
        raise ValueError("snapshot.child is required")

    child_id = _normalize_text(child.get("id")) or _normalize_text(_payload_get(payload, "childId", "child_id"))
    child_name = _normalize_text(child.get("name")) or "孩子"
    class_name = _normalize_text(child.get("className")) or None
    requested_mode = _coerce_text(_payload_get(payload, "storyMode", "story_mode"))
    highlights = _normalize_highlights(payload)
    mode = _build_story_mode(payload, highlights)
    latest_intervention_card = _normalize_card(
        _payload_get(payload, "latestInterventionCard", "latest_intervention_card")
    )
    latest_consultation = _normalize_card(_payload_get(payload, "latestConsultation", "latest_consultation"))
    memory_context = _memory_prompt_context(payload)
    memory_hint = (
        (memory_context["recentContinuitySignals"][0] if memory_context["recentContinuitySignals"] else "")
        or (memory_context["lastConsultationTakeaways"][0] if memory_context["lastConsultationTakeaways"] else "")
        or (memory_context["longTermTraits"][0] if memory_context["longTermTraits"] else "")
    )
    style_preset = _resolve_style_preset(payload)
    style_prompt = _resolve_style_prompt(payload, style_preset)
    parent_note = _build_parent_note(child_name, mode, highlights, latest_intervention_card, latest_consultation)
    moral = _build_moral(child_name, highlights)

    story_seed = "::".join(
        [
            child_id or "unknown-child",
            mode,
            style_preset,
            style_prompt,
            child_name,
            class_name or "",
            "|".join(f"{item['kind']}:{item['title']}:{item['detail']}" for item in highlights),
            _normalize_text(_payload_get(payload, "requestSource", "request_source")),
        ]
    )
    story_id = f"storybook-{_stable_hash(story_seed)}"
    generated_at = _stable_timestamp(story_seed)

    settings = get_settings()
    fallback_image_provider = MockStoryImageProvider()
    fallback_audio_provider = MockStoryAudioProvider()
    image_provider = resolve_story_image_provider(settings) if mode == "storybook" else fallback_image_provider
    audio_provider = resolve_story_audio_provider(settings) if mode == "storybook" else fallback_audio_provider

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

    blueprints = [
        _scene_blueprint(
            index=index,
            scene_total=scene_total,
            story_id=story_id,
            child_id=child_id or "unknown-child",
            child_name=child_name,
            class_name=class_name,
            highlights=highlights,
            memory_hint=memory_hint,
            parent_note=parent_note,
            style_prompt=style_prompt,
        )
        for index in range(scene_total)
    ]

    async def render_scene(blueprint: dict[str, Any]) -> tuple[Any, Any]:
        image_kwargs = {
            "story_mode": mode,
            "scene_index": blueprint["scene_index"],
            "child_name": child_name,
            "scene_title": blueprint["scene_title"],
            "scene_text": blueprint["base_scene_text"],
            "child_id": blueprint["child_id"],
            "story_id": blueprint["story_id"],
            "class_name": class_name,
            "image_prompt": blueprint["image_prompt"],
        }
        audio_kwargs = {
            "story_mode": mode,
            "scene_index": blueprint["scene_index"],
            "child_name": child_name,
            "scene_title": blueprint["scene_title"],
            "scene_text": blueprint["base_scene_text"],
            "child_id": blueprint["child_id"],
            "story_id": blueprint["story_id"],
            "audio_script": blueprint["audio_script"],
            "voice_style": blueprint["voice_style"],
        }
        return await asyncio.gather(
            asyncio.to_thread(
                _render_with_fallback,
                primary_provider=image_provider,
                fallback_provider=fallback_image_provider,
                kwargs=image_kwargs,
            ),
            asyncio.to_thread(
                _render_with_fallback,
                primary_provider=audio_provider,
                fallback_provider=fallback_audio_provider,
                kwargs=audio_kwargs,
            ),
        )

    rendered_results = await asyncio.gather(*(render_scene(blueprint) for blueprint in blueprints))

    cache_hit_count = 0
    scenes: list[dict[str, Any]] = []
    for blueprint, (image_result, audio_result) in zip(blueprints, rendered_results, strict=True):
        image_cache_hit = bool(image_result.output.get("cacheHit"))
        audio_cache_hit = bool(audio_result.output.get("cacheHit"))
        cache_hit_count += int(image_cache_hit) + int(audio_cache_hit)

        image_status = image_result.output.get("imageStatus", "fallback")
        audio_status = audio_result.output.get("audioStatus", "fallback")
        audio_url, cached_audio_ref = _maybe_store_audio_asset(
            story_id=story_id,
            scene_index=blueprint["scene_index"],
            audio_script=audio_result.output.get("audioScript") or blueprint["audio_script"],
            voice_style=audio_result.output.get("voiceStyle") or blueprint["voice_style"],
            audio_status=audio_status,
            audio_result=audio_result,
        )

        scenes.append(
            {
                "sceneIndex": blueprint["scene_index"] + 1,
                "sceneTitle": blueprint["scene_title"],
                "sceneText": blueprint["scene_text"],
                "imagePrompt": image_result.output.get("imagePrompt") or blueprint["image_prompt"],
                "imageUrl": image_result.output.get("imageUrl"),
                "assetRef": image_result.output.get("assetRef"),
                "imageStatus": image_status,
                "audioUrl": audio_url,
                "audioRef": cached_audio_ref or audio_result.output.get("audioRef"),
                "audioScript": audio_result.output.get("audioScript") or blueprint["audio_script"],
                "audioStatus": audio_status,
                "voiceStyle": audio_result.output.get("voiceStyle") or blueprint["voice_style"],
                "highlightSource": blueprint["highlight_source"],
                "imageCacheHit": image_cache_hit,
                "audioCacheHit": audio_cache_hit,
            }
        )

    primary_detail = highlights[0]["detail"] if highlights else "今天多了一点值得被看见的进步"
    summary = (
        f"{child_name} 的今天，可以用“{primary_detail}”来概括。"
        if mode == "storybook"
        else f"{child_name} 的今天适合先用一张轻量成长故事卡轻轻收尾。"
    )

    provider_mode = _provider_mode_from_scenes(scenes)
    if provider_mode == "live":
        fallback_reason = None
    elif provider_mode == "mixed":
        fallback_reason = "partial-media-fallback"
    elif mode == "card" and requested_mode == "card":
        fallback_reason = "card-mode-requested"
    elif mode == "card":
        fallback_reason = "sparse-parent-context"
    else:
        fallback_reason = "mock-storybook-pipeline"

    return {
        "storyId": story_id,
        "childId": child_id or "unknown-child",
        "mode": mode,
        "title": f"{child_name} 的晚安小绘本" if mode == "storybook" else f"{child_name} 的成长小卡",
        "summary": summary,
        "moral": moral,
        "parentNote": parent_note,
        "source": "rule",
        "fallback": provider_mode != "live",
        "fallbackReason": fallback_reason,
        "generatedAt": generated_at,
        "stylePreset": style_preset,
        "providerMeta": {
            "provider": "parent-storybook-rule",
            "mode": provider_mode,
            "transport": "fastapi-brain",
            "imageProvider": _provider_label(
                primary_name=getattr(image_provider, "provider_name", "storybook-asset"),
                fallback_name=fallback_image_provider.provider_name,
                scenes=scenes,
                status_key="imageStatus",
            ),
            "audioProvider": _provider_label(
                primary_name=getattr(audio_provider, "provider_name", "storybook-mock-preview"),
                fallback_name=fallback_audio_provider.provider_name,
                scenes=scenes,
                status_key="audioStatus",
            ),
            "stylePreset": style_preset,
            "requestSource": _normalize_text(_payload_get(payload, "requestSource", "request_source"))
            or "parent-storybook",
            "fallbackReason": fallback_reason,
            "realProvider": provider_mode in {"live", "mixed"},
            "highlightCount": len(highlights),
            "sceneCount": len(scenes),
            "cacheHitCount": cache_hit_count,
            "cacheWindowSeconds": max(
                PROVIDER_CACHE_WINDOW_SECONDS,
                int(settings.storybook_media_cache_ttl_seconds or 0),
            ),
        },
        "scenes": scenes,
    }
