import type {
  ConsultationResult,
  ParentStoryBookHighlightCandidate,
  ParentStoryBookMode,
  ParentStoryBookRequest,
  ParentStoryBookResponse,
  ParentStoryBookScene,
  ParentStoryBookMediaStatus,
  ParentStoryBookStylePreset,
} from "@/lib/ai/types";
import { buildParentAgentChildContext, buildParentChildSuggestionSnapshot } from "@/lib/agent/parent-agent";
import type { InterventionCard } from "@/lib/agent/intervention-card";
import type {
  GrowthRecord,
  GuardianFeedback,
  HealthCheckRecord,
  MealRecord,
  ParentFeed,
  TaskCheckInRecord,
  WeeklyDietTrend,
} from "@/lib/store";

export interface ParentStoryBookPayloadInput {
  feed: ParentFeed;
  healthCheckRecords: HealthCheckRecord[];
  mealRecords: MealRecord[];
  growthRecords: GrowthRecord[];
  guardianFeedbacks: GuardianFeedback[];
  taskCheckInRecords: TaskCheckInRecord[];
  latestInterventionCard?: InterventionCard | null;
  latestConsultation?: ConsultationResult | null;
  requestSource?: string;
  storyMode?: ParentStoryBookMode;
  stylePreset?: ParentStoryBookStylePreset;
  stylePrompt?: string;
  traceId?: string;
  debugMemory?: boolean;
}

export interface ParentStoryBookStylePresetDefinition {
  id: ParentStoryBookStylePreset;
  label: string;
  shortLabel: string;
  description: string;
  stylePrompt: string;
}

export const DEFAULT_PARENT_STORYBOOK_STYLE_PRESET: ParentStoryBookStylePreset = "sunrise-watercolor";

export const PARENT_STORYBOOK_STYLE_PRESETS: ParentStoryBookStylePresetDefinition[] = [
  {
    id: "sunrise-watercolor",
    label: "晨光水彩",
    shortLabel: "晨光",
    description: "暖黄水彩与高光晕染，更适合比赛录屏里的治愈成长瞬间。",
    stylePrompt: "画面风格偏晨光水彩，暖金色高光，边缘柔和，像纸上晕染开的儿童绘本插图。",
  },
  {
    id: "moonlit-cutout",
    label: "月夜剪纸",
    shortLabel: "月夜",
    description: "靛蓝夜色与层叠纸艺质感，突出睡前故事和晚安情绪。",
    stylePrompt: "画面风格偏月夜剪纸，靛蓝与奶白层叠，夜空柔雾感明显，像立体纸艺儿童绘本。",
  },
  {
    id: "forest-crayon",
    label: "森林蜡笔",
    shortLabel: "森林",
    description: "浅绿与木质色调配合蜡笔笔触，适合切出更活泼的一套演示画风。",
    stylePrompt: "画面风格偏森林蜡笔，浅绿和木质色调，保留明显手绘蜡笔纹理和轻冒险氛围。",
  },
];

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function buildStableTimestamp(seed: string) {
  const base = Date.UTC(2026, 3, 7, 12, 0, 0);
  const offset = Number.parseInt(stableHash(seed).slice(0, 8), 16) % (24 * 60 * 60 * 1000);
  return new Date(base + offset).toISOString();
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function resolveParentStoryBookStylePreset(value?: string | null): ParentStoryBookStylePreset {
  const normalized = normalizeText(value);
  const matched = PARENT_STORYBOOK_STYLE_PRESETS.find((item) => item.id === normalized);
  return matched?.id ?? DEFAULT_PARENT_STORYBOOK_STYLE_PRESET;
}

export function getParentStoryBookStylePresetDefinition(value?: string | null) {
  const preset = resolveParentStoryBookStylePreset(value);
  return (
    PARENT_STORYBOOK_STYLE_PRESETS.find((item) => item.id === preset) ??
    PARENT_STORYBOOK_STYLE_PRESETS[0]
  );
}

function pickFirstString(values: Array<unknown>) {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return "";
}

function pickCandidateDetail(candidate?: ParentStoryBookHighlightCandidate | null) {
  if (!candidate) return "";
  return normalizeText(candidate.detail) || normalizeText(candidate.title);
}

function summarizeTrend(trend: WeeklyDietTrend) {
  const items = [
    trend.hydrationAvg ? `平均饮水 ${trend.hydrationAvg}ml` : "",
    trend.balancedRate ? `均衡率 ${trend.balancedRate}%` : "",
    trend.monotonyDays ? `单一饮食 ${trend.monotonyDays} 天` : "",
  ].filter(Boolean);
  return items.join("，");
}

function readRecordText(record: Record<string, unknown>, keys: string[]) {
  return pickFirstString(keys.map((key) => record[key]));
}

function normalizeInterventionCard(card?: InterventionCard | Record<string, unknown> | null) {
  if (!card) return null;
  const record = card as Record<string, unknown>;
  return {
    title: pickFirstString([record.title, record.interventionTitle, record.summary, record.reason]),
    tonightHomeAction: pickFirstString([record.tonightHomeAction, record.homeAction, record.action]),
    reviewIn48h: pickFirstString([record.reviewIn48h, record.followUp48h, record.reviewWindow]),
    tomorrowObservationPoint: pickFirstString([record.tomorrowObservationPoint, record.teacherFollowupDraft, record.observationPoint]),
  };
}

function normalizeConsultation(consultation?: ConsultationResult | null) {
  if (!consultation) return null;
  return {
    summary: normalizeText(consultation.summary),
    homeAction: normalizeText(consultation.homeAction),
    followUp48h: consultation.followUp48h?.[0] ?? "",
    parentMessageDraft: normalizeText(consultation.parentMessageDraft),
    schoolAction: normalizeText(consultation.schoolAction),
  };
}

function buildHighlightCandidates(params: {
  feed: ParentFeed;
  snapshot: ReturnType<typeof buildParentChildSuggestionSnapshot>;
  latestInterventionCard?: InterventionCard | null;
  latestConsultation?: ConsultationResult | null;
}) {
  const todayGrowth = params.feed.todayGrowth[0];
  const warningSuggestion = params.feed.suggestions.find((item) => item.level === "warning") ?? params.feed.suggestions[0];
  const consultation = normalizeConsultation(params.latestConsultation);
  const card = normalizeInterventionCard(params.latestInterventionCard);
  const latestFeedback = params.feed.latestFeedback ?? params.feed.recentFeedbacks[0];
  const trendSummary = summarizeTrend(params.feed.weeklyTrend);

  const candidates: ParentStoryBookHighlightCandidate[] = [];

  const todayGrowthTitle = todayGrowth
    ? todayGrowth.category
    : params.snapshot.summary.growth.attentionCount > 0
      ? "今天有新的成长观察"
      : "今天的成长节奏很平稳";
  const todayGrowthDetail = todayGrowth
    ? readRecordText(todayGrowth as unknown as Record<string, unknown>, ["description", "followUpAction", "category"])
    : params.feed.suggestions[0]?.description ?? "今天可以把一个小变化放进故事里，让孩子听见自己的进步。";

  candidates.push({
    kind: "todayGrowth",
    title: todayGrowthTitle,
    detail: todayGrowthDetail,
    priority: 1,
    source: "todayGrowth",
  });

  if (warningSuggestion) {
    candidates.push({
      kind: "warningSuggestion",
      title: warningSuggestion.title,
      detail: warningSuggestion.description,
      priority: 2,
      source: "suggestions",
    });
  }

  if (consultation?.summary) {
    candidates.push({
      kind: "consultationSummary",
      title: "最近会诊结论",
      detail: consultation.summary,
      priority: 3,
      source: "latestConsultation",
    });
  }

  const consultationAction = pickFirstString([
    card?.tonightHomeAction,
    consultation?.homeAction,
    consultation?.followUp48h,
    latestFeedback?.content,
    latestFeedback?.childReaction,
  ]);
  if (consultationAction) {
    candidates.push({
      kind: "consultationAction",
      title: "今晚最适合做的一件事",
      detail: consultationAction,
      priority: 4,
      source: "interventionCard",
    });
  }

  const feedbackDetail = pickFirstString([
    latestFeedback?.content,
    latestFeedback?.childReaction,
    latestFeedback?.freeNote,
  ]);
  if (feedbackDetail) {
    candidates.push({
      kind: "guardianFeedback",
      title: "最近家长反馈",
      detail: feedbackDetail,
      priority: 5,
      source: "guardianFeedback",
    });
  }

  if (trendSummary) {
    candidates.push({
      kind: "weeklyTrend",
      title: "一周趋势信号",
      detail: trendSummary,
      priority: 6,
      source: "weeklyTrend",
    });
  }

  return candidates
    .filter((item) => item.detail.trim().length > 0)
    .sort((left, right) => left.priority - right.priority)
    .slice(0, 5);
}

function buildStoryMode(
  childId: string | undefined | null,
  highlightCandidates: ParentStoryBookHighlightCandidate[],
  snapshot: ReturnType<typeof buildParentChildSuggestionSnapshot>
): ParentStoryBookMode {
  if (!childId) return "card";
  if (highlightCandidates.length === 0) return "card";
  if (snapshot.summary.growth.recordCount === 0 && snapshot.summary.feedback.count === 0) return "card";
  return "storybook";
}

function resolveSceneImageRef(mode: ParentStoryBookMode, index: number) {
  if (mode === "card") return "/storybook/card.svg";
  return `/storybook/scene-${index + 1}.svg`;
}

function buildScene(
  params: {
    index: number;
    childName: string;
    className?: string;
    mode: ParentStoryBookMode;
    stylePrompt?: string;
    highlight: ParentStoryBookHighlightCandidate;
    nextHighlight?: ParentStoryBookHighlightCandidate;
    closingNote: string;
    parentNote: string;
  }
): ParentStoryBookScene {
  const {
    index,
    childName,
    className,
    mode,
    stylePrompt,
    highlight,
    nextHighlight,
    closingNote,
    parentNote,
  } = params;
  const mainText = pickCandidateDetail(highlight);
  const supportingText = pickCandidateDetail(nextHighlight);
  const imageRef = resolveSceneImageRef(mode, index);
  const voiceStyle = index === 2 ? "gentle-bedtime" : index === 1 ? "warm-storytelling" : "calm-encouraging";
  const presetPrompt = normalizeText(stylePrompt);

  const sceneTitleMap: Record<number, string> = {
    0: "今天被看见的小进步",
    1: "老师和家长陪着慢慢来",
    2: "今晚只做一件小事",
  };

  const sceneTextMap: Record<number, string> = {
    0: `${childName}${className ? ` 在 ${className}` : ""} 今天被看见的一幕，是 ${mainText || "又向前迈了一小步"}。老师先把这份小进步轻轻收好，让它不只停在白天，也能陪孩子一起回家。`,
    1: supportingText
      ? `第二幕里，大人没有催快，只是顺着 ${childName} 今天的节奏继续陪着走。${supportingText}。当孩子被稳稳接住时，原来有点难的事，也会慢慢变得愿意再试一次。`
      : `${childName} 不需要一下子做到最好，只要有人在旁边陪着把节奏放慢一点，就已经很了不起。`,
    2: `${closingNote}。${parentNote} 明天继续留意 ${mainText || "孩子在熟悉环节里的回应"}。`,
  };

  const audioScriptMap: Record<number, string> = {
    0: `今天被看见的小进步，是 ${mainText || "一个温柔的小进步"}。这件小事值得被轻轻记下来。`,
    1: supportingText
      ? `老师和家长一起把节奏放慢，${childName} 就能更安心地继续尝试。`
      : `慢慢来，已经是很好的节奏，有人陪着就会更稳。`,
    2: `${closingNote}。${parentNote} 明天再接着看小变化。`,
  };

  return {
    sceneIndex: index + 1,
    sceneTitle: sceneTitleMap[index] ?? "成长片段",
    sceneText: sceneTextMap[index] ?? mainText,
    imagePrompt: [
      presetPrompt,
      `温暖绘本风，${childName}${className ? ` 在 ${className}` : ""}，${mainText || "柔和的成长瞬间"}，奶油色与浅蓝色，安静、安全、童趣，适合家长睡前阅读`,
    ]
      .filter(Boolean)
      .join("；"),
    imageUrl: imageRef,
    assetRef: imageRef,
    imageStatus: mode === "storybook" ? "fallback" : "mock",
    audioUrl: null,
    audioRef: `storybook-audio-${index + 1}`,
    audioScript: audioScriptMap[index] ?? mainText,
    audioStatus: mode === "storybook" ? "fallback" : "mock",
    voiceStyle,
    highlightSource: highlight.source ?? highlight.kind,
  };
}

function buildScenes(params: {
  childName: string;
  className?: string;
  mode: ParentStoryBookMode;
  stylePrompt?: string;
  highlightCandidates: ParentStoryBookHighlightCandidate[];
  closingNote: string;
  parentNote: string;
}) {
  const { childName, className, mode, stylePrompt, highlightCandidates, closingNote, parentNote } = params;
  if (mode === "card") {
    const highlight = highlightCandidates[0] ?? {
      kind: "todayGrowth" as const,
      title: "成长小卡",
      detail: "今天先用一张轻量故事卡，把最值得继续陪伴的小变化收好。",
      priority: 1,
      source: "rule",
    };
    return [
      buildScene({
        index: 0,
        childName,
        className,
        mode,
        stylePrompt,
        highlight,
        closingNote,
        parentNote,
      }),
    ];
  }

  const [first, second, third] = highlightCandidates;
  const safeFirst = first ?? {
    kind: "todayGrowth" as const,
    title: "今天被看见的小进步",
    detail: "今天适合把一个刚刚出现的小进步写进故事里，让孩子带着被看见的感觉回家。",
    priority: 1,
    source: "rule",
  };
  const safeSecond =
    second ??
    {
      kind: "consultationAction" as const,
      title: "今晚最适合做的一件事",
      detail: "今晚只做一件简单、稳定、孩子能跟上的陪伴动作，不额外加新要求。",
      priority: 2,
      source: "rule",
    };
  const safeThird =
    third ??
    {
      kind: "weeklyTrend" as const,
      title: "继续观察的小提醒",
      detail: "明天继续看一眼孩子在熟悉环节里的状态变化，把今天的亮点接到下一次。",
      priority: 3,
      source: "rule",
    };

  return [
    buildScene({
      index: 0,
      childName,
      className,
      mode,
      stylePrompt,
      highlight: safeFirst,
      nextHighlight: safeSecond,
      closingNote,
      parentNote,
    }),
    buildScene({
      index: 1,
      childName,
      className,
      mode,
      stylePrompt,
      highlight: safeSecond,
      nextHighlight: safeThird,
      closingNote,
      parentNote,
    }),
    buildScene({
      index: 2,
      childName,
      className,
      mode,
      stylePrompt,
      highlight: safeThird,
      nextHighlight: safeFirst,
      closingNote,
      parentNote,
    }),
  ];
}

function buildParentNote(
  childName: string,
  mode: ParentStoryBookMode,
  highlightCandidates: ParentStoryBookHighlightCandidate[],
  latestInterventionCard?: InterventionCard | Record<string, unknown> | null,
  latestConsultation?: ConsultationResult | null
) {
  const consultation = normalizeConsultation(latestConsultation);
  const card = normalizeInterventionCard(latestInterventionCard);
  const primary = pickCandidateDetail(highlightCandidates[0]);
  const action = pickFirstString([
    card?.tonightHomeAction,
    consultation?.homeAction,
    consultation?.followUp48h,
    primary,
  ]);

  if (mode === "card") {
    return `${childName} 今晚适合先读一张轻量成长卡，再把今天最值得继续陪伴的一幕说给孩子听。`;
  }

  return action
    ? `今晚只要做一件小事：${action}。不用催快，也不追求一次做到，只要陪着 ${childName} 把这一步走稳就够了。`
    : `今晚先把故事读完，再陪孩子把今天最亮的一幕慢慢说出来，让情绪轻一点收尾。`;
}

function buildMoral(childName: string, highlightCandidates: ParentStoryBookHighlightCandidate[]) {
  const primary = pickCandidateDetail(highlightCandidates[0]) || `${childName} 正在慢慢长大`;
  return `孩子真正会记住的，不是被要求快一点，而是有人看见了他的 ${primary}，也愿意陪他把这一小步走稳。`;
}

export function buildParentStoryBookRequestFromFeed(input: ParentStoryBookPayloadInput): ParentStoryBookRequest {
  const context = buildParentAgentChildContext({
    child: input.feed.child,
    smartInsights: input.feed.suggestions,
    healthCheckRecords: input.healthCheckRecords,
    mealRecords: input.mealRecords,
    growthRecords: input.growthRecords,
    guardianFeedbacks: input.guardianFeedbacks,
    taskCheckInRecords: input.taskCheckInRecords,
    weeklyTrend: input.feed.weeklyTrend,
    currentInterventionCard: input.latestInterventionCard ?? undefined,
  });
  const snapshot = buildParentChildSuggestionSnapshot(context);
  const highlightCandidates = buildHighlightCandidates({
    feed: input.feed,
    snapshot,
    latestInterventionCard: input.latestInterventionCard,
    latestConsultation: input.latestConsultation,
  });
  const storyMode = input.storyMode ?? buildStoryMode(input.feed.child.id, highlightCandidates, snapshot);
  const stylePreset = resolveParentStoryBookStylePreset(input.stylePreset);
  const stylePrompt = normalizeText(input.stylePrompt) || getParentStoryBookStylePresetDefinition(stylePreset).stylePrompt;

  return {
    childId: input.feed.child.id,
    storyMode,
    requestSource: input.requestSource ?? "parent-home",
    stylePreset,
    stylePrompt,
    snapshot,
    highlightCandidates,
    latestInterventionCard: input.latestInterventionCard ? { ...input.latestInterventionCard } : null,
    latestConsultation: input.latestConsultation ? { ...input.latestConsultation } : null,
    traceId: input.traceId,
    debugMemory: input.debugMemory,
  };
}

export function buildParentStoryBookResponse(
  request: ParentStoryBookRequest,
  options?: {
    transport?: string;
    fallbackReason?: string | null;
    source?: ParentStoryBookResponse["source"];
    fallback?: boolean;
  }
): ParentStoryBookResponse {
  const child = request.snapshot.child;
  const childName = normalizeText(child.name) || "孩子";
  const className = normalizeText(child.className) || undefined;
  const highlightCandidates = request.highlightCandidates
    .filter((item) => normalizeText(item.detail).length > 0)
    .sort((left, right) => left.priority - right.priority);
  const requestedMode = request.storyMode === "auto" ? undefined : request.storyMode;
  const computedMode = buildStoryMode(child.id, highlightCandidates, request.snapshot);
  const mode = requestedMode === "card" ? "card" : computedMode;
  const stylePreset = resolveParentStoryBookStylePreset(request.stylePreset);
  const stylePrompt = normalizeText(request.stylePrompt) || getParentStoryBookStylePresetDefinition(stylePreset).stylePrompt;
  const storySeed = [
    request.childId ?? child.id ?? "guest",
    mode,
    stylePreset,
    stylePrompt,
    childName,
    className ?? "",
    highlightCandidates.map((item) => `${item.kind}:${item.title}:${item.detail}`).join("|"),
    normalizeText(request.requestSource ?? ""),
  ].join("::");
  const storyId = `storybook-${stableHash(storySeed)}`;
  const generatedAt = buildStableTimestamp(storySeed);
  const parentNote = buildParentNote(childName, mode, highlightCandidates, request.latestInterventionCard, request.latestConsultation);
  const moral = buildMoral(childName, highlightCandidates);
  const closingNote =
    mode === "card"
      ? "今晚先用一张轻量故事卡收尾，也能把被看见的感觉稳稳留住"
      : "故事到这里先轻轻停一下，把今天的亮点和安心感一起留给睡前时光";
  const scenes = buildScenes({
    childName,
    className,
    mode,
    stylePrompt,
    highlightCandidates,
    closingNote,
    parentNote,
  });
  const primaryDetail = pickCandidateDetail(highlightCandidates[0]);
  const summary = primaryDetail
    ? `${childName} 的今天，可以用“${primaryDetail}”来概括；这本微绘本会继续把当日亮点、今晚动作和明天观察点串成一个睡前小闭环。`
    : `${childName} 的今天适合用一张安静的成长卡轻轻收尾，把今晚陪伴动作和明天观察点先收进故事里。`;

  const fallbackReason =
    options?.fallbackReason ??
    (mode === "card"
      ? requestedMode === "card"
        ? "card-mode-requested"
        : "sparse-parent-context"
      : "mock-storybook-pipeline");
  const transport = options?.transport ?? "next-json-fallback";
  const source = options?.source ?? "rule";
  const fallback = options?.fallback ?? true;

  return {
    storyId,
    childId: child.id ?? request.childId ?? "unknown-child",
    mode,
    title:
      mode === "card"
        ? `${childName} 的成长小卡`
        : `${childName} 的晚安小绘本`,
    summary,
    moral,
    parentNote,
    source,
    fallback,
    fallbackReason,
    generatedAt,
    stylePreset,
    providerMeta: {
      provider: "parent-storybook-rule",
      mode: "fallback",
      transport,
      imageProvider: "storybook-asset",
      audioProvider: "storybook-mock-preview",
      requestSource: request.requestSource ?? "parent-home",
      fallbackReason,
      realProvider: false,
      highlightCount: highlightCandidates.length,
      sceneCount: scenes.length,
      cacheHitCount: 0,
      cacheWindowSeconds: 0,
    },
    scenes: scenes.map((scene) => ({
      ...scene,
      imageCacheHit: false,
      audioCacheHit: false,
    })),
  };
}

export function buildParentStoryBookScenesPreview(input: {
  request: ParentStoryBookRequest;
  imageStatus?: ParentStoryBookMediaStatus;
  audioStatus?: ParentStoryBookMediaStatus;
}) {
  const response = buildParentStoryBookResponse(input.request);
  return {
    ...response,
    scenes: response.scenes.map((scene) => ({
      ...scene,
      imageStatus: input.imageStatus ?? scene.imageStatus,
      audioStatus: input.audioStatus ?? scene.audioStatus,
      imageCacheHit: false,
      audioCacheHit: false,
    })),
  } satisfies ParentStoryBookResponse;
}
