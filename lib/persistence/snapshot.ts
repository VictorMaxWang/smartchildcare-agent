import type {
  AttendanceRecord,
  Child,
  GrowthRecord,
  GuardianFeedback,
  HealthCheckRecord,
  MealRecord,
  TaskCheckInRecord,
} from "@/lib/store";
import type { ConsultationResult, MobileDraft, ReminderItem } from "@/lib/ai/types";
import type { InterventionCard } from "@/lib/agent/intervention-card";

export interface AppStateSnapshot {
  children: Child[];
  attendance: AttendanceRecord[];
  meals: MealRecord[];
  growth: GrowthRecord[];
  feedback: GuardianFeedback[];
  health: HealthCheckRecord[];
  taskCheckIns: TaskCheckInRecord[];
  interventionCards: InterventionCard[];
  consultations: ConsultationResult[];
  mobileDrafts: MobileDraft[];
  reminders: ReminderItem[];
  updatedAt: string;
}

function hasStringId(value: unknown) {
  return Boolean(value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string");
}

function isChild(value: unknown): value is Child {
  return hasStringId(value) && typeof (value as { name?: unknown }).name === "string";
}

function isAttendanceRecord(value: unknown): value is AttendanceRecord {
  return (
    hasStringId(value) &&
    typeof (value as { childId?: unknown }).childId === "string" &&
    typeof (value as { date?: unknown }).date === "string"
  );
}

function isMealRecord(value: unknown): value is MealRecord {
  return (
    hasStringId(value) &&
    typeof (value as { childId?: unknown }).childId === "string" &&
    Array.isArray((value as { foods?: unknown }).foods) &&
    (!(value as { photoUrls?: unknown }).photoUrls ||
      (Array.isArray((value as { photoUrls?: unknown }).photoUrls) &&
        (value as { photoUrls: unknown[] }).photoUrls.every((item) => typeof item === "string")))
  );
}

function isGrowthRecord(value: unknown): value is GrowthRecord {
  return (
    hasStringId(value) &&
    typeof (value as { childId?: unknown }).childId === "string" &&
    typeof (value as { description?: unknown }).description === "string"
  );
}

function isGuardianFeedback(value: unknown): value is GuardianFeedback {
  const item = value as {
    childId?: unknown;
    content?: unknown;
    interventionCardId?: unknown;
    sourceWorkflow?: unknown;
    executed?: unknown;
    childReaction?: unknown;
    improved?: unknown;
    freeNote?: unknown;
  };

  return (
    hasStringId(value) &&
    typeof item.childId === "string" &&
    typeof item.content === "string" &&
    (item.interventionCardId === undefined || typeof item.interventionCardId === "string") &&
    (item.sourceWorkflow === undefined ||
      item.sourceWorkflow === "parent-agent" ||
      item.sourceWorkflow === "teacher-agent" ||
      item.sourceWorkflow === "manual") &&
    (item.executed === undefined || typeof item.executed === "boolean") &&
    (item.childReaction === undefined || typeof item.childReaction === "string") &&
    (item.improved === undefined || typeof item.improved === "boolean" || item.improved === "unknown") &&
    (item.freeNote === undefined || typeof item.freeNote === "string")
  );
}

function isHealthCheckRecord(value: unknown): value is HealthCheckRecord {
  return (
    hasStringId(value) &&
    typeof (value as { childId?: unknown }).childId === "string" &&
    typeof (value as { date?: unknown }).date === "string"
  );
}

function isTaskCheckInRecord(value: unknown): value is TaskCheckInRecord {
  return (
    hasStringId(value) &&
    typeof (value as { childId?: unknown }).childId === "string" &&
    typeof (value as { taskId?: unknown }).taskId === "string"
  );
}

function isInterventionCard(value: unknown): value is InterventionCard {
  const item = value as {
    targetChildId?: unknown;
    riskLevel?: unknown;
    summary?: unknown;
    consultationMode?: unknown;
    consultationId?: unknown;
  };

  return (
    hasStringId(value) &&
    typeof item.targetChildId === "string" &&
    typeof item.summary === "string" &&
    (item.riskLevel === "low" || item.riskLevel === "medium" || item.riskLevel === "high") &&
    (item.consultationMode === undefined || typeof item.consultationMode === "boolean") &&
    (item.consultationId === undefined || typeof item.consultationId === "string")
  );
}

function isConsultationResult(value: unknown): value is ConsultationResult {
  const item = value as {
    consultationId?: unknown;
    childId?: unknown;
    triggerReason?: unknown;
    participants?: unknown;
    agentFindings?: unknown;
    shouldEscalateToAdmin?: unknown;
  };

  return (
    Boolean(item) &&
    typeof item === "object" &&
    typeof item.consultationId === "string" &&
    typeof item.childId === "string" &&
    typeof item.triggerReason === "string" &&
    Array.isArray(item.participants) &&
    Array.isArray(item.agentFindings) &&
    typeof item.shouldEscalateToAdmin === "boolean"
  );
}

function isMobileDraft(value: unknown): value is MobileDraft {
  const item = value as {
    draftId?: unknown;
    draftType?: unknown;
    targetRole?: unknown;
    content?: unknown;
    syncStatus?: unknown;
  };

  return (
    Boolean(item) &&
    typeof item === "object" &&
    typeof item.draftId === "string" &&
    typeof item.draftType === "string" &&
    typeof item.targetRole === "string" &&
    typeof item.content === "string" &&
    typeof item.syncStatus === "string"
  );
}

function isReminderItem(value: unknown): value is ReminderItem {
  const item = value as {
    reminderId?: unknown;
    reminderType?: unknown;
    targetRole?: unknown;
    title?: unknown;
    description?: unknown;
    scheduledAt?: unknown;
    status?: unknown;
  };

  return (
    Boolean(item) &&
    typeof item === "object" &&
    typeof item.reminderId === "string" &&
    typeof item.reminderType === "string" &&
    typeof item.targetRole === "string" &&
    typeof item.title === "string" &&
    typeof item.description === "string" &&
    typeof item.scheduledAt === "string" &&
    typeof item.status === "string"
  );
}

export function isAppStateSnapshot(value: unknown): value is AppStateSnapshot {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    Array.isArray(data.children) &&
    data.children.every(isChild) &&
    Array.isArray(data.attendance) &&
    data.attendance.every(isAttendanceRecord) &&
    Array.isArray(data.meals) &&
    data.meals.every(isMealRecord) &&
    Array.isArray(data.growth) &&
    data.growth.every(isGrowthRecord) &&
    Array.isArray(data.feedback) &&
    data.feedback.every(isGuardianFeedback) &&
    Array.isArray(data.health) &&
    data.health.every(isHealthCheckRecord) &&
    Array.isArray(data.taskCheckIns) &&
    data.taskCheckIns.every(isTaskCheckInRecord) &&
    Array.isArray(data.interventionCards) &&
    data.interventionCards.every(isInterventionCard) &&
    Array.isArray(data.consultations) &&
    data.consultations.every(isConsultationResult) &&
    Array.isArray(data.mobileDrafts) &&
    data.mobileDrafts.every(isMobileDraft) &&
    Array.isArray(data.reminders) &&
    data.reminders.every(isReminderItem) &&
    typeof data.updatedAt === "string"
  );
}
