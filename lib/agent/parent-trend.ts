import type { InterventionCard } from "@/lib/agent/intervention-card";
import type {
  ConsultationResult,
  MobileDraft,
  ParentTrendQueryPayload,
  ParentTrendQueryResponse,
  ReminderItem,
} from "@/lib/ai/types";
import type { AppStateSnapshot } from "@/lib/persistence/snapshot";
import type {
  AttendanceRecord,
  Child,
  GrowthRecord,
  GuardianFeedback,
  HealthCheckRecord,
  MealRecord,
  TaskCheckInRecord,
} from "@/lib/store";

export const PARENT_TREND_QUICK_QUESTIONS = [
  "最近一个月分离焦虑缓解了吗？",
  "这周饮食情况有改善吗？",
  "最近睡眠更稳定了吗？",
] as const;

const TREND_TIME_KEYWORDS = [
  "最近",
  "这周",
  "本周",
  "近7天",
  "7天",
  "最近一周",
  "近一周",
  "最近两周",
  "近两周",
  "14天",
  "最近一个月",
  "近一个月",
  "30天",
  "本月",
];

const TREND_MOVEMENT_KEYWORDS = [
  "改善",
  "稳定",
  "波动",
  "缓解",
  "趋势",
  "变化",
  "好转",
  "更稳定",
  "更好吗",
];

const TREND_TOPIC_KEYWORDS = [
  "情绪",
  "分离焦虑",
  "入园",
  "哭闹",
  "饮食",
  "吃饭",
  "喝水",
  "挑食",
  "睡眠",
  "午睡",
  "夜醒",
  "健康",
  "晨检",
  "体温",
  "成长",
];

function normalizeQuestion(value: string) {
  return value.replace(/[？?！!。，“”、,;；:\s]/g, "").toLowerCase();
}

const NORMALIZED_TREND_QUICK_QUESTIONS = new Set(
  PARENT_TREND_QUICK_QUESTIONS.map((item) => normalizeQuestion(item))
);

function includesAnyKeyword(text: string, keywords: readonly string[]) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

export function isLikelyTrendQuestion(question: string) {
  const trimmed = question.trim();
  if (!trimmed) return false;

  const normalized = normalizeQuestion(trimmed);
  if (NORMALIZED_TREND_QUICK_QUESTIONS.has(normalized)) {
    return true;
  }

  const lower = trimmed.toLowerCase();
  return (
    includesAnyKeyword(lower, TREND_TIME_KEYWORDS) &&
    includesAnyKeyword(lower, TREND_MOVEMENT_KEYWORDS) &&
    includesAnyKeyword(lower, TREND_TOPIC_KEYWORDS)
  );
}

export interface BuildParentTrendQueryPayloadInput {
  question: string;
  childId?: string;
  children: Child[];
  attendanceRecords: AttendanceRecord[];
  mealRecords: MealRecord[];
  growthRecords: GrowthRecord[];
  guardianFeedbacks: GuardianFeedback[];
  healthCheckRecords: HealthCheckRecord[];
  taskCheckInRecords: TaskCheckInRecord[];
  interventionCards: InterventionCard[];
  consultations: ConsultationResult[];
  mobileDrafts: MobileDraft[];
  reminders: ReminderItem[];
  traceId?: string;
  debugMemory?: boolean;
  updatedAt?: string;
}

export function buildParentTrendAppSnapshot(
  input: Omit<BuildParentTrendQueryPayloadInput, "question" | "childId" | "traceId" | "debugMemory">
): AppStateSnapshot {
  return {
    children: input.children,
    attendance: input.attendanceRecords,
    meals: input.mealRecords,
    growth: input.growthRecords,
    feedback: input.guardianFeedbacks,
    health: input.healthCheckRecords,
    taskCheckIns: input.taskCheckInRecords,
    interventionCards: input.interventionCards,
    consultations: input.consultations,
    mobileDrafts: input.mobileDrafts,
    reminders: input.reminders,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}

export function buildParentTrendQueryPayload(
  input: BuildParentTrendQueryPayloadInput
): ParentTrendQueryPayload {
  const appSnapshot = buildParentTrendAppSnapshot(input);

  return {
    question: input.question.trim(),
    childId: input.childId,
    appSnapshot,
    ...(input.traceId ? { traceId: input.traceId } : {}),
    ...(input.debugMemory ? { debugMemory: true } : {}),
  };
}

export function isTrendFallbackResult(result: ParentTrendQueryResponse | null) {
  if (!result) return false;
  return result.source === "demo_snapshot" || result.dataQuality.fallbackUsed || result.fallback;
}
