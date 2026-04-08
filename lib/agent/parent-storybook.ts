import type {
  ChildSuggestionSnapshot,
  ConsultationResult,
  ParentStoryBookGenerationMode,
  ParentStoryBookHighlightCandidate,
  ParentStoryBookHighlightKind,
  ParentStoryBookMediaStatus,
  ParentStoryBookMode,
  ParentStoryBookPageCount,
  ParentStoryBookRequest,
  ParentStoryBookResponse,
  ParentStoryBookScene,
  ParentStoryBookStylePreset,
} from "@/lib/ai/types";
import {
  buildParentAgentChildContext,
  buildParentChildSuggestionSnapshot,
} from "@/lib/agent/parent-agent";
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
  feed?: ParentFeed | null;
  healthCheckRecords: HealthCheckRecord[];
  mealRecords: MealRecord[];
  growthRecords: GrowthRecord[];
  guardianFeedbacks: GuardianFeedback[];
  taskCheckInRecords: TaskCheckInRecord[];
  latestInterventionCard?: InterventionCard | null;
  latestConsultation?: ConsultationResult | null;
  requestSource?: string;
  storyMode?: ParentStoryBookMode;
  generationMode?: ParentStoryBookGenerationMode;
  manualTheme?: string;
  manualPrompt?: string;
  pageCount?: ParentStoryBookPageCount;
  goalKeywords?: string[];
  protagonistArchetype?: string;
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

type NormalizedConsultation = {
  summary: string;
  homeAction: string;
  followUp48h: string;
  parentMessageDraft: string;
  schoolAction: string;
};

type NormalizedInterventionCard = {
  title: string;
  tonightHomeAction: string;
  reviewIn48h: string;
  tomorrowObservationPoint: string;
};

type StoryStage =
  | "opening"
  | "setup"
  | "challenge"
  | "support"
  | "attempt"
  | "wobble"
  | "small-success"
  | "landing";

type StoryIngredients = {
  childName: string;
  className?: string;
  focusTheme: string;
  goalKeywords: string[];
  protagonistArchetype: string;
  protagonistName: string;
  generationMode: ParentStoryBookGenerationMode;
  pageCount: ParentStoryBookPageCount;
  highlightCandidates: ParentStoryBookHighlightCandidate[];
  summaryHighlight: string;
  challengeDetail: string;
  supportDetail: string;
  attemptDetail: string;
  successDetail: string;
  wobbleDetail: string;
  tonightAction: string;
  tomorrowObservation: string;
  promptHint: string;
  parentNote: string;
  stylePrompt: string;
  storyMode: ParentStoryBookMode;
};

type ProtagonistDefinition = {
  archetype: string;
  label: string;
  visualCue: string;
};

type SyntheticSnapshotInput = {
  childId?: string | null;
  childName?: string;
  className?: string;
  theme?: string;
  goalKeywords?: string[];
  manualPrompt?: string;
};

const STORYBOOK_BASE_DATE = Date.UTC(2026, 3, 7, 12, 0, 0);
const STORYBOOK_FOCUS_FALLBACK = "慢慢长大的力量";

export const DEFAULT_PARENT_STORYBOOK_STYLE_PRESET: ParentStoryBookStylePreset =
  "sunrise-watercolor";
export const DEFAULT_PARENT_STORYBOOK_GENERATION_MODE: ParentStoryBookGenerationMode =
  "child-personalized";
export const DEFAULT_PARENT_STORYBOOK_PAGE_COUNT: ParentStoryBookPageCount = 6;
export const PARENT_STORYBOOK_PAGE_OPTIONS: ParentStoryBookPageCount[] = [4, 6, 8];
export const PARENT_STORYBOOK_THEME_CHIPS = [
  "勇气",
  "诚实",
  "分享",
  "表达情绪",
  "规则意识",
  "独立入睡",
] as const;

const PAGE_STRUCTURES: Record<ParentStoryBookPageCount, StoryStage[]> = {
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
};

const PROTAGONIST_DEFINITIONS: ProtagonistDefinition[] = [
  { archetype: "bunny", label: "小兔团团", visualCue: "圆圆耳朵、软软围巾" },
  { archetype: "bear", label: "小熊暖暖", visualCue: "毛绒外套、小小灯笼" },
  { archetype: "deer", label: "小鹿悠悠", visualCue: "细长步子、月光披风" },
  { archetype: "fox", label: "小狐狸点点", visualCue: "蓬松尾巴、暖橙小背包" },
  { archetype: "otter", label: "小水獭泡泡", visualCue: "亮晶晶眼睛、柔软披肩" },
];

export const PARENT_STORYBOOK_STYLE_PRESETS: ParentStoryBookStylePresetDefinition[] = [
  {
    id: "sunrise-watercolor",
    label: "晨光水彩",
    shortLabel: "晨光",
    description: "暖金色水彩与柔软纸感，适合把成长时刻讲得温柔、明亮。",
    stylePrompt:
      "儿童绘本插画，晨光水彩质感，暖金高光，柔软纸张肌理，治愈、童趣、适合移动端纵向绘本。",
  },
  {
    id: "moonlit-cutout",
    label: "月夜剪纸",
    shortLabel: "月夜",
    description: "静蓝夜色与层叠纸艺，适合睡前情绪、晚安故事与安抚主题。",
    stylePrompt:
      "儿童绘本插画，月夜剪纸风格，深蓝与奶白层叠，星光柔雾，安静、轻柔、适合晚安故事。",
  },
  {
    id: "forest-crayon",
    label: "森林蜡笔",
    shortLabel: "森林",
    description: "浅绿木质配色与手绘蜡笔纹理，更活泼，也更适合比赛演示。",
    stylePrompt:
      "儿童绘本插画，森林蜡笔风格，浅绿与木色，明显手绘纹理，轻冒险感，温暖而有生命力。",
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
  const offset = Number.parseInt(stableHash(seed).slice(0, 8), 16) % (24 * 60 * 60 * 1000);
  return new Date(STORYBOOK_BASE_DATE + offset).toISOString();
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizeKeywords(values?: string[] | null) {
  if (!values?.length) return [];
  return Array.from(
    new Set(values.map((value) => normalizeText(value)).filter(Boolean))
  ).slice(0, 4);
}

function resolveParentStoryBookPageCount(
  value?: number | null
): ParentStoryBookPageCount {
  if (value === 4 || value === 6 || value === 8) {
    return value;
  }
  return DEFAULT_PARENT_STORYBOOK_PAGE_COUNT;
}

export function resolveParentStoryBookStylePreset(
  value?: string | null
): ParentStoryBookStylePreset {
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

function resolveGenerationMode(input: {
  generationMode?: ParentStoryBookGenerationMode;
  feed?: ParentFeed | null;
  manualTheme?: string;
}) {
  if (input.generationMode) {
    return input.generationMode;
  }

  const hasTheme = Boolean(normalizeText(input.manualTheme));
  const hasFeed = Boolean(input.feed);
  if (hasTheme && hasFeed) return "hybrid";
  if (hasTheme) return "manual-theme";
  return hasFeed ? "child-personalized" : "manual-theme";
}

function pickFirstString(values: Array<unknown>) {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return "";
}

function shortenDetail(value: string, fallback: string) {
  const normalized = normalizeText(value) || fallback;
  if (normalized.length <= 38) return normalized;
  return `${normalized.slice(0, 38)}…`;
}

function buildSyntheticSnapshot(input: SyntheticSnapshotInput): ChildSuggestionSnapshot {
  const goalKeywords = normalizeKeywords(input.goalKeywords);
  const theme = normalizeText(input.theme);
  const manualPrompt = normalizeText(input.manualPrompt);
  const fallbackNote =
    theme || goalKeywords[0] || manualPrompt || STORYBOOK_FOCUS_FALLBACK;

  return {
    child: {
      id: input.childId ?? "storybook-guest",
      name: input.childName ?? "小朋友",
      className: input.className,
      specialNotes: fallbackNote,
    },
    summary: {
      health: {
        abnormalCount: 0,
        handMouthEyeAbnormalCount: 0,
        moodKeywords: theme ? [theme] : goalKeywords,
      },
      meals: {
        recordCount: 0,
        hydrationAvg: 0,
        balancedRate: 0,
        monotonyDays: 0,
        allergyRiskCount: 0,
      },
      growth: {
        recordCount: 0,
        attentionCount: 0,
        pendingReviewCount: 0,
        topCategories: theme ? [{ category: theme, count: 1 }] : [],
      },
      feedback: {
        count: 0,
        statusCounts: {},
        keywords: goalKeywords,
      },
    },
    ruleFallback: [
      {
        title: theme ? `主题：${theme}` : "成长主题",
        description:
          manualPrompt ||
          `把“${fallbackNote}”变成孩子能听、家长愿意读的温柔成长故事。`,
        level: "info",
        tags: goalKeywords,
      },
    ],
  };
}

function normalizeInterventionCard(
  card?: InterventionCard | Record<string, unknown> | null
): NormalizedInterventionCard | null {
  if (!card) return null;
  const record = card as Record<string, unknown>;
  return {
    title: pickFirstString([record.title, record.interventionTitle, record.summary]),
    tonightHomeAction: pickFirstString([
      record.tonightHomeAction,
      record.homeAction,
      record.action,
    ]),
    reviewIn48h: pickFirstString([
      record.reviewIn48h,
      record.followUp48h,
      record.reviewWindow,
    ]),
    tomorrowObservationPoint: pickFirstString([
      record.tomorrowObservationPoint,
      record.teacherFollowupDraft,
      record.observationPoint,
    ]),
  };
}

function normalizeConsultation(
  consultation?: ConsultationResult | null
): NormalizedConsultation | null {
  if (!consultation) return null;
  return {
    summary: normalizeText(consultation.summary),
    homeAction: normalizeText(consultation.homeAction),
    followUp48h: consultation.followUp48h?.[0] ?? "",
    parentMessageDraft: normalizeText(consultation.parentMessageDraft),
    schoolAction: normalizeText(consultation.schoolAction),
  };
}

function summarizeTrend(trend: WeeklyDietTrend) {
  const items = [
    trend.hydrationAvg ? `饮水约 ${trend.hydrationAvg}ml` : "",
    trend.balancedRate ? `均衡率 ${trend.balancedRate}%` : "",
    trend.monotonyDays ? `单一饮食 ${trend.monotonyDays} 天` : "",
  ].filter(Boolean);
  return items.join("，");
}

function readRecordText(record: Record<string, unknown>, keys: string[]) {
  return pickFirstString(keys.map((key) => record[key]));
}

function buildChildHighlightCandidates(params: {
  feed: ParentFeed;
  snapshot: ChildSuggestionSnapshot;
  latestInterventionCard?: InterventionCard | null;
  latestConsultation?: ConsultationResult | null;
}) {
  const todayGrowth = params.feed.todayGrowth[0];
  const warningSuggestion =
    params.feed.suggestions.find((item) => item.level === "warning") ??
    params.feed.suggestions[0];
  const consultation = normalizeConsultation(params.latestConsultation);
  const card = normalizeInterventionCard(params.latestInterventionCard);
  const latestFeedback = params.feed.latestFeedback ?? params.feed.recentFeedbacks[0];
  const trendSummary = summarizeTrend(params.feed.weeklyTrend);
  const topCategory = params.snapshot.summary.growth.topCategories[0]?.category;

  const candidates: ParentStoryBookHighlightCandidate[] = [];

  candidates.push({
    kind: "todayGrowth",
    title: todayGrowth?.category || topCategory || "今天的小进步",
    detail:
      (todayGrowth &&
        readRecordText(todayGrowth as unknown as Record<string, unknown>, [
          "description",
          "followUpAction",
          "category",
        ])) ||
      warningSuggestion?.description ||
      "今天出现了一点点值得被看见的成长变化。",
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
      title: "近期建议",
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
      title: "今晚可以做的小事",
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
      title: "家长反馈",
      detail: feedbackDetail,
      priority: 5,
      source: "guardianFeedback",
    });
  }

  if (trendSummary) {
    candidates.push({
      kind: "weeklyTrend",
      title: "近一周趋势",
      detail: trendSummary,
      priority: 6,
      source: "weeklyTrend",
    });
  }

  const childTrait = pickFirstString([
    params.snapshot.summary.feedback.keywords[0],
    topCategory,
    params.snapshot.child.specialNotes,
  ]);
  if (childTrait) {
    candidates.push({
      kind: "childTrait",
      title: "孩子气质线索",
      detail: childTrait,
      priority: 7,
      source: "childTrait",
    });
  }

  return candidates
    .map((item) => ({
      ...item,
      detail: normalizeText(item.detail),
      title: normalizeText(item.title),
    }))
    .filter((item) => item.detail.length > 0)
    .sort((left, right) => left.priority - right.priority)
    .slice(0, 6);
}

function buildThemeHighlightCandidates(input: {
  manualTheme?: string;
  manualPrompt?: string;
  goalKeywords?: string[];
}) {
  const manualTheme = normalizeText(input.manualTheme);
  const manualPrompt = normalizeText(input.manualPrompt);
  const goalKeywords = normalizeKeywords(input.goalKeywords);

  const candidates: ParentStoryBookHighlightCandidate[] = [];

  if (manualTheme) {
    candidates.push({
      kind: "manualTheme",
      title: `主题：${manualTheme}`,
      detail:
        manualPrompt ||
        `把“${manualTheme}”讲成孩子能听懂、家长愿意读、今晚就能用上的成长故事。`,
      priority: 1,
      source: "manualTheme",
    });
  }

  goalKeywords.forEach((keyword, index) => {
    candidates.push({
      kind: "goalKeyword",
      title: `关键词：${keyword}`,
      detail: `故事会把“${keyword}”落到一个能被孩子感受到的小动作里。`,
      priority: index + 2,
      source: "goalKeyword",
    });
  });

  if (!candidates.length && manualPrompt) {
    candidates.push({
      kind: "manualTheme",
      title: "主题设定",
      detail: manualPrompt,
      priority: 1,
      source: "manualTheme",
    });
  }

  return candidates;
}

function dedupeHighlights(candidates: ParentStoryBookHighlightCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = [
      candidate.kind,
      normalizeText(candidate.title),
      normalizeText(candidate.detail),
    ].join("::");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resolveStoryMode(input: {
  requestStoryMode?: ParentStoryBookMode | "auto";
  generationMode: ParentStoryBookGenerationMode;
  snapshot: ChildSuggestionSnapshot;
  highlightCandidates: ParentStoryBookHighlightCandidate[];
}) {
  if (input.requestStoryMode === "card") return "card";
  if (input.generationMode === "manual-theme" || input.generationMode === "hybrid") {
    return "storybook";
  }
  if (!input.highlightCandidates.length) return "card";
  if (
    input.snapshot.summary.growth.recordCount === 0 &&
    input.snapshot.summary.feedback.count === 0
  ) {
    return "card";
  }
  return "storybook";
}

function createSyntheticThemeRequest(input: {
  feed?: ParentFeed | null;
  generationMode: ParentStoryBookGenerationMode;
  manualTheme?: string;
  manualPrompt?: string;
  goalKeywords?: string[];
}) {
  const usesChildContext = input.generationMode !== "manual-theme" && Boolean(input.feed);
  return buildSyntheticSnapshot({
    childId: usesChildContext ? input.feed?.child.id : null,
    childName: usesChildContext ? input.feed?.child.name : "小朋友",
    className: usesChildContext ? input.feed?.child.className : undefined,
    theme: input.manualTheme,
    goalKeywords: input.goalKeywords,
    manualPrompt: input.manualPrompt,
  });
}

export function buildParentStoryBookRequestFromFeed(
  input: ParentStoryBookPayloadInput
): ParentStoryBookRequest {
  const generationMode = resolveGenerationMode({
    generationMode: input.generationMode,
    feed: input.feed,
    manualTheme: input.manualTheme,
  });
  const stylePreset = resolveParentStoryBookStylePreset(input.stylePreset);
  const stylePrompt =
    normalizeText(input.stylePrompt) ||
    getParentStoryBookStylePresetDefinition(stylePreset).stylePrompt;
  const pageCount = resolveParentStoryBookPageCount(input.pageCount);
  const goalKeywords = normalizeKeywords(input.goalKeywords);
  const manualTheme = normalizeText(input.manualTheme);
  const manualPrompt = normalizeText(input.manualPrompt);

  const snapshot =
    input.feed && generationMode !== "manual-theme"
      ? buildParentChildSuggestionSnapshot(
          buildParentAgentChildContext({
            child: input.feed.child,
            smartInsights: input.feed.suggestions,
            healthCheckRecords: input.healthCheckRecords,
            mealRecords: input.mealRecords,
            growthRecords: input.growthRecords,
            guardianFeedbacks: input.guardianFeedbacks,
            taskCheckInRecords: input.taskCheckInRecords,
            weeklyTrend: input.feed.weeklyTrend,
            currentInterventionCard: input.latestInterventionCard ?? undefined,
          })
        )
      : createSyntheticThemeRequest({
          feed: input.feed,
          generationMode,
          manualTheme,
          manualPrompt,
          goalKeywords,
        });

  const childHighlights =
    input.feed && generationMode !== "manual-theme"
      ? buildChildHighlightCandidates({
          feed: input.feed,
          snapshot,
          latestInterventionCard: input.latestInterventionCard,
          latestConsultation: input.latestConsultation,
        })
      : [];
  const themeHighlights = buildThemeHighlightCandidates({
    manualTheme,
    manualPrompt,
    goalKeywords,
  });

  const highlightCandidates = dedupeHighlights(
    generationMode === "child-personalized"
      ? childHighlights
      : generationMode === "manual-theme"
        ? themeHighlights
        : [...themeHighlights, ...childHighlights]
  );

  return {
    childId:
      generationMode === "manual-theme"
        ? undefined
        : input.feed?.child.id ?? snapshot.child.id ?? undefined,
    storyMode: input.storyMode ?? "storybook",
    generationMode,
    manualTheme: manualTheme || undefined,
    manualPrompt: manualPrompt || undefined,
    pageCount,
    goalKeywords,
    protagonistArchetype: normalizeText(input.protagonistArchetype) || undefined,
    requestSource: input.requestSource ?? "parent-storybook-page",
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

function resolveFocusTheme(input: {
  generationMode: ParentStoryBookGenerationMode;
  manualTheme?: string;
  goalKeywords?: string[];
  snapshot: ChildSuggestionSnapshot;
  highlightCandidates: ParentStoryBookHighlightCandidate[];
}) {
  return pickFirstString([
    input.manualTheme,
    input.goalKeywords?.[0],
    input.snapshot.summary.growth.topCategories[0]?.category,
    input.snapshot.summary.feedback.keywords[0],
    input.highlightCandidates[0]?.title,
    STORYBOOK_FOCUS_FALLBACK,
  ]);
}

function resolveProtagonistArchetype(input: {
  requested?: string;
  focusTheme: string;
  childName: string;
  childHints: string[];
}) {
  const requested = normalizeText(input.requested);
  const explicit = PROTAGONIST_DEFINITIONS.find(
    (item) => item.archetype === requested
  );
  if (explicit) return explicit;

  const seed = [
    requested,
    input.focusTheme,
    input.childName,
    input.childHints.join("|"),
  ].join("::");
  const index =
    Number.parseInt(stableHash(seed).slice(0, 4), 16) %
    PROTAGONIST_DEFINITIONS.length;
  return PROTAGONIST_DEFINITIONS[index];
}

function buildParentNote(input: {
  childName: string;
  storyMode: ParentStoryBookMode;
  tonightAction: string;
  tomorrowObservation: string;
  generationMode: ParentStoryBookGenerationMode;
}) {
  if (input.storyMode === "card") {
    return `${input.childName} 今晚先用一张轻量成长卡收束情绪，再把最亮的一点小进步说给孩子听。`;
  }

  if (input.generationMode === "manual-theme") {
    return `今晚可以先试一件小事：${input.tonightAction}。明天继续观察：${input.tomorrowObservation}。`;
  }

  return `${input.childName} 今晚可以先试一件小事：${input.tonightAction}。明天继续观察：${input.tomorrowObservation}。`;
}

function buildMoral(input: {
  protagonistName: string;
  focusTheme: string;
  summaryHighlight: string;
}) {
  return `${input.protagonistName} 记住的，不是“要快一点”，而是“原来我可以慢慢学会 ${input.focusTheme}”。那些被看见的 ${input.summaryHighlight}，会一点点变成真正的力量。`;
}

function buildStoryIngredients(request: ParentStoryBookRequest) {
  const generationMode =
    request.generationMode ?? DEFAULT_PARENT_STORYBOOK_GENERATION_MODE;
  const pageCount = resolveParentStoryBookPageCount(request.pageCount);
  const focusTheme = resolveFocusTheme({
    generationMode,
    manualTheme: request.manualTheme,
    goalKeywords: request.goalKeywords,
    snapshot: request.snapshot,
    highlightCandidates: request.highlightCandidates,
  });
  const childName = normalizeText(request.snapshot.child.name) || "小朋友";
  const className = normalizeText(request.snapshot.child.className) || undefined;
  const consultation = normalizeConsultation(request.latestConsultation ?? null);
  const interventionCard = normalizeInterventionCard(request.latestInterventionCard ?? null);
  const highlightCandidates = request.highlightCandidates
    .map((item) => ({
      ...item,
      title: normalizeText(item.title),
      detail: normalizeText(item.detail),
      source: normalizeText(item.source) || item.kind,
    }))
    .filter((item) => item.detail.length > 0)
    .sort((left, right) => left.priority - right.priority);
  const summaryHighlight = shortenDetail(
    highlightCandidates[0]?.detail,
    "被轻轻看见的小进步"
  );
  const supportDetail = shortenDetail(
    pickFirstString([
      highlightCandidates.find((item) => item.kind === "consultationAction")?.detail,
      highlightCandidates.find((item) => item.kind === "guardianFeedback")?.detail,
      consultation?.summary,
      consultation?.schoolAction,
    ]),
    "大人把节奏放慢一点，先接住情绪，再陪它继续往前。"
  );
  const attemptDetail = shortenDetail(
    pickFirstString([
      highlightCandidates.find((item) => item.kind === "warningSuggestion")?.detail,
      highlightCandidates.find((item) => item.kind === "consultationSummary")?.detail,
      highlightCandidates[1]?.detail,
    ]),
    "先试一个小动作，再把脚步放稳。"
  );
  const successDetail = shortenDetail(
    pickFirstString([
      highlightCandidates.find((item) => item.kind === "todayGrowth")?.detail,
      highlightCandidates.find((item) => item.kind === "guardianFeedback")?.detail,
      highlightCandidates[2]?.detail,
    ]),
    "原来一点点靠近，也是在认真长大。"
  );
  const challengeDetail = shortenDetail(
    pickFirstString([
      highlightCandidates.find((item) => item.kind === "warningSuggestion")?.detail,
      highlightCandidates[0]?.detail,
      request.manualPrompt,
    ]),
    "面对新的小关卡时，心里还是会轻轻打鼓。"
  );
  const wobbleDetail = shortenDetail(
    pickFirstString([
      highlightCandidates.find((item) => item.kind === "weeklyTrend")?.detail,
      consultation?.summary,
      request.manualPrompt,
    ]),
    "有一点摇晃很正常，停一停，再出发就好。"
  );
  const tonightAction = pickFirstString([
    interventionCard?.tonightHomeAction,
    consultation?.homeAction,
    highlightCandidates.find((item) => item.kind === "consultationAction")?.detail,
    `和孩子一起做一个关于“${focusTheme}”的小练习`,
  ]);
  const tomorrowObservation = pickFirstString([
    interventionCard?.tomorrowObservationPoint,
    interventionCard?.reviewIn48h,
    consultation?.followUp48h,
    highlightCandidates.find((item) => item.kind === "weeklyTrend")?.detail,
    `明天再看看孩子遇到“${focusTheme}”时会不会更从容一点`,
  ]);
  const childHints = [
    request.snapshot.summary.feedback.keywords[0] ?? "",
    request.snapshot.summary.growth.topCategories[0]?.category ?? "",
    request.snapshot.child.specialNotes ?? "",
  ].filter(Boolean);
  const protagonist = resolveProtagonistArchetype({
    requested: request.protagonistArchetype,
    focusTheme,
    childName,
    childHints,
  });
  const storyMode = resolveStoryMode({
    requestStoryMode: request.storyMode,
    generationMode,
    snapshot: request.snapshot,
    highlightCandidates,
  });
  const parentNote = buildParentNote({
    childName,
    storyMode,
    tonightAction,
    tomorrowObservation,
    generationMode,
  });

  return {
    childName,
    className,
    focusTheme,
    goalKeywords: normalizeKeywords(request.goalKeywords),
    protagonistArchetype: protagonist.archetype,
    protagonistName: protagonist.label,
    generationMode,
    pageCount,
    highlightCandidates,
    summaryHighlight,
    challengeDetail,
    supportDetail,
    attemptDetail,
    successDetail,
    wobbleDetail,
    tonightAction,
    tomorrowObservation,
    promptHint: normalizeText(request.manualPrompt),
    parentNote,
    stylePrompt:
      normalizeText(request.stylePrompt) ||
      getParentStoryBookStylePresetDefinition(request.stylePreset).stylePrompt,
    storyMode,
  } satisfies StoryIngredients;
}

function buildSceneTitle(stage: StoryStage) {
  switch (stage) {
    case "opening":
      return "月光翻开第一页";
    case "setup":
      return "小脚步在路上";
    case "challenge":
      return "遇到一点点难";
    case "support":
      return "有人轻轻托住它";
    case "attempt":
      return "它决定再试一下";
    case "wobble":
      return "风吹来时先停一停";
    case "small-success":
      return "小小光亮出现了";
    case "landing":
      return "把温柔带回今晚";
  }
}

function buildSceneText(stage: StoryStage, ingredients: StoryIngredients) {
  const {
    protagonistName,
    focusTheme,
    summaryHighlight,
    challengeDetail,
    supportDetail,
    attemptDetail,
    successDetail,
    wobbleDetail,
    tonightAction,
    tomorrowObservation,
    generationMode,
  } = ingredients;

  switch (stage) {
    case "opening":
      return `${protagonistName} 今天想练习“${focusTheme}”。白天里，它已经悄悄做到了一点点：${summaryHighlight}。`;
    case "setup":
      return `它没有一下子就变得很厉害，而是先听一听、停一停，再把脚步放轻。${protagonistName} 知道，慢慢来也是一种本事。`;
    case "challenge":
      return `可当新的小关卡出现时，${protagonistName} 还是会有点犹豫。${challengeDetail}`;
    case "support":
      return `这时，老师和家长没有催它，只把声音放轻、把节奏放慢。${supportDetail}`;
    case "attempt":
      return `${protagonistName} 先做了一个最小的动作，再试一次。${attemptDetail}`;
    case "wobble":
      return `中间也会有一点摇晃，但那不是退步。${wobbleDetail}`;
    case "small-success":
      return `慢慢地，${protagonistName} 发现自己真的做到了。${successDetail}`;
    case "landing":
      return generationMode === "manual-theme"
        ? `今晚，只要先做一件小事：${tonightAction}。明天，再一起看看${tomorrowObservation}。`
        : `把这份小小的力量带回今晚吧：${tonightAction}。明天，再一起看看${tomorrowObservation}。`;
  }
}

function buildSceneVoiceStyle(stage: StoryStage) {
  if (stage === "landing") return "gentle-bedtime";
  if (stage === "challenge" || stage === "wobble") return "warm-storytelling";
  return "calm-encouraging";
}

function buildSceneImagePrompt(
  stage: StoryStage,
  sceneTitle: string,
  sceneText: string,
  ingredients: StoryIngredients
) {
  const keywordText = ingredients.goalKeywords.length
    ? `，关键词：${ingredients.goalKeywords.join("、")}`
    : "";
  const promptHint = ingredients.promptHint ? `，补充要求：${ingredients.promptHint}` : "";

  return [
    ingredients.stylePrompt,
    `儿童绘本插画，移动端纵向大画幅，拟人小动物主角“${ingredients.protagonistName}”`,
    `原型 ${ingredients.protagonistArchetype}，主题“${ingredients.focusTheme}”${keywordText}`,
    `分镜阶段：${stage}，标题“${sceneTitle}”`,
    `画面内容：${sceneText}`,
    `不要直接画真实孩子本人，不要照片感，不要复杂背景，不要说教标语${promptHint}`,
  ].join("，");
}

function buildSceneAudioScript(sceneTitle: string, sceneText: string) {
  return `${sceneTitle}。${sceneText}`;
}

function buildCardScene(ingredients: StoryIngredients): ParentStoryBookScene {
  const sceneTitle = "把今天轻轻收好";
  const sceneText = `${ingredients.protagonistName} 把今天那一点点亮光抱进怀里。今晚只做一件小事：${ingredients.tonightAction}。`;
  return {
    sceneIndex: 1,
    sceneTitle,
    sceneText,
    imagePrompt: buildSceneImagePrompt("landing", sceneTitle, sceneText, ingredients),
    imageUrl: "/storybook/card.svg",
    assetRef: "/storybook/card.svg",
    imageStatus: "fallback",
    audioUrl: null,
    audioRef: "storybook-audio-card",
    audioScript: buildSceneAudioScript(sceneTitle, sceneText),
    audioStatus: "fallback",
    voiceStyle: "gentle-bedtime",
    highlightSource: "rule",
    imageCacheHit: false,
    audioCacheHit: false,
  };
}

function selectHighlight(
  candidates: ParentStoryBookHighlightCandidate[],
  index: number,
  fallbackTitle: string,
  fallbackDetail: string
) {
  const candidate = candidates[index] ?? candidates[candidates.length - 1];
  if (candidate) return candidate;
  return {
    kind: "weeklyTrend" as ParentStoryBookHighlightKind,
    title: fallbackTitle,
    detail: fallbackDetail,
    priority: 99,
    source: "rule",
  };
}

function buildStoryScenes(ingredients: StoryIngredients) {
  if (ingredients.storyMode === "card") {
    return [buildCardScene(ingredients)];
  }

  return PAGE_STRUCTURES[ingredients.pageCount].map((stage, index) => {
    const fallbackDetail =
      stage === "landing" ? ingredients.tonightAction : ingredients.summaryHighlight;
    const highlight = selectHighlight(
      ingredients.highlightCandidates,
      index,
      buildSceneTitle(stage),
      fallbackDetail
    );
    const sceneTitle = buildSceneTitle(stage);
    const sceneText = buildSceneText(stage, ingredients);
    return {
      sceneIndex: index + 1,
      sceneTitle,
      sceneText,
      imagePrompt: buildSceneImagePrompt(stage, sceneTitle, sceneText, ingredients),
      imageUrl: `/storybook/scene-${Math.min(index + 1, 3)}.svg`,
      assetRef: `/storybook/scene-${Math.min(index + 1, 3)}.svg`,
      imageStatus: "fallback",
      audioUrl: null,
      audioRef: `storybook-audio-${index + 1}`,
      audioScript: buildSceneAudioScript(sceneTitle, sceneText),
      audioStatus: "fallback",
      voiceStyle: buildSceneVoiceStyle(stage),
      highlightSource: normalizeText(highlight.source) || highlight.kind,
      imageCacheHit: false,
      audioCacheHit: false,
    } satisfies ParentStoryBookScene;
  });
}

function buildStoryTitle(request: ParentStoryBookRequest, ingredients: StoryIngredients) {
  if (ingredients.generationMode === "manual-theme") {
    return `关于${ingredients.focusTheme}的成长绘本`;
  }
  if (ingredients.generationMode === "hybrid") {
    return `${ingredients.childName}的${ingredients.focusTheme}成长绘本`;
  }
  return `${ingredients.childName}的成长绘本`;
}

function buildStorySummary(request: ParentStoryBookRequest, ingredients: StoryIngredients) {
  const pageText = `${ingredients.storyMode === "card" ? 1 : ingredients.pageCount} 页`;
  if (ingredients.generationMode === "manual-theme") {
    return `这本 ${pageText} 绘本会把“${ingredients.focusTheme}”讲成孩子能听懂的小故事，并在最后自然落到今晚可以做的一件小事。`;
  }
  if (ingredients.generationMode === "hybrid") {
    return `这本 ${pageText} 绘本把“${ingredients.focusTheme}”和 ${ingredients.childName} 最近被看见的成长线索串成一条温柔、可朗读、可继续行动的成长闭环。`;
  }
  return `这本 ${pageText} 绘本会把 ${ingredients.childName} 最近被看见的小进步、今晚的陪伴动作和明天的观察点串成完整的成长故事。`;
}

function buildRequestSeed(request: ParentStoryBookRequest, ingredients: StoryIngredients) {
  return [
    request.childId ?? request.snapshot.child.id ?? "storybook-guest",
    ingredients.storyMode,
    ingredients.generationMode,
    ingredients.pageCount,
    request.stylePreset ?? DEFAULT_PARENT_STORYBOOK_STYLE_PRESET,
    ingredients.focusTheme,
    ingredients.protagonistArchetype,
    request.goalKeywords?.join("|") ?? "",
    ingredients.highlightCandidates
      .map((item) => `${item.kind}:${item.title}:${item.detail}`)
      .join("|"),
    request.requestSource ?? "",
  ].join("::");
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
  const stylePreset = resolveParentStoryBookStylePreset(request.stylePreset);
  const ingredients = buildStoryIngredients({
    ...request,
    stylePreset,
  });
  const scenes = buildStoryScenes(ingredients);
  const storySeed = buildRequestSeed(request, ingredients);
  const storyId = `storybook-${stableHash(storySeed)}`;
  const generatedAt = buildStableTimestamp(storySeed);
  const fallbackReason =
    options?.fallbackReason ??
    (ingredients.storyMode === "card"
      ? "sparse-parent-context"
      : "mock-storybook-pipeline");

  return {
    storyId,
    childId: request.childId ?? request.snapshot.child.id ?? "storybook-guest",
    mode: ingredients.storyMode,
    title: buildStoryTitle(request, ingredients),
    summary: buildStorySummary(request, ingredients),
    moral: buildMoral({
      protagonistName: ingredients.protagonistName,
      focusTheme: ingredients.focusTheme,
      summaryHighlight: ingredients.summaryHighlight,
    }),
    parentNote: ingredients.parentNote,
    source: options?.source ?? "rule",
    fallback: options?.fallback ?? true,
    fallbackReason,
    generatedAt,
    stylePreset,
    providerMeta: {
      provider: "parent-storybook-rule",
      mode: "fallback",
      transport: options?.transport ?? "next-json-fallback",
      imageProvider: "storybook-asset",
      audioProvider: "storybook-mock-preview",
      stylePreset,
      requestSource: request.requestSource ?? "parent-storybook-page",
      fallbackReason,
      realProvider: false,
      highlightCount: ingredients.highlightCandidates.length,
      sceneCount: scenes.length,
      cacheHitCount: 0,
      cacheWindowSeconds: 0,
    },
    scenes,
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
