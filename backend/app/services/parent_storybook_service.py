from __future__ import annotations

import asyncio
import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from app.core.config import get_settings
from app.providers.story_audio_provider import MockStoryAudioProvider, resolve_story_audio_provider
from app.providers.story_image_provider import MockStoryImageProvider, resolve_story_image_provider
from app.services.storybook_media_cache import get_storybook_media_cache

DEFAULT_STYLE_PRESET = "sunrise-watercolor"
DEFAULT_GENERATION_MODE = "child-personalized"
DEFAULT_PAGE_COUNT = 6
STORYBOOK_FOCUS_FALLBACK = "慢慢长大的力量"
PROVIDER_CACHE_WINDOW_SECONDS = 15 * 60
STYLE_PRESET_PROMPTS = {
    "sunrise-watercolor": "儿童绘本插画，晨光水彩质感，暖金高光，柔软纸张肌理，治愈、童趣、适合移动端纵向绘本。",
    "moonlit-cutout": "儿童绘本插画，月夜剪纸风格，深蓝与奶白层叠，星光柔雾，安静、轻柔、适合晚安故事。",
    "forest-crayon": "儿童绘本插画，森林蜡笔风格，浅绿与木色，明显手绘纹理，轻冒险感，温暖而有生命力。",
}
PAGE_STRUCTURES: dict[int, list[str]] = {
    4: ["opening", "challenge", "attempt", "landing"],
    6: ["opening", "challenge", "support", "attempt", "small-success", "landing"],
    8: [
        "opening",
        "setup",
        "challenge",
        "support",
        "attempt",
        "wobble",
        "small-success",
        "landing",
    ],
}
PROTAGONISTS = [
    {"archetype": "bunny", "label": "小兔团团", "visual_cue": "圆圆耳朵、软软围巾"},
    {"archetype": "bear", "label": "小熊暖暖", "visual_cue": "毛绒外套、小小灯笼"},
    {"archetype": "deer", "label": "小鹿悠悠", "visual_cue": "细长步子、月光披风"},
    {"archetype": "fox", "label": "小狐狸点点", "visual_cue": "蓬松尾巴、暖橙小背包"},
    {"archetype": "otter", "label": "小水獭泡泡", "visual_cue": "亮晶晶眼睛、柔软披肩"},
]
STORYBOOK_BASE_DATE = datetime(2026, 4, 7, 12, 0, 0, tzinfo=UTC)

StoryMode = Literal["storybook", "card"]
GenerationMode = Literal["child-personalized", "manual-theme", "hybrid"]


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


def _normalize_keywords(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = _normalize_text(value)
        if not text or text in seen:
            continue
        seen.add(text)
        result.append(text)
    return result[:4]


def _stable_hash(seed: str, *, length: int = 12) -> str:
    return hashlib.sha1(seed.encode("utf-8")).hexdigest()[:length]


def _stable_timestamp(seed: str) -> str:
    offset_seconds = int(_stable_hash(seed), 16) % (24 * 60 * 60)
    return (STORYBOOK_BASE_DATE + timedelta(seconds=offset_seconds)).isoformat().replace("+00:00", "Z")


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


def _resolve_generation_mode(payload: dict[str, Any]) -> GenerationMode:
    requested = _normalize_text(_payload_get(payload, "generationMode", "generation_mode"))
    if requested in {"child-personalized", "manual-theme", "hybrid"}:
        return requested  # type: ignore[return-value]

    manual_theme = _normalize_text(_payload_get(payload, "manualTheme", "manual_theme"))
    snapshot = _payload_get(payload, "snapshot")
    child = snapshot.get("child") if isinstance(snapshot, dict) else {}
    has_child = isinstance(child, dict) and bool(_normalize_text(child.get("id")))
    if manual_theme and has_child:
        return "hybrid"
    if manual_theme:
        return "manual-theme"
    return "child-personalized"


def _resolve_page_count(payload: dict[str, Any]) -> int:
    value = _payload_get(payload, "pageCount", "page_count")
    if value in {4, 6, 8}:
        return int(value)
    return DEFAULT_PAGE_COUNT


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
        if len(results) >= 4:
            break
    return results


def _normalize_payload_highlights(payload: dict[str, Any]) -> list[dict[str, Any]]:
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


def _build_theme_highlights(payload: dict[str, Any]) -> list[dict[str, Any]]:
    manual_theme = _normalize_text(_payload_get(payload, "manualTheme", "manual_theme"))
    manual_prompt = _normalize_text(_payload_get(payload, "manualPrompt", "manual_prompt"))
    goal_keywords = _normalize_keywords(_payload_get(payload, "goalKeywords", "goal_keywords"))

    results: list[dict[str, Any]] = []
    if manual_theme:
        results.append(
            {
                "kind": "manualTheme",
                "title": f"主题：{manual_theme}",
                "detail": manual_prompt
                or f"把“{manual_theme}”讲成孩子能听懂、家长愿意读、今晚就能用上的成长故事。",
                "priority": 1,
                "source": "manualTheme",
            }
        )

    for index, keyword in enumerate(goal_keywords, start=2):
        results.append(
            {
                "kind": "goalKeyword",
                "title": f"关键词：{keyword}",
                "detail": f"故事会把“{keyword}”落到一个能被孩子感受到的小动作里。",
                "priority": index,
                "source": "goalKeyword",
            }
        )

    if not results and manual_prompt:
        results.append(
            {
                "kind": "manualTheme",
                "title": "主题设定",
                "detail": manual_prompt,
                "priority": 1,
                "source": "manualTheme",
            }
        )

    return results


def _dedupe_highlights(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for item in items:
        key = "::".join(
            [
                _normalize_text(item.get("kind")),
                _normalize_text(item.get("title")),
                _normalize_text(item.get("detail")),
            ]
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def _build_highlights(payload: dict[str, Any], generation_mode: GenerationMode) -> list[dict[str, Any]]:
    base_highlights = _normalize_payload_highlights(payload)
    theme_highlights = _build_theme_highlights(payload)
    if generation_mode == "manual-theme":
        return _dedupe_highlights(theme_highlights or base_highlights)
    if generation_mode == "hybrid":
        return _dedupe_highlights([*theme_highlights, *base_highlights])
    return _dedupe_highlights(base_highlights or theme_highlights)


def _resolve_story_mode(
    *,
    payload: dict[str, Any],
    generation_mode: GenerationMode,
    highlights: list[dict[str, Any]],
    snapshot: dict[str, Any],
) -> StoryMode:
    requested_mode = _coerce_text(_payload_get(payload, "storyMode", "story_mode"))
    if requested_mode == "card":
        return "card"
    if generation_mode in {"manual-theme", "hybrid"}:
        return "storybook"
    summary = snapshot.get("summary") if isinstance(snapshot, dict) else {}
    growth = summary.get("growth") if isinstance(summary, dict) else {}
    feedback = summary.get("feedback") if isinstance(summary, dict) else {}
    if not highlights:
        return "card"
    if int(growth.get("recordCount") or 0) == 0 and int(feedback.get("count") or 0) == 0:
        return "card"
    return "storybook"


def _resolve_focus_theme(
    *,
    payload: dict[str, Any],
    snapshot: dict[str, Any],
    highlights: list[dict[str, Any]],
) -> str:
    summary = snapshot.get("summary") if isinstance(snapshot, dict) else {}
    growth = summary.get("growth") if isinstance(summary, dict) else {}
    feedback = summary.get("feedback") if isinstance(summary, dict) else {}
    top_categories = growth.get("topCategories") if isinstance(growth, dict) else []
    feedback_keywords = feedback.get("keywords") if isinstance(feedback, dict) else []
    first_category = top_categories[0].get("category") if isinstance(top_categories, list) and top_categories and isinstance(top_categories[0], dict) else ""
    first_keyword = feedback_keywords[0] if isinstance(feedback_keywords, list) and feedback_keywords else ""
    return (
        _normalize_text(_payload_get(payload, "manualTheme", "manual_theme"))
        or (_normalize_keywords(_payload_get(payload, "goalKeywords", "goal_keywords")) or [""])[0]
        or _normalize_text(first_category)
        or _normalize_text(first_keyword)
        or _normalize_text(highlights[0].get("title") if highlights else "")
        or STORYBOOK_FOCUS_FALLBACK
    )


def _shorten_detail(value: str, fallback: str) -> str:
    normalized = _normalize_text(value) or fallback
    if len(normalized) <= 38:
        return normalized
    return f"{normalized[:38]}…"


def _resolve_protagonist(payload: dict[str, Any], *, focus_theme: str, child_name: str, child_hints: list[str]) -> dict[str, str]:
    requested = _normalize_text(_payload_get(payload, "protagonistArchetype", "protagonist_archetype"))
    for protagonist in PROTAGONISTS:
        if protagonist["archetype"] == requested:
            return protagonist

    seed = "::".join([requested, focus_theme, child_name, "|".join(child_hints)])
    index = int(_stable_hash(seed, length=4), 16) % len(PROTAGONISTS)
    return PROTAGONISTS[index]


def _build_parent_note(*, child_name: str, story_mode: StoryMode, tonight_action: str, tomorrow_observation: str, generation_mode: GenerationMode) -> str:
    if story_mode == "card":
        return f"{child_name} 今晚先用一张轻量成长卡收束情绪，再把最亮的一点小进步说给孩子听。"
    if generation_mode == "manual-theme":
        return f"今晚可以先试一件小事：{tonight_action}。明天继续观察：{tomorrow_observation}。"
    return f"{child_name} 今晚可以先试一件小事：{tonight_action}。明天继续观察：{tomorrow_observation}。"


def _build_moral(*, protagonist_name: str, focus_theme: str, summary_highlight: str) -> str:
    return (
        f"{protagonist_name} 记住的，不是“要快一点”，而是“原来我可以慢慢学会 {focus_theme}”。"
        f"那些被看见的 {summary_highlight}，会一点点变成真正的力量。"
    )


def _build_story_ingredients(payload: dict[str, Any], snapshot: dict[str, Any], child: dict[str, Any], highlights: list[dict[str, Any]]) -> dict[str, Any]:
    generation_mode = _resolve_generation_mode(payload)
    focus_theme = _resolve_focus_theme(payload=payload, snapshot=snapshot, highlights=highlights)
    child_name = _normalize_text(child.get("name")) or "小朋友"
    class_name = _normalize_text(child.get("className")) or None
    consultation = _payload_get(payload, "latestConsultation", "latest_consultation")
    consultation_summary = _normalize_text(consultation.get("summary")) if isinstance(consultation, dict) else ""
    consultation_home_action = _normalize_text(consultation.get("homeAction")) if isinstance(consultation, dict) else ""
    consultation_followup = ""
    if isinstance(consultation, dict):
        followup_items = consultation.get("followUp48h")
        if isinstance(followup_items, list) and followup_items:
            consultation_followup = _normalize_text(followup_items[0])

    intervention = _payload_get(payload, "latestInterventionCard", "latest_intervention_card")
    intervention_action = _normalize_text(intervention.get("tonightHomeAction")) if isinstance(intervention, dict) else ""
    intervention_observation = _normalize_text(intervention.get("tomorrowObservationPoint")) if isinstance(intervention, dict) else ""
    intervention_review = _normalize_text(intervention.get("reviewIn48h")) if isinstance(intervention, dict) else ""

    summary_highlight = _shorten_detail(
        _normalize_text(highlights[0].get("detail") if highlights else ""),
        "被轻轻看见的小进步",
    )
    support_detail = _shorten_detail(
        next(
            (
                _normalize_text(item.get("detail"))
                for item in highlights
                if item.get("kind") in {"consultationAction", "guardianFeedback"}
                and _normalize_text(item.get("detail"))
            ),
            consultation_summary or "大人把节奏放慢一点，先接住情绪，再陪它继续往前。",
        ),
        "大人把节奏放慢一点，先接住情绪，再陪它继续往前。",
    )
    attempt_detail = _shorten_detail(
        next(
            (
                _normalize_text(item.get("detail"))
                for item in highlights
                if item.get("kind") in {"warningSuggestion", "consultationSummary"}
                and _normalize_text(item.get("detail"))
            ),
            _normalize_text(highlights[1].get("detail")) if len(highlights) > 1 else "",
        ),
        "先试一个小动作，再把脚步放稳。",
    )
    success_detail = _shorten_detail(
        next(
            (
                _normalize_text(item.get("detail"))
                for item in highlights
                if item.get("kind") in {"todayGrowth", "guardianFeedback"}
                and _normalize_text(item.get("detail"))
            ),
            _normalize_text(highlights[2].get("detail")) if len(highlights) > 2 else "",
        ),
        "原来一点点靠近，也是在认真长大。",
    )
    challenge_detail = _shorten_detail(
        next(
            (
                _normalize_text(item.get("detail"))
                for item in highlights
                if item.get("kind") == "warningSuggestion" and _normalize_text(item.get("detail"))
            ),
            _normalize_text(highlights[0].get("detail")) if highlights else "",
        )
        or _normalize_text(_payload_get(payload, "manualPrompt", "manual_prompt")),
        "面对新的小关卡时，心里还是会轻轻打鼓。",
    )
    wobble_detail = _shorten_detail(
        next(
            (
                _normalize_text(item.get("detail"))
                for item in highlights
                if item.get("kind") == "weeklyTrend" and _normalize_text(item.get("detail"))
            ),
            consultation_summary or _normalize_text(_payload_get(payload, "manualPrompt", "manual_prompt")),
        ),
        "有一点摇晃很正常，停一停，再出发就好。",
    )
    tonight_action = (
        intervention_action
        or consultation_home_action
        or next(
            (
                _normalize_text(item.get("detail"))
                for item in highlights
                if item.get("kind") == "consultationAction" and _normalize_text(item.get("detail"))
            ),
            "",
        )
        or f"和孩子一起做一个关于“{focus_theme}”的小练习"
    )
    tomorrow_observation = (
        intervention_observation
        or intervention_review
        or consultation_followup
        or next(
            (
                _normalize_text(item.get("detail"))
                for item in highlights
                if item.get("kind") == "weeklyTrend" and _normalize_text(item.get("detail"))
            ),
            "",
        )
        or f"明天再看看孩子遇到“{focus_theme}”时会不会更从容一点"
    )
    child_hints = [
        _normalize_text(child.get("specialNotes")),
        _normalize_text(highlights[0].get("title") if highlights else ""),
    ]
    protagonist = _resolve_protagonist(
        payload,
        focus_theme=focus_theme,
        child_name=child_name,
        child_hints=[item for item in child_hints if item],
    )
    story_mode = _resolve_story_mode(
        payload=payload,
        generation_mode=generation_mode,
        highlights=highlights,
        snapshot=snapshot,
    )
    parent_note = _build_parent_note(
        child_name=child_name,
        story_mode=story_mode,
        tonight_action=tonight_action,
        tomorrow_observation=tomorrow_observation,
        generation_mode=generation_mode,
    )
    return {
        "child_name": child_name,
        "class_name": class_name,
        "focus_theme": focus_theme,
        "goal_keywords": _normalize_keywords(_payload_get(payload, "goalKeywords", "goal_keywords")),
        "protagonist": protagonist,
        "generation_mode": generation_mode,
        "page_count": _resolve_page_count(payload),
        "highlights": highlights,
        "summary_highlight": summary_highlight,
        "challenge_detail": challenge_detail,
        "support_detail": support_detail,
        "attempt_detail": attempt_detail,
        "success_detail": success_detail,
        "wobble_detail": wobble_detail,
        "tonight_action": tonight_action,
        "tomorrow_observation": tomorrow_observation,
        "prompt_hint": _normalize_text(_payload_get(payload, "manualPrompt", "manual_prompt")),
        "parent_note": parent_note,
        "style_prompt": _resolve_style_prompt(payload, _resolve_style_preset(payload)),
        "story_mode": story_mode,
    }


def _build_scene_title(stage: str) -> str:
    return {
        "opening": "月光翻开第一页",
        "setup": "小脚步在路上",
        "challenge": "遇到一点点难",
        "support": "有人轻轻托住它",
        "attempt": "它决定再试一下",
        "wobble": "风吹来时先停一停",
        "small-success": "小小光亮出现了",
        "landing": "把温柔带回今晚",
    }[stage]


def _build_scene_text(stage: str, ingredients: dict[str, Any]) -> str:
    protagonist_name = ingredients["protagonist"]["label"]
    focus_theme = ingredients["focus_theme"]
    if stage == "opening":
        return f"{protagonist_name} 今天想练习“{focus_theme}”。白天里，它已经悄悄做到了一点点：{ingredients['summary_highlight']}。"
    if stage == "setup":
        return f"它没有一下子就变得很厉害，而是先听一听、停一停，再把脚步放轻。{protagonist_name} 知道，慢慢来也是一种本事。"
    if stage == "challenge":
        return f"可当新的小关卡出现时，{protagonist_name} 还是会有点犹豫。{ingredients['challenge_detail']}"
    if stage == "support":
        return f"这时，老师和家长没有催它，只把声音放轻、把节奏放慢。{ingredients['support_detail']}"
    if stage == "attempt":
        return f"{protagonist_name} 先做了一个最小的动作，再试一次。{ingredients['attempt_detail']}"
    if stage == "wobble":
        return f"中间也会有一点摇晃，但那不是退步。{ingredients['wobble_detail']}"
    if stage == "small-success":
        return f"慢慢地，{protagonist_name} 发现自己真的做到了。{ingredients['success_detail']}"
    if ingredients["generation_mode"] == "manual-theme":
        return f"今晚，只要先做一件小事：{ingredients['tonight_action']}。明天，再一起看看{ingredients['tomorrow_observation']}。"
    return f"把这份小小的力量带回今晚吧：{ingredients['tonight_action']}。明天，再一起看看{ingredients['tomorrow_observation']}。"


def _build_scene_voice_style(stage: str) -> str:
    if stage == "landing":
        return "gentle-bedtime"
    if stage in {"challenge", "wobble"}:
        return "warm-storytelling"
    return "calm-encouraging"


def _build_scene_image_prompt(stage: str, scene_title: str, scene_text: str, ingredients: dict[str, Any]) -> str:
    keyword_text = (
        f"，关键词：{'、'.join(ingredients['goal_keywords'])}"
        if ingredients["goal_keywords"]
        else ""
    )
    prompt_hint = f"，补充要求：{ingredients['prompt_hint']}" if ingredients["prompt_hint"] else ""
    return "，".join(
        [
            ingredients["style_prompt"],
            f"儿童绘本插画，移动端纵向大画幅，拟人小动物主角“{ingredients['protagonist']['label']}”",
            f"原型 {ingredients['protagonist']['archetype']}，主题“{ingredients['focus_theme']}”{keyword_text}",
            f"分镜阶段：{stage}，标题“{scene_title}”",
            f"画面内容：{scene_text}",
            f"不要直接画真实孩子本人，不要照片感，不要复杂背景，不要说教标语{prompt_hint}",
        ]
    )


def _build_scene_audio_script(scene_title: str, scene_text: str) -> str:
    return f"{scene_title}。{scene_text}"


def _build_card_scene(ingredients: dict[str, Any]) -> dict[str, Any]:
    scene_title = "把今天轻轻收好"
    scene_text = (
        f"{ingredients['protagonist']['label']} 把今天那一点点亮光抱进怀里。"
        f"今晚只做一件小事：{ingredients['tonight_action']}。"
    )
    return {
        "sceneIndex": 1,
        "sceneTitle": scene_title,
        "sceneText": scene_text,
        "imagePrompt": _build_scene_image_prompt("landing", scene_title, scene_text, ingredients),
        "imageUrl": "/storybook/card.svg",
        "assetRef": "/storybook/card.svg",
        "imageStatus": "fallback",
        "audioUrl": None,
        "audioRef": "storybook-audio-card",
        "audioScript": _build_scene_audio_script(scene_title, scene_text),
        "audioStatus": "fallback",
        "voiceStyle": "gentle-bedtime",
        "highlightSource": "rule",
        "imageCacheHit": False,
        "audioCacheHit": False,
    }


def _build_story_scenes(ingredients: dict[str, Any]) -> list[dict[str, Any]]:
    if ingredients["story_mode"] == "card":
        return [_build_card_scene(ingredients)]

    scenes: list[dict[str, Any]] = []
    for index, stage in enumerate(PAGE_STRUCTURES[ingredients["page_count"]]):
        highlight = ingredients["highlights"][index] if index < len(ingredients["highlights"]) else None
        scene_title = _build_scene_title(stage)
        scene_text = _build_scene_text(stage, ingredients)
        scenes.append(
            {
                "sceneIndex": index + 1,
                "sceneTitle": scene_title,
                "sceneText": scene_text,
                "imagePrompt": _build_scene_image_prompt(stage, scene_title, scene_text, ingredients),
                "imageUrl": f"/storybook/scene-{min(index + 1, 3)}.svg",
                "assetRef": f"/storybook/scene-{min(index + 1, 3)}.svg",
                "imageStatus": "fallback",
                "audioUrl": None,
                "audioRef": f"storybook-audio-{index + 1}",
                "audioScript": _build_scene_audio_script(scene_title, scene_text),
                "audioStatus": "fallback",
                "voiceStyle": _build_scene_voice_style(stage),
                "highlightSource": _normalize_text(highlight.get("source")) if isinstance(highlight, dict) else "rule",
                "imageCacheHit": False,
                "audioCacheHit": False,
            }
        )
    return scenes


def _build_story_title(generation_mode: GenerationMode, *, child_name: str, focus_theme: str) -> str:
    if generation_mode == "manual-theme":
        return f"关于{focus_theme}的成长绘本"
    if generation_mode == "hybrid":
        return f"{child_name}的{focus_theme}成长绘本"
    return f"{child_name}的成长绘本"


def _build_story_summary(generation_mode: GenerationMode, story_mode: StoryMode, *, child_name: str, focus_theme: str, page_count: int) -> str:
    page_text = f"{1 if story_mode == 'card' else page_count} 页"
    if generation_mode == "manual-theme":
        return f"这本 {page_text} 绘本会把“{focus_theme}”讲成孩子能听懂的小故事，并在最后自然落到今晚可以做的一件小事。"
    if generation_mode == "hybrid":
        return f"这本 {page_text} 绘本把“{focus_theme}”和 {child_name} 最近被看见的成长线索串成一条温柔、可朗读、可继续行动的成长闭环。"
    return f"这本 {page_text} 绘本会把 {child_name} 最近被看见的小进步、今晚的陪伴动作和明天的观察点串成完整的成长故事。"


def _build_story_seed(payload: dict[str, Any], ingredients: dict[str, Any], child_id: str) -> str:
    return "::".join(
        [
            child_id or "storybook-guest",
            ingredients["story_mode"],
            ingredients["generation_mode"],
            str(ingredients["page_count"]),
            _resolve_style_preset(payload),
            ingredients["focus_theme"],
            ingredients["protagonist"]["archetype"],
            "|".join(ingredients["goal_keywords"]),
            "|".join(
                f"{item.get('kind')}:{item.get('title')}:{item.get('detail')}"
                for item in ingredients["highlights"]
            ),
            _normalize_text(_payload_get(payload, "requestSource", "request_source")),
        ]
    )


def _render_with_fallback(*, primary_provider: Any, fallback_provider: Any, kwargs: dict[str, Any]) -> Any:
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


def _provider_label(*, primary_name: str, fallback_name: str, scenes: list[dict[str, Any]], status_key: str) -> str:
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


def _maybe_store_audio_asset(*, story_id: str, scene_index: int, audio_script: str, voice_style: str, audio_status: str, audio_result: Any) -> tuple[str | None, str | None]:
    audio_url = audio_result.output.get("audioUrl")
    audio_ref = _normalize_text(audio_result.output.get("audioRef")) or None
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

    child_id = _normalize_text(child.get("id")) or _normalize_text(_payload_get(payload, "childId", "child_id")) or "storybook-guest"
    generation_mode = _resolve_generation_mode(payload)
    highlights = _build_highlights(payload, generation_mode)
    if not highlights:
        highlights = [
            {
                "kind": "weeklyTrend",
                "title": "成长主题",
                "detail": "先把一个小小的成长目标，讲成今晚就能开始的温柔故事。",
                "priority": 1,
                "source": "rule",
            }
        ]

    ingredients = _build_story_ingredients(payload, snapshot, child, highlights)
    scenes_blueprint = _build_story_scenes(ingredients)
    style_preset = _resolve_style_preset(payload)
    story_seed = _build_story_seed(payload, ingredients, child_id)
    story_id = f"storybook-{_stable_hash(story_seed)}"
    generated_at = _stable_timestamp(story_seed)

    settings = get_settings()
    fallback_image_provider = MockStoryImageProvider()
    fallback_audio_provider = MockStoryAudioProvider()
    image_provider = resolve_story_image_provider(settings) if ingredients["story_mode"] == "storybook" else fallback_image_provider
    audio_provider = resolve_story_audio_provider(settings) if ingredients["story_mode"] == "storybook" else fallback_audio_provider

    async def render_scene(scene: dict[str, Any]) -> tuple[Any, Any]:
        image_kwargs = {
            "story_mode": ingredients["story_mode"],
            "scene_index": scene["sceneIndex"] - 1,
            "child_name": ingredients["protagonist"]["label"],
            "scene_title": scene["sceneTitle"],
            "scene_text": scene["sceneText"],
            "child_id": child_id,
            "story_id": story_id,
            "class_name": ingredients["class_name"],
            "image_prompt": scene["imagePrompt"],
        }
        audio_kwargs = {
            "story_mode": ingredients["story_mode"],
            "scene_index": scene["sceneIndex"] - 1,
            "child_name": ingredients["protagonist"]["label"],
            "scene_title": scene["sceneTitle"],
            "scene_text": scene["sceneText"],
            "child_id": child_id,
            "story_id": story_id,
            "audio_script": scene["audioScript"],
            "voice_style": scene["voiceStyle"],
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

    rendered_results = await asyncio.gather(*(render_scene(scene) for scene in scenes_blueprint))

    cache_hit_count = 0
    scenes: list[dict[str, Any]] = []
    for scene_blueprint, (image_result, audio_result) in zip(scenes_blueprint, rendered_results, strict=True):
        image_cache_hit = bool(image_result.output.get("cacheHit"))
        audio_cache_hit = bool(audio_result.output.get("cacheHit"))
        cache_hit_count += int(image_cache_hit) + int(audio_cache_hit)
        image_status = image_result.output.get("imageStatus", "fallback")
        audio_status = audio_result.output.get("audioStatus", "fallback")
        audio_url, cached_audio_ref = _maybe_store_audio_asset(
            story_id=story_id,
            scene_index=scene_blueprint["sceneIndex"] - 1,
            audio_script=audio_result.output.get("audioScript") or scene_blueprint["audioScript"],
            voice_style=audio_result.output.get("voiceStyle") or scene_blueprint["voiceStyle"],
            audio_status=audio_status,
            audio_result=audio_result,
        )
        scenes.append(
            {
                "sceneIndex": scene_blueprint["sceneIndex"],
                "sceneTitle": scene_blueprint["sceneTitle"],
                "sceneText": scene_blueprint["sceneText"],
                "imagePrompt": image_result.output.get("imagePrompt") or scene_blueprint["imagePrompt"],
                "imageUrl": image_result.output.get("imageUrl"),
                "assetRef": image_result.output.get("assetRef"),
                "imageStatus": image_status,
                "audioUrl": audio_url,
                "audioRef": cached_audio_ref or audio_result.output.get("audioRef"),
                "audioScript": audio_result.output.get("audioScript") or scene_blueprint["audioScript"],
                "audioStatus": audio_status,
                "voiceStyle": audio_result.output.get("voiceStyle") or scene_blueprint["voiceStyle"],
                "highlightSource": scene_blueprint["highlightSource"],
                "imageCacheHit": image_cache_hit,
                "audioCacheHit": audio_cache_hit,
            }
        )

    provider_mode = _provider_mode_from_scenes(scenes)
    if provider_mode == "live":
        fallback_reason = None
    elif provider_mode == "mixed":
        fallback_reason = "partial-media-fallback"
    elif ingredients["story_mode"] == "card":
        fallback_reason = "sparse-parent-context"
    else:
        fallback_reason = "mock-storybook-pipeline"

    return {
        "storyId": story_id,
        "childId": child_id,
        "mode": ingredients["story_mode"],
        "title": _build_story_title(
            ingredients["generation_mode"],
            child_name=ingredients["child_name"],
            focus_theme=ingredients["focus_theme"],
        ),
        "summary": _build_story_summary(
            ingredients["generation_mode"],
            ingredients["story_mode"],
            child_name=ingredients["child_name"],
            focus_theme=ingredients["focus_theme"],
            page_count=ingredients["page_count"],
        ),
        "moral": _build_moral(
            protagonist_name=ingredients["protagonist"]["label"],
            focus_theme=ingredients["focus_theme"],
            summary_highlight=ingredients["summary_highlight"],
        ),
        "parentNote": ingredients["parent_note"],
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
