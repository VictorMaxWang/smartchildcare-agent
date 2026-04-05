import type {
  AiFollowUpPayload,
  AiFollowUpResponse,
  AiSuggestionResponse,
  ChildSuggestionSnapshot,
  ConsultationResult,
  RuleFallbackItem,
} from "@/lib/ai/types";
import { getLocalToday, isDateWithinLastDays, normalizeLocalDate } from "@/lib/date";
import { getWeeklyTaskForChild } from "@/lib/mock/coparenting";
import type {
  Child,
  GuardianFeedback,
  GrowthRecord,
  HealthCheckRecord,
  MealRecord,
  SmartInsight,
  TaskCheckInRecord,
  WeeklyDietTrend,
} from "@/lib/store";
import {
  attachConsultationToInterventionCard,
  buildInterventionCardFromSuggestion,
  mergeInterventionCardWithFollowUp,
  type InterventionCard,
} from "@/lib/agent/intervention-card";

export type ParentAgentResultSource = "ai" | "fallback" | "mock";

export interface ParentMessageMeta {
  revisionCount: number;
  score: number;
  canSend: boolean;
  fallback?: boolean;
  stopReason?: string;
  source?: string;
  model?: string;
}

export const PARENT_AGENT_QUICK_QUESTIONS = [
  "为什么最近不愿意去园？",
  "今晚我应该怎么陪伴？",
  "这几天饮水少怎么办？",
  "我做完之后应该怎么反馈？",
  "明天老师会继续看什么？",
] as const;

type ParentConversationHistoryItem = {
  question: string;
  answer: string;
};

export interface ParentAgentTask {
  id: string;
  title: string;
  description: string;
  durationText: string;
  tag: string;
}

export interface ParentAgentChildContext {
  today: string;
  child: Child;
  smartInsights: SmartInsight[];
  todayMeals: MealRecord[];
  weeklyMeals: MealRecord[];
  weeklyHealthChecks: HealthCheckRecord[];
  weeklyGrowthRecords: GrowthRecord[];
  attentionGrowthRecords: GrowthRecord[];
  pendingReviews: GrowthRecord[];
  weeklyFeedbacks: GuardianFeedback[];
  latestFeedback?: GuardianFeedback;
  weeklyTrend: WeeklyDietTrend;
  task: ParentAgentTask;
  taskCheckIns: TaskCheckInRecord[];
  teacherSuggestionSummary?: string;
  currentInterventionCard?: InterventionCard | null;
  focusReasons: string[];
  observationDefaults: string[];
}

export interface ParentAgentResult {
  title: string;
  summary: string;
  targetChildId: string;
  targetLabel: string;
  tonightTopAction: string;
  whyNow: string;
  homeSteps: string[];
  tonightObservationPoints: string[];
  teacherTomorrowObservation: string;
  recommendedQuestions: string[];
  feedbackPrompt: string;
  interventionCard: InterventionCard;
  consultation?: ConsultationResult;
  consultationMode?: boolean;
  highlights: string[];
  assistantAnswer: string;
  source: ParentAgentResultSource;
  model?: string;
  generatedAt: string;
  parentMessageMeta?: ParentMessageMeta;
}

function getAgeBandFromBirthDate(birthDate: string) {
  const birth = new Date(birthDate);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12;
  months += now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;

  if (months < 6) return "0–6个月";
  if (months < 12) return "6–12个月";
  if (months < 36) return "1–3岁";
  if (months < 72) return "3–6岁";
  return "6岁以上";
}

function uniqueItems(items: Array<string | undefined>, limit = 4) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const normalized = item?.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }

  return result;
}

function sortByDateDesc<T extends { date?: string; createdAt?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftValue = normalizeLocalDate(left.date ?? left.createdAt ?? "") ?? "";
    const rightValue = normalizeLocalDate(right.date ?? right.createdAt ?? "") ?? "";
    return rightValue.localeCompare(leftValue);
  });
}

function buildFocusReasons(params: {
  smartInsights: SmartInsight[];
  weeklyTrend: WeeklyDietTrend;
  pendingReviews: GrowthRecord[];
  weeklyHealthChecks: HealthCheckRecord[];
  latestFeedback?: GuardianFeedback;
}) {
  const warningInsights = params.smartInsights.filter((item) => item.level === "warning");
  const reasons = uniqueItems([
    ...warningInsights.map((item) => item.title),
    params.weeklyTrend.hydrationAvg < 140 ? `近 7 天平均饮水 ${params.weeklyTrend.hydrationAvg} ml，偏低` : undefined,
    params.pendingReviews.length > 0 ? `有 ${params.pendingReviews.length} 条待复查观察记录` : undefined,
    params.weeklyHealthChecks.some((item) => item.isAbnormal) ? "近 7 天出现过晨检异常，需要继续跟进" : undefined,
    params.latestFeedback
      ? `最近一次家长反馈为“${params.latestFeedback.status}”`
      : "最近缺少家长反馈，闭环还不完整",
  ]);

  return reasons.length > 0 ? reasons : ["近 7 天数据提示今晚适合先完成一个稳定执行动作，再看明天变化。"];
}

function buildObservationDefaults(context: {
  weeklyTrend: WeeklyDietTrend;
  attentionGrowthRecords: GrowthRecord[];
  weeklyHealthChecks: HealthCheckRecord[];
  latestFeedback?: GuardianFeedback;
}) {
  return uniqueItems([
    context.weeklyTrend.hydrationAvg < 140 ? "今晚是否比前几天更愿意主动喝水" : undefined,
    context.attentionGrowthRecords.some((item) => item.category === "情绪表现") ? "晚间情绪是否比接园前更稳定" : undefined,
    context.attentionGrowthRecords.some((item) => item.category === "睡眠情况") ? "入睡速度和晨起状态是否改善" : undefined,
    context.weeklyHealthChecks.some((item) => item.isAbnormal) ? "今晚是否还有异常体温或明显不适" : undefined,
    context.latestFeedback?.childReaction ? `延续关注：${context.latestFeedback.childReaction}` : undefined,
  ]);
}

function buildRuleFallbackItems(
  smartInsights: SmartInsight[],
  latestFeedback?: GuardianFeedback
): RuleFallbackItem[] {
  const items = smartInsights.slice(0, 4).map((item) => ({
    title: item.title,
    description: item.description,
    level: item.level,
    tags: item.tags,
  }));

  if (latestFeedback) {
    items.push({
      title: "最近一次家长反馈已纳入上下文",
      description: latestFeedback.content,
      level: latestFeedback.improved === false ? "warning" : "success",
      tags: [latestFeedback.status],
    });
  }

  return items.length > 0
    ? items
    : [
        {
          title: "当前暂无明显高风险提示",
          description: "今晚仍建议完成一项家庭动作并反馈执行结果，便于明天继续复查。",
          level: "info",
          tags: ["日常观察"],
        },
      ];
}

function buildFeedbackPrompt() {
  return "做完后请反馈 4 件事：是否已执行、孩子反应、是否改善、其他补充。";
}

function buildWhyNow(context: ParentAgentChildContext, suggestion: AiSuggestionResponse, topAction: string) {
  if (context.latestFeedback?.improved === false) {
    return "上一轮家庭动作效果还不稳定，今晚需要继续执行同一方向，方便老师明天判断是否要调整建议。";
  }

  if (suggestion.riskLevel === "high") {
    return "因为当前关注信号较集中，今晚越早做一个明确动作，明天老师越容易判断问题是在减轻还是持续。";
  }

  return `因为当前最值得跟进的是“${topAction}”，今晚先执行这一件事，明天就能更快看出是否有效。`;
}

function buildRecommendedQuestions(context: ParentAgentChildContext, responseQuestions?: string[]) {
  const dynamic = uniqueItems([
    ...PARENT_AGENT_QUICK_QUESTIONS,
    context.weeklyTrend.hydrationAvg < 140 ? "如果今晚还是不愿意喝水，下一步怎么做？" : undefined,
    context.pendingReviews.length > 0 ? "48 小时后我要重点回看哪一个变化？" : undefined,
    ...(responseQuestions ?? []),
  ]);

  return dynamic.slice(0, 5);
}

function buildAssistantAnswer(params: {
  summary: string;
  whyNow: string;
  tonightTopAction: string;
  homeSteps: string[];
  observationPoints: string[];
  teacherObservation: string;
}) {
  const stepsText = params.homeSteps.slice(0, 3).map((item, index) => `${index + 1}. ${item}`).join("\n");
  const observationText = params.observationPoints.map((item) => `- ${item}`).join("\n");

  return [
    params.summary,
    "",
    `今晚最该做的一件事：${params.tonightTopAction}`,
    `为什么现在做：${params.whyNow}`,
    "",
    "执行步骤：",
    stepsText,
    "",
    "今晚观察点：",
    observationText,
    "",
    `明天老师继续观察：${params.teacherObservation}`,
  ].join("\n");
}

export function buildParentAgentChildContext(params: {
  child: Child;
  smartInsights: SmartInsight[];
  healthCheckRecords: HealthCheckRecord[];
  mealRecords: MealRecord[];
  growthRecords: GrowthRecord[];
  guardianFeedbacks: GuardianFeedback[];
  taskCheckInRecords: TaskCheckInRecord[];
  weeklyTrend: WeeklyDietTrend;
  currentInterventionCard?: InterventionCard | null;
}) {
  const today = getLocalToday();
  const childId = params.child.id;
  const weeklyMeals = params.mealRecords.filter((item) => item.childId === childId && isDateWithinLastDays(item.date, 7, today));
  const todayMeals = weeklyMeals.filter((item) => item.date === today);
  const weeklyHealthChecks = sortByDateDesc(
    params.healthCheckRecords.filter((item) => item.childId === childId && isDateWithinLastDays(item.date, 7, today))
  );
  const weeklyGrowthRecords = sortByDateDesc(
    params.growthRecords.filter((item) => item.childId === childId && isDateWithinLastDays(item.createdAt, 7, today))
  );
  const weeklyFeedbacks = sortByDateDesc(
    params.guardianFeedbacks.filter((item) => item.childId === childId && isDateWithinLastDays(item.date, 7, today))
  );
  const attentionGrowthRecords = weeklyGrowthRecords.filter((item) => item.needsAttention);
  const pendingReviews = weeklyGrowthRecords.filter((item) => item.reviewStatus === "待复查");
  const task = getWeeklyTaskForChild(childId, getAgeBandFromBirthDate(params.child.birthDate) as never);
  const latestFeedback = weeklyFeedbacks[0];
  const focusReasons = buildFocusReasons({
    smartInsights: params.smartInsights,
    weeklyTrend: params.weeklyTrend,
    pendingReviews,
    weeklyHealthChecks,
    latestFeedback,
  });

  return {
    today,
    child: params.child,
    smartInsights: params.smartInsights,
    todayMeals,
    weeklyMeals,
    weeklyHealthChecks,
    weeklyGrowthRecords,
    attentionGrowthRecords,
    pendingReviews,
    weeklyFeedbacks,
    latestFeedback,
    weeklyTrend: params.weeklyTrend,
    task,
    taskCheckIns: params.taskCheckInRecords.filter((item) => item.childId === childId),
    teacherSuggestionSummary: params.smartInsights[0]?.description,
    currentInterventionCard: params.currentInterventionCard,
    focusReasons,
    observationDefaults: buildObservationDefaults({
      weeklyTrend: params.weeklyTrend,
      attentionGrowthRecords,
      weeklyHealthChecks,
      latestFeedback,
    }),
  } satisfies ParentAgentChildContext;
}

export function buildParentChildSuggestionSnapshot(context: ParentAgentChildContext): ChildSuggestionSnapshot {
  const topCategories = Array.from(
    context.weeklyGrowthRecords.reduce<Map<string, number>>((map, item) => {
      map.set(item.category, (map.get(item.category) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .map(([category, count]) => ({ category, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 3);

  const statusCounts = context.weeklyFeedbacks.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    child: {
      id: context.child.id,
      name: context.child.name,
      ageBand: getAgeBandFromBirthDate(context.child.birthDate),
      className: context.child.className,
      allergies: context.child.allergies,
      specialNotes: context.child.specialNotes,
    },
    summary: {
      health: {
        abnormalCount: context.weeklyHealthChecks.filter((item) => item.isAbnormal).length,
        handMouthEyeAbnormalCount: context.weeklyHealthChecks.filter((item) => item.handMouthEye === "异常").length,
        avgTemperature:
          context.weeklyHealthChecks.length > 0
            ? Number(
                (
                  context.weeklyHealthChecks.reduce((sum, item) => sum + item.temperature, 0) / context.weeklyHealthChecks.length
                ).toFixed(1)
              )
            : undefined,
        moodKeywords: uniqueItems(context.weeklyHealthChecks.map((item) => item.mood), 5),
      },
      meals: {
        recordCount: context.weeklyMeals.length,
        hydrationAvg: context.weeklyTrend.hydrationAvg,
        balancedRate: context.weeklyTrend.balancedRate,
        monotonyDays: context.weeklyTrend.monotonyDays,
        allergyRiskCount: context.weeklyMeals.filter((item) => Boolean(item.allergyReaction)).length,
      },
      growth: {
        recordCount: context.weeklyGrowthRecords.length,
        attentionCount: context.attentionGrowthRecords.length,
        pendingReviewCount: context.pendingReviews.length,
        topCategories,
      },
      feedback: {
        count: context.weeklyFeedbacks.length,
        statusCounts,
        keywords: uniqueItems([
          ...context.weeklyFeedbacks.map((item) => item.content),
          ...context.weeklyFeedbacks.map((item) => item.childReaction),
          ...context.weeklyFeedbacks.map((item) => item.freeNote),
        ], 5),
      },
    },
    recentDetails: {
      health: context.weeklyHealthChecks.slice(0, 5).map((item) => ({
        date: item.date,
        temperature: item.temperature,
        mood: item.mood,
        handMouthEye: item.handMouthEye,
        isAbnormal: item.isAbnormal,
        remark: item.remark,
      })),
      meals: context.weeklyMeals.slice(0, 5).map((item) => ({
        date: item.date,
        meal: item.meal,
        foods: item.foods.map((food) => `${food.name}(${food.amount})`),
        waterMl: item.waterMl,
        preference: item.preference,
        allergyReaction: item.allergyReaction,
      })),
      growth: context.weeklyGrowthRecords.slice(0, 5).map((item) => ({
        createdAt: item.createdAt,
        category: item.category,
        description: item.description,
        needsAttention: item.needsAttention,
        followUpAction: item.followUpAction,
        reviewStatus: item.reviewStatus,
      })),
      feedback: context.weeklyFeedbacks.slice(0, 4).map((item) => ({
        date: item.date,
        status: item.status,
        content: item.content,
      })),
    },
    ruleFallback: buildRuleFallbackItems(context.smartInsights, context.latestFeedback),
  };
}

function buildTriggerReason(context: ParentAgentChildContext, suggestion: AiSuggestionResponse) {
  return context.focusReasons[0] ?? suggestion.concerns[0] ?? "近 7 天数据提示当前需要家园协同跟进。";
}

function buildTomorrowObservation(context: ParentAgentChildContext, suggestion: AiSuggestionResponse) {
  return (
    suggestion.actionPlan?.reviewActions[0] ??
    context.pendingReviews[0]?.followUpAction ??
    context.pendingReviews[0]?.description ??
    `${context.child.name} 明日入园后的情绪、晨检状态和家庭反馈是否一致。`
  );
}

function buildReviewIn48h(context: ParentAgentChildContext, suggestion: AiSuggestionResponse) {
  return (
    suggestion.actionPlan?.reviewActions[0] ??
    (context.pendingReviews.length > 0
      ? `48 小时内重点回看 ${context.pendingReviews[0].category} 的变化，并确认家庭动作是否持续有效。`
      : "48 小时内结合今晚反馈和明早入园状态复查一次。")
  );
}

export function buildParentAgentSuggestionResult(params: {
  context: ParentAgentChildContext;
  suggestion: AiSuggestionResponse;
  generatedAt?: string;
}) {
  const generatedAt = params.generatedAt ?? new Date().toISOString();
  const triggerReason = buildTriggerReason(params.context, params.suggestion);
  const interventionCard = buildInterventionCardFromSuggestion({
    targetChildId: params.context.child.id,
    childName: params.context.child.name,
    triggerReason,
    suggestion: params.suggestion,
    tonightHomeAction: params.context.task.description,
    homeSteps: params.suggestion.actionPlan?.familyActions.slice(0, 4),
    observationPoints: params.context.observationDefaults,
    tomorrowObservationPoint: buildTomorrowObservation(params.context, params.suggestion),
    reviewIn48h: buildReviewIn48h(params.context, params.suggestion),
    generatedAt,
  });
  const tonightTopAction = interventionCard.tonightHomeAction;
  const whyNow = buildWhyNow(params.context, params.suggestion, tonightTopAction);
  const recommendedQuestions = buildRecommendedQuestions(params.context);
  const summary = params.suggestion.summary;

  const consultation = params.suggestion.consultation;
  const nextInterventionCard = attachConsultationToInterventionCard(interventionCard, consultation);

  return {
    title: `${params.context.child.name} 今晚行动建议`,
    summary,
    targetChildId: params.context.child.id,
    targetLabel: params.context.child.name,
    tonightTopAction,
    whyNow,
    homeSteps: interventionCard.homeSteps,
    tonightObservationPoints: interventionCard.observationPoints,
    teacherTomorrowObservation: interventionCard.tomorrowObservationPoint,
    recommendedQuestions,
    feedbackPrompt: buildFeedbackPrompt(),
    interventionCard: nextInterventionCard ?? interventionCard,
    consultation,
    consultationMode: Boolean(consultation),
    highlights: uniqueItems([...params.suggestion.highlights, ...params.context.focusReasons], 4),
    assistantAnswer: buildAssistantAnswer({
      summary,
      whyNow,
      tonightTopAction,
      homeSteps: interventionCard.homeSteps,
      observationPoints: interventionCard.observationPoints,
      teacherObservation: interventionCard.tomorrowObservationPoint,
    }),
    source: params.suggestion.source,
    model: params.suggestion.model,
    generatedAt,
  } satisfies ParentAgentResult;
}

export function buildParentAgentFollowUpPayload(params: {
  context: ParentAgentChildContext;
  question: string;
  suggestionResult: ParentAgentResult;
  history: ParentConversationHistoryItem[];
}): AiFollowUpPayload {
  return {
    snapshot: buildParentChildSuggestionSnapshot(params.context),
    suggestionTitle: params.suggestionResult.interventionCard.title,
    suggestionDescription: params.suggestionResult.summary,
    question: params.question,
    history: params.history.flatMap((item) => [
      { role: "user" as const, content: item.question },
      { role: "assistant" as const, content: item.answer },
    ]),
    latestFeedback: params.context.latestFeedback
      ? {
          date: params.context.latestFeedback.date,
          status: params.context.latestFeedback.status,
          content: params.context.latestFeedback.content,
          executed: params.context.latestFeedback.executed,
          childReaction: params.context.latestFeedback.childReaction,
          improved: params.context.latestFeedback.improved,
          freeNote: params.context.latestFeedback.freeNote,
        }
      : undefined,
    currentInterventionCard: {
      id: params.suggestionResult.interventionCard.id,
      title: params.suggestionResult.interventionCard.title,
      tonightHomeAction: params.suggestionResult.interventionCard.tonightHomeAction,
      observationPoints: params.suggestionResult.interventionCard.observationPoints,
      tomorrowObservationPoint: params.suggestionResult.interventionCard.tomorrowObservationPoint,
      reviewIn48h: params.suggestionResult.interventionCard.reviewIn48h,
    },
    teacherSuggestionSummary: params.context.teacherSuggestionSummary,
    familyTask: {
      title: params.context.task.title,
      description: params.context.task.description,
      durationText: params.context.task.durationText,
    },
  };
}

export function buildParentAgentFollowUpResult(params: {
  context: ParentAgentChildContext;
  baseResult: ParentAgentResult;
  response: AiFollowUpResponse;
  generatedAt?: string;
}) {
  const generatedAt = params.generatedAt ?? new Date().toISOString();
  const consultation = params.response.consultation;
  const mergedInterventionCard = mergeInterventionCardWithFollowUp(params.baseResult.interventionCard, params.response);
  const interventionCard =
    attachConsultationToInterventionCard(mergedInterventionCard, consultation) ?? mergedInterventionCard;
  const tonightTopAction = params.response.tonightTopAction ?? interventionCard.tonightHomeAction;
  const whyNow =
    params.response.whyNow ??
    `因为这条追问是在围绕“${params.baseResult.tonightTopAction}”继续细化，今晚执行结果会直接影响明天老师的跟进方式。`;
  const homeSteps = params.response.homeSteps?.length ? params.response.homeSteps : interventionCard.homeSteps;
  const tonightObservationPoints =
    params.response.observationPoints?.length ? params.response.observationPoints : interventionCard.observationPoints;
  const teacherTomorrowObservation = params.response.teacherObservation ?? interventionCard.tomorrowObservationPoint;
  const recommendedQuestions = buildRecommendedQuestions(params.context, params.response.recommendedQuestions);
  const summary = params.response.answer || params.baseResult.summary;

  return {
    title: `${params.context.child.name} 追问结果`,
    summary,
    targetChildId: params.context.child.id,
    targetLabel: params.context.child.name,
    tonightTopAction,
    whyNow,
    homeSteps,
    tonightObservationPoints,
    teacherTomorrowObservation,
    recommendedQuestions,
    feedbackPrompt: buildFeedbackPrompt(),
    interventionCard,
    consultation,
    consultationMode: Boolean(consultation),
    highlights: uniqueItems([...params.response.keyPoints, ...params.response.nextSteps], 4),
    assistantAnswer:
      params.response.answer ||
      buildAssistantAnswer({
        summary,
        whyNow,
        tonightTopAction,
        homeSteps,
        observationPoints: tonightObservationPoints,
        teacherObservation: teacherTomorrowObservation,
      }),
    source: params.response.source,
    model: params.response.model,
    generatedAt,
  } satisfies ParentAgentResult;
}
