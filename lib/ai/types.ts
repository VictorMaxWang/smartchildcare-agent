export type AiRiskLevel = "low" | "medium" | "high";
export type AiTrendPrediction = "up" | "stable" | "down";
export type ConsultationTriggerType =
  | "multi-risk"
  | "continuous-abnormality"
  | "stale-intervention"
  | "feedback-conflict"
  | "admin-priority";
export type ConsultationParticipantId =
  | "health-agent"
  | "diet-agent"
  | "coparenting-agent"
  | "execution-agent"
  | "coordinator";
export type ConsultationResultSource = "ai" | "fallback" | "mock" | "rule";
export type MobileDraftType = "voice" | "ocr" | "feedback" | "observation";
export type MobileDraftSyncStatus = "local_pending" | "synced" | "failed";
export type ReminderType =
  | "family-task"
  | "review-48h"
  | "admin-focus"
  | "draft-sync";
export type ReminderStatus = "pending" | "acknowledged" | "done";

export interface ConsultationTrigger {
  triggerType: ConsultationTriggerType;
  reason: string;
  score: number;
  evidence: string[];
}

export interface ConsultationParticipant {
  id: ConsultationParticipantId;
  label: string;
}

export interface ConsultationFinding {
  agentId: ConsultationParticipantId;
  title: string;
  riskExplanation: string;
  signals: string[];
  actions: string[];
  observationPoints: string[];
  evidence: string[];
}

export interface ConsultationCoordinatorSummary {
  finalConclusion: string;
  riskLevel: AiRiskLevel;
  problemDefinition: string;
  schoolAction: string;
  homeAction: string;
  observationPoints: string[];
  reviewIn48h: string;
  shouldEscalateToAdmin: boolean;
}

export interface ConsultationResult {
  consultationId: string;
  triggerReason: string;
  triggerType: ConsultationTriggerType[];
  participants: ConsultationParticipant[];
  childId: string;
  riskLevel: AiRiskLevel;
  agentFindings: ConsultationFinding[];
  coordinatorSummary: ConsultationCoordinatorSummary;
  schoolAction: string;
  homeAction: string;
  observationPoints: string[];
  reviewIn48h: string;
  shouldEscalateToAdmin: boolean;
  source: ConsultationResultSource;
  model?: string;
  generatedAt: string;
}

export interface MobileDraft {
  draftId: string;
  childId: string;
  draftType: MobileDraftType;
  targetRole: "teacher" | "parent" | "admin";
  content: string;
  structuredPayload?: Record<string, unknown>;
  syncStatus: MobileDraftSyncStatus;
  attachmentName?: string;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}

export interface ReminderItem {
  reminderId: string;
  reminderType: ReminderType;
  targetRole: "teacher" | "parent" | "admin";
  targetId: string;
  childId?: string;
  title: string;
  description: string;
  scheduledAt: string;
  status: ReminderStatus;
  sourceId?: string;
}

export interface RuleFallbackItem {
  title: string;
  description: string;
  level?: "success" | "warning" | "info";
  tags?: string[];
}

export interface ChildSuggestionSnapshot {
  child: {
    id: string;
    name: string;
    ageBand?: string;
    className?: string;
    allergies?: string[];
    specialNotes?: string;
  };
  summary: {
    health: {
      abnormalCount: number;
      handMouthEyeAbnormalCount: number;
      avgTemperature?: number;
      moodKeywords?: string[];
    };
    meals: {
      recordCount: number;
      hydrationAvg: number;
      balancedRate: number;
      monotonyDays: number;
      allergyRiskCount: number;
    };
    growth: {
      recordCount: number;
      attentionCount: number;
      pendingReviewCount: number;
      topCategories: Array<{ category: string; count: number }>;
    };
    feedback: {
      count: number;
      statusCounts: Record<string, number>;
      keywords: string[];
    };
  };
  recentDetails?: {
    health: Array<{
      date: string;
      temperature: number;
      mood: string;
      handMouthEye: "正常" | "异常";
      isAbnormal: boolean;
      remark?: string;
    }>;
    meals: Array<{
      date: string;
      meal: string;
      foods: string[];
      waterMl: number;
      preference: string;
      allergyReaction?: string;
    }>;
    growth: Array<{
      createdAt: string;
      category: string;
      description: string;
      needsAttention: boolean;
      followUpAction?: string;
      reviewStatus?: string;
    }>;
    feedback: Array<{
      date: string;
      status: string;
      content: string;
    }>;
  };
  ruleFallback: RuleFallbackItem[];
}

export interface InstitutionPrioritySummaryItem {
  targetType: "child" | "class" | "issue" | "family";
  targetId: string;
  targetName: string;
  priorityScore: number;
  priorityLevel: "P1" | "P2" | "P3";
  reason: string;
  evidence: string[];
  recommendedOwnerRole?: string;
  recommendedOwnerName?: string;
  recommendedAction: string;
  recommendedDeadline: string;
}

export interface InstitutionSuggestionSnapshot {
  institutionName: string;
  sevenDayOverview: {
    visibleChildren: number;
    classCount: number;
    attendanceRate: number;
    healthAbnormalCount: number;
    growthAttentionCount: number;
    pendingReviewCount: number;
    feedbackCount: number;
    feedbackCompletionRate: number;
    pendingDispatchCount: number;
  };
  priorityTopItems: InstitutionPrioritySummaryItem[];
  riskChildren: Array<{
    childId: string;
    childName: string;
    className: string;
    priorityLevel: "P1" | "P2" | "P3";
    priorityScore: number;
    reason: string;
  }>;
  riskClasses: Array<{
    className: string;
    priorityLevel: "P1" | "P2" | "P3";
    priorityScore: number;
    reason: string;
  }>;
  feedbackRiskItems: Array<{
    childId: string;
    childName: string;
    className: string;
    priorityLevel: "P1" | "P2" | "P3";
    reason: string;
    lastFeedbackDate?: string;
  }>;
  pendingDispatches: Array<{
    id: string;
    title: string;
    status: "pending" | "in_progress" | "completed";
    priorityLevel: "P1" | "P2" | "P3";
    recommendedOwnerName?: string;
    recommendedDeadline: string;
  }>;
  weeklyHighlights: string[];
  ruleFallback: RuleFallbackItem[];
}

export interface AiSuggestionPayload {
  scope?: "child" | "institution";
  snapshot: ChildSuggestionSnapshot | InstitutionSuggestionSnapshot;
}

export interface AiActionPlan {
  schoolActions: string[];
  familyActions: string[];
  reviewActions: string[];
}

export interface AiSuggestionResponse {
  riskLevel: AiRiskLevel;
  summary: string;
  highlights: string[];
  concerns: string[];
  actions: string[];
  actionPlan?: AiActionPlan;
  consultation?: ConsultationResult;
  trendPrediction?: AiTrendPrediction;
  disclaimer: string;
  source: "ai" | "fallback" | "mock";
  model?: string;
}

export interface AiFollowUpPayload {
  scope?: "child" | "institution";
  snapshot: ChildSuggestionSnapshot | InstitutionSuggestionSnapshot;
  suggestionTitle: string;
  suggestionDescription?: string;
  question: string;
  history?: AiFollowUpMessage[];
  latestFeedback?: {
    date: string;
    status: string;
    content: string;
    executed?: boolean;
    childReaction?: string;
    improved?: boolean | "unknown";
    freeNote?: string;
  };
  currentInterventionCard?: {
    id?: string;
    title: string;
    tonightHomeAction: string;
    observationPoints: string[];
    tomorrowObservationPoint: string;
    reviewIn48h: string;
  };
  teacherSuggestionSummary?: string;
  familyTask?: {
    title: string;
    description: string;
    durationText?: string;
  };
  institutionContext?: {
    priorityTopItems: InstitutionPrioritySummaryItem[];
    pendingDispatches?: InstitutionSuggestionSnapshot["pendingDispatches"];
    weeklyHighlights?: string[];
  };
}

export interface AiFollowUpMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiFollowUpResponse {
  answer: string;
  keyPoints: string[];
  nextSteps: string[];
  tonightTopAction?: string;
  whyNow?: string;
  homeSteps?: string[];
  observationPoints?: string[];
  teacherObservation?: string;
  reviewIn48h?: string;
  recommendedQuestions?: string[];
  consultation?: ConsultationResult;
  disclaimer: string;
  source: "ai" | "fallback" | "mock";
  model?: string;
}

export interface WeeklyReportSnapshot {
  institutionName: string;
  periodLabel: string;
  role: string;
  overview: {
    visibleChildren: number;
    attendanceRate: number;
    mealRecordCount: number;
    healthAbnormalCount: number;
    growthAttentionCount: number;
    pendingReviewCount: number;
    feedbackCount: number;
  };
  diet: {
    balancedRate: number;
    hydrationAvg: number;
    monotonyDays: number;
    vegetableDays: number;
    proteinDays: number;
  };
  topAttentionChildren: Array<{
    childName: string;
    attentionCount: number;
    hydrationAvg: number;
    vegetableDays: number;
  }>;
  highlights: string[];
  risks: string[];
}

export interface WeeklyReportPayload {
  snapshot: WeeklyReportSnapshot;
}

export interface WeeklyReportResponse {
  summary: string;
  highlights: string[];
  risks: string[];
  nextWeekActions: string[];
  trendPrediction: AiTrendPrediction;
  disclaimer: string;
  source: "ai" | "fallback" | "mock";
  model?: string;
}
