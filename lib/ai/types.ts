import type { AppStateSnapshot } from "@/lib/persistence/snapshot";

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
export type ConsultationResultSource = "ai" | "fallback" | "mock" | "rule" | "vivo";
export type MobileDraftType = "voice" | "ocr" | "feedback" | "observation";
export type MobileDraftSyncStatus = "local_pending" | "synced" | "failed";
export type ReminderType =
  | "family-task"
  | "review-48h"
  | "admin-focus"
  | "draft-sync";
export type ReminderStatus = "pending" | "acknowledged" | "done" | "snoozed";

export interface PromptMemoryContext {
  longTermTraits: string[];
  recentContinuitySignals: string[];
  lastConsultationTakeaways: string[];
  openLoops: string[];
}

export interface MemoryContextMeta {
  backend: string;
  degraded: boolean;
  usedSources: string[];
  errors: string[];
  matchedSnapshotIds: string[];
  matchedTraceIds: string[];
  [key: string]: unknown;
}

export interface MemoryContextSnapshotRecord {
  id: string;
  childId?: string;
  sessionId?: string;
  snapshotType: string;
  inputSummary?: string;
  snapshotJson: Record<string, unknown>;
  createdAt?: string;
}

export interface MemoryContextTraceRecord {
  id: string;
  traceId: string;
  childId?: string;
  sessionId?: string;
  nodeName: string;
  actionType: string;
  inputSummary?: string;
  outputSummary?: string;
  status: string;
  metadataJson?: Record<string, unknown>;
  createdAt?: string;
}

export interface MemoryContextProfileRecord {
  id: string;
  childId: string;
  profileJson: Record<string, unknown>;
  source?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MemoryContextEnvelope {
  childId: string;
  workflowType: string;
  childProfile?: MemoryContextProfileRecord;
  recentSnapshots: MemoryContextSnapshotRecord[];
  recentConsultations: MemoryContextSnapshotRecord[];
  relevantTraces: MemoryContextTraceRecord[];
  promptContext: PromptMemoryContext;
  meta: MemoryContextMeta;
}

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

export interface HighRiskAgentView {
  role:
    | "HealthObservationAgent"
    | "DietBehaviorAgent"
    | "ParentCommunicationAgent"
    | "InSchoolActionAgent"
    | "CoordinatorAgent";
  title: string;
  summary: string;
  signals: string[];
  actions: string[];
  observationPoints: string[];
  evidence: string[];
}

export interface DirectorDecisionCard {
  title: string;
  reason: string;
  recommendedOwnerRole: "teacher" | "parent" | "admin";
  recommendedOwnerName: string;
  recommendedAt: string;
  status: "pending" | "in_progress" | "completed";
}

export interface ExplainabilityItem {
  label: string;
  detail: string;
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

export interface HighRiskConsultationResult {
  consultationId: string;
  triggerReason: string;
  triggerType: ConsultationTriggerType[];
  triggerReasons: string[];
  participants: ConsultationParticipant[];
  childId: string;
  riskLevel: AiRiskLevel;
  agentFindings: ConsultationFinding[];
  summary: string;
  keyFindings: string[];
  healthAgentView: HighRiskAgentView;
  dietBehaviorAgentView: HighRiskAgentView;
  parentCommunicationAgentView: HighRiskAgentView;
  inSchoolActionAgentView: HighRiskAgentView;
  todayInSchoolActions: string[];
  tonightAtHomeActions: string[];
  followUp48h: string[];
  parentMessageDraft: string;
  directorDecisionCard: DirectorDecisionCard;
  explainability: ExplainabilityItem[];
  nextCheckpoints: string[];
  coordinatorSummary: ConsultationCoordinatorSummary;
  schoolAction: string;
  homeAction: string;
  observationPoints: string[];
  reviewIn48h: string;
  shouldEscalateToAdmin: boolean;
  continuityNotes?: string[];
  memoryMeta?: MemoryContextMeta;
  source: ConsultationResultSource;
  provider?: string;
  model?: string;
  providerTrace?: Record<string, unknown>;
  traceMeta?: Record<string, unknown>;
  realProvider?: boolean;
  fallback?: boolean;
  generatedAt: string;
}

export type ConsultationResult = HighRiskConsultationResult;

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
  memoryContext?: PromptMemoryContext;
  continuityNotes?: string[];
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
  memoryContext?: PromptMemoryContext;
  continuityNotes?: string[];
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
  continuityNotes?: string[];
  memoryMeta?: MemoryContextMeta;
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
  memoryContext?: PromptMemoryContext;
  continuityNotes?: string[];
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
  continuityNotes?: string[];
  memoryMeta?: MemoryContextMeta;
  disclaimer: string;
  source: "ai" | "fallback" | "mock";
  model?: string;
}

export type ParentMessageStopReason =
  | "passed"
  | "max_iterations"
  | "generator_fallback"
  | "evaluator_fallback"
  | "non_retryable_error"
  | "same_failure_twice"
  | "same_output_twice";

export type ParentMessageDecision = "approve" | "revise" | "block";

export interface ParentMessageReflexionRequest {
  targetChildId?: string | null;
  childId?: string | null;
  teacherNote?: string | null;
  issueSummary?: string | null;
  currentInterventionCard?: Record<string, unknown> | string | null;
  latestGuardianFeedback?: Record<string, unknown> | string | null;
  todayInSchoolActions?: string[];
  tonightHomeActions?: string[];
  snapshot?: Record<string, unknown> | null;
  visibleChildren?: Array<Record<string, unknown>>;
  sessionId?: string | null;
  institutionId?: string | null;
  traceId?: string | null;
  debugMemory?: boolean;
  debugLoop?: boolean;
}

export interface ParentMessageEvaluationMeta {
  score: number;
  canSend: boolean;
  problems: string[];
  revisionSuggestions: string[];
  iterationScores: number[];
  approvedIteration: number | null;
  stopReason: ParentMessageStopReason;
  fallback: boolean;
  provider?: string | null;
  model?: string | null;
  memoryContextUsed: boolean;
  decision: ParentMessageDecision;
}

export interface ParentMessageFinalOutput {
  title: string;
  summary: string;
  tonightActions: string[];
  wordingForParent: string;
  whyThisMatters: string;
  estimatedTime: string;
  followUpWindow: string;
  evaluationMeta: ParentMessageEvaluationMeta;
}

export interface ParentMessageDebugIteration {
  iteration: number;
  source: string;
  model?: string | null;
  fallback: boolean;
  revisionInstructions?: string | null;
  candidate: ParentMessageFinalOutput;
  evaluation: ParentMessageEvaluationMeta;
}

export interface ParentMessageReflexionResponse {
  finalOutput: ParentMessageFinalOutput;
  evaluationMeta: ParentMessageEvaluationMeta;
  revisionCount: number;
  source: string;
  model?: string | null;
  fallback: boolean;
  continuityNotes: string[];
  memoryMeta?: Record<string, unknown> | null;
  debugIterations?: ParentMessageDebugIteration[] | null;
}

export type ParentStoryBookMode = "storybook" | "card";
export type ParentStoryBookResultSource = "ai" | "fallback" | "mock" | "rule" | "vivo";
export type ParentStoryBookMediaStatus = "ready" | "mock" | "fallback" | "empty";
export type ParentStoryBookGenerationMode =
  | "child-personalized"
  | "manual-theme"
  | "hybrid";
export type ParentStoryBookPageCount = 4 | 6 | 8;
export type ParentStoryBookStylePreset =
  | "sunrise-watercolor"
  | "moonlit-cutout"
  | "forest-crayon";
export type ParentStoryBookHighlightKind =
  | "todayGrowth"
  | "warningSuggestion"
  | "consultationSummary"
  | "consultationAction"
  | "guardianFeedback"
  | "weeklyTrend"
  | "manualTheme"
  | "goalKeyword"
  | "childTrait";

export interface ParentStoryBookHighlightCandidate {
  kind: ParentStoryBookHighlightKind;
  title: string;
  detail: string;
  priority: number;
  source?: string;
}

export interface ParentStoryBookProviderMeta {
  provider: string;
  mode: string;
  transport?: string;
  imageProvider: string;
  audioProvider: string;
  stylePreset?: ParentStoryBookStylePreset;
  requestSource?: string;
  fallbackReason?: string | null;
  realProvider: boolean;
  highlightCount: number;
  sceneCount: number;
  cacheHitCount?: number;
  cacheWindowSeconds?: number;
}

export interface ParentStoryBookCacheMeta {
  storyResponse: "hit" | "miss" | "bypass";
  audioDelivery: "stream-url" | "inline-data-url" | "preview-only";
  ttlSeconds: number;
  realSceneCount: number;
}

export interface ParentStoryBookScene {
  sceneIndex: number;
  sceneTitle: string;
  sceneText: string;
  imagePrompt: string;
  imageUrl?: string | null;
  assetRef?: string | null;
  imageStatus: ParentStoryBookMediaStatus;
  audioUrl?: string | null;
  audioRef?: string | null;
  audioScript: string;
  audioStatus: ParentStoryBookMediaStatus;
  voiceStyle: string;
  highlightSource: string;
  imageCacheHit?: boolean;
  audioCacheHit?: boolean;
}

export interface ParentStoryBookRequest {
  childId?: string;
  storyMode?: ParentStoryBookMode | "auto";
  generationMode?: ParentStoryBookGenerationMode;
  manualTheme?: string;
  manualPrompt?: string;
  pageCount?: ParentStoryBookPageCount;
  goalKeywords?: string[];
  protagonistArchetype?: string;
  requestSource?: string;
  stylePreset?: ParentStoryBookStylePreset;
  stylePrompt?: string;
  snapshot: ChildSuggestionSnapshot;
  highlightCandidates: ParentStoryBookHighlightCandidate[];
  latestInterventionCard?: Record<string, unknown> | null;
  latestConsultation?: ConsultationResult | null;
  traceId?: string;
  debugMemory?: boolean;
}

export interface ParentStoryBookResponse {
  storyId: string;
  childId: string;
  mode: ParentStoryBookMode;
  title: string;
  summary: string;
  moral: string;
  parentNote: string;
  source: ParentStoryBookResultSource;
  fallback: boolean;
  fallbackReason?: string | null;
  generatedAt: string;
  stylePreset?: ParentStoryBookStylePreset;
  providerMeta: ParentStoryBookProviderMeta;
  scenes: ParentStoryBookScene[];
  cacheMeta?: ParentStoryBookCacheMeta;
}

export type ParentTrendIntent = "emotion" | "diet" | "sleep" | "health" | "growth_overall";
export type ParentTrendLabel = "改善" | "波动" | "稳定" | "需关注";
export type ParentTrendDirection = "up" | "down" | "flat" | "insufficient";
export type ParentTrendSeriesKind = "line" | "bar";

export interface ParentTrendQueryPayload {
  question: string;
  childId?: string;
  windowDays?: number;
  appSnapshot?: AppStateSnapshot;
  institutionId?: string;
  traceId?: string;
  debugMemory?: boolean;
}

export interface ParentTrendQueryChild {
  childId?: string | null;
  name?: string | null;
  nickname?: string | null;
  className?: string | null;
  institutionId?: string | null;
}

export interface ParentTrendQuerySummary {
  question: string;
  requestedWindowDays?: number | null;
  resolvedWindowDays: number;
  childId?: string | null;
  childName?: string | null;
}

export interface ParentTrendRange {
  startDate: string;
  endDate: string;
}

export interface ParentTrendSeriesPoint {
  date: string;
  label: string;
  value: number | null;
  rawCount: number;
  missing: boolean;
}

export interface ParentTrendSeries {
  id: string;
  label: string;
  unit: string;
  kind: ParentTrendSeriesKind;
  data: ParentTrendSeriesPoint[];
}

export interface ParentTrendComparison {
  baselineAvg: number | null;
  recentAvg: number | null;
  deltaPct: number | null;
  direction: ParentTrendDirection;
}

export interface ParentTrendSupportingSignal {
  sourceType: string;
  date?: string | null;
  summary: string;
}

export interface ParentTrendDataQuality {
  observedDays: number;
  coverageRatio: number;
  sparse: boolean;
  fallbackUsed: boolean;
  source: string;
}

export interface ParentTrendQueryResponse {
  query: ParentTrendQuerySummary;
  intent: ParentTrendIntent;
  metric: string;
  child: ParentTrendQueryChild;
  windowDays: number;
  range: ParentTrendRange;
  labels: string[];
  xAxis: string[];
  series: ParentTrendSeries[];
  trendLabel: ParentTrendLabel;
  trendScore: number;
  comparison: ParentTrendComparison;
  explanation: string;
  supportingSignals: ParentTrendSupportingSignal[];
  dataQuality: ParentTrendDataQuality;
  warnings: string[];
  memoryMeta?: Record<string, unknown> | null;
  source: string;
  fallback: boolean;
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
  memoryContext?: PromptMemoryContext;
  continuityNotes?: string[];
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
  continuityNotes?: string[];
  memoryMeta?: MemoryContextMeta;
  disclaimer: string;
  source: "ai" | "fallback" | "mock";
  model?: string;
}
