import type { AiFollowUpResponse, AiRiskLevel, AiSuggestionResponse, ConsultationResult } from "@/lib/ai/types";

export type InterventionCardSource = "ai" | "fallback" | "mock" | "vivo";

export interface InterventionCard {
  id: string;
  title: string;
  riskLevel: AiRiskLevel;
  targetChildId: string;
  triggerReason: string;
  summary: string;
  todayInSchoolAction: string;
  tonightHomeAction: string;
  homeSteps: string[];
  observationPoints: string[];
  tomorrowObservationPoint: string;
  reviewIn48h: string;
  parentMessageDraft: string;
  teacherFollowupDraft: string;
  consultationMode?: boolean;
  consultationId?: string;
  consultationSummary?: string;
  participants?: string[];
  shouldEscalateToAdmin?: boolean;
  source: InterventionCardSource;
  model?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InterventionCardFromSuggestionInput {
  targetChildId: string;
  childName: string;
  triggerReason: string;
  suggestion: AiSuggestionResponse;
  todayInSchoolAction?: string;
  tonightHomeAction?: string;
  homeSteps?: string[];
  observationPoints?: string[];
  tomorrowObservationPoint?: string;
  reviewIn48h?: string;
  generatedAt?: string;
}

export interface InterventionCardFromCommunicationInput {
  targetChildId: string;
  childName: string;
  triggerReason: string;
  summary: string;
  riskLevel?: AiRiskLevel;
  schoolActions?: string[];
  familyActions?: string[];
  observationPoints?: string[];
  tomorrowObservationPoint?: string;
  reviewIn48h?: string;
  source: InterventionCardSource;
  model?: string;
  generatedAt?: string;
}

export interface InterventionCardFromConsultationInput {
  targetChildId: string;
  childName: string;
  consultation: ConsultationResult;
  generatedAt?: string;
}

function sanitizeText(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
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

function mapConsultationSourceToCardSource(source: ConsultationResult["source"]): InterventionCardSource {
  return source === "rule" ? "fallback" : source;
}

export function buildInterventionCardId(targetChildId: string, title: string, seed?: string) {
  const normalizedTitle = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-\u4e00-\u9fa5]/g, "")
    .slice(0, 24);
  const normalizedSeed = (seed ?? new Date().toISOString()).replace(/[^0-9]/g, "").slice(-10);
  return `card-${targetChildId}-${normalizedTitle || "intervention"}-${normalizedSeed}`;
}

function buildParentMessageDraft(card: {
  childName: string;
  tonightHomeAction: string;
  observationPoints: string[];
}) {
  const observationText =
    card.observationPoints.length > 0 ? ` 请留意：${card.observationPoints.slice(0, 2).join("；")}。` : "";
  return `${card.childName} 今晚建议先做：${card.tonightHomeAction}。${observationText}做完后可在家长反馈里补充孩子反应和是否改善。`;
}

function buildTeacherFollowupDraft(card: {
  childName: string;
  tomorrowObservationPoint: string;
  reviewIn48h: string;
}) {
  return `明天继续观察 ${card.childName}：${card.tomorrowObservationPoint}。48 小时内重点复盘：${card.reviewIn48h}`;
}

function finalizeInterventionCard(input: {
  id?: string;
  childName: string;
  title: string;
  riskLevel: AiRiskLevel;
  targetChildId: string;
  triggerReason: string;
  summary: string;
  todayInSchoolAction: string;
  tonightHomeAction: string;
  homeSteps: string[];
  observationPoints: string[];
  tomorrowObservationPoint: string;
  reviewIn48h: string;
  parentMessageDraft?: string;
  teacherFollowupDraft?: string;
  consultationMode?: boolean;
  consultationId?: string;
  consultationSummary?: string;
  participants?: string[];
  shouldEscalateToAdmin?: boolean;
  source: InterventionCardSource;
  model?: string;
  createdAt?: string;
  updatedAt?: string;
  generatedAt?: string;
}): InterventionCard {
  const createdAt = input.createdAt ?? input.generatedAt ?? new Date().toISOString();
  const updatedAt = input.generatedAt ?? input.updatedAt ?? createdAt;
  const title = sanitizeText(input.title, `${input.childName} AI 干预卡`);
  const todayInSchoolAction = sanitizeText(input.todayInSchoolAction, "今天园内继续记录关键场景表现，并与家长同步执行重点。");
  const tonightHomeAction = sanitizeText(input.tonightHomeAction, "今晚先完成一项稳定情绪和作息的家庭动作，并记录孩子反应。");
  const observationPoints = uniqueItems(input.observationPoints, 4);
  const homeSteps = uniqueItems(input.homeSteps, 4);
  const tomorrowObservationPoint = sanitizeText(
    input.tomorrowObservationPoint,
    `${input.childName} 明日入园后的情绪、晨检状态和家庭反馈是否一致。`
  );
  const reviewIn48h = sanitizeText(input.reviewIn48h, "48 小时内结合今晚反馈和明早入园状态复查一次。");

  return {
    id: input.id ?? buildInterventionCardId(input.targetChildId, title, input.generatedAt),
    title,
    riskLevel: input.riskLevel,
    targetChildId: input.targetChildId,
    triggerReason: sanitizeText(input.triggerReason, "近 7 天数据提示当前需要家园协同跟进。"),
    summary: sanitizeText(input.summary, `${input.childName} 当前建议以今晚家庭动作和明日复查看点为主。`),
    todayInSchoolAction,
    tonightHomeAction,
    homeSteps:
      homeSteps.length > 0
        ? homeSteps
        : [tonightHomeAction, "记录孩子当下反应和持续时间。", "明早把执行结果反馈给老师。"],
    observationPoints:
      observationPoints.length > 0
        ? observationPoints
        : ["孩子情绪是否更稳定", "饮水或进食是否更配合", "入睡和晨起状态是否改善"],
    tomorrowObservationPoint,
    reviewIn48h,
    parentMessageDraft:
      input.parentMessageDraft?.trim() || buildParentMessageDraft({ childName: input.childName, tonightHomeAction, observationPoints }),
    teacherFollowupDraft:
      input.teacherFollowupDraft?.trim() ||
      buildTeacherFollowupDraft({ childName: input.childName, tomorrowObservationPoint, reviewIn48h }),
    consultationMode: input.consultationMode,
    consultationId: input.consultationId,
    consultationSummary: input.consultationSummary,
    participants: input.participants,
    shouldEscalateToAdmin: input.shouldEscalateToAdmin,
    source: input.source,
    model: input.model,
    createdAt,
    updatedAt,
  };
}

export function buildInterventionCardFromSuggestion(input: InterventionCardFromSuggestionInput): InterventionCard {
  const actionPlan = input.suggestion.actionPlan;
  const familyActions = uniqueItems([input.tonightHomeAction, ...(actionPlan?.familyActions ?? []), ...input.suggestion.actions], 4);
  const observationPoints = uniqueItems([
    ...(input.observationPoints ?? []),
    ...input.suggestion.highlights,
    ...input.suggestion.concerns,
  ], 4);
  const title = `${input.childName} 今晚家庭干预卡`;

  return finalizeInterventionCard({
    childName: input.childName,
    title,
    riskLevel: input.suggestion.riskLevel,
    targetChildId: input.targetChildId,
    triggerReason: input.triggerReason,
    summary: input.suggestion.summary,
    todayInSchoolAction: input.todayInSchoolAction ?? actionPlan?.schoolActions[0] ?? "",
    tonightHomeAction: familyActions[0] ?? "",
    homeSteps: input.homeSteps ?? familyActions.slice(0, 4),
    observationPoints,
    tomorrowObservationPoint: input.tomorrowObservationPoint ?? actionPlan?.reviewActions[0] ?? "",
    reviewIn48h: input.reviewIn48h ?? actionPlan?.reviewActions[0] ?? "",
    source: input.suggestion.source,
    model: input.suggestion.model,
    generatedAt: input.generatedAt,
  });
}

export function buildInterventionCardFromCommunication(
  input: InterventionCardFromCommunicationInput
): InterventionCard {
  const familyActions = uniqueItems(input.familyActions ?? [], 4);
  const title = `${input.childName} 家园协同干预卡`;

  return finalizeInterventionCard({
    childName: input.childName,
    title,
    riskLevel: input.riskLevel ?? "medium",
    targetChildId: input.targetChildId,
    triggerReason: input.triggerReason,
    summary: input.summary,
    todayInSchoolAction: input.schoolActions?.[0] ?? "",
    tonightHomeAction: familyActions[0] ?? "",
    homeSteps: familyActions,
    observationPoints: input.observationPoints ?? [],
    tomorrowObservationPoint: input.tomorrowObservationPoint ?? input.schoolActions?.[1] ?? "",
    reviewIn48h: input.reviewIn48h ?? input.familyActions?.[1] ?? "",
    source: input.source,
    model: input.model,
    generatedAt: input.generatedAt,
  });
}

export function buildInterventionCardFromConsultation(
  input: InterventionCardFromConsultationInput
): InterventionCard {
  const consultation = input.consultation;

  return finalizeInterventionCard({
    childName: input.childName,
    title: `${input.childName} 高风险家庭干预卡`,
    riskLevel: consultation.riskLevel,
    targetChildId: input.targetChildId,
    triggerReason: consultation.triggerReasons[0] ?? consultation.triggerReason,
    summary: consultation.summary,
    todayInSchoolAction: consultation.todayInSchoolActions[0] ?? consultation.schoolAction,
    tonightHomeAction: consultation.tonightAtHomeActions[0] ?? consultation.homeAction,
    homeSteps: consultation.tonightAtHomeActions,
    observationPoints: consultation.nextCheckpoints,
    tomorrowObservationPoint: consultation.followUp48h[0] ?? consultation.reviewIn48h,
    reviewIn48h: consultation.followUp48h[0] ?? consultation.reviewIn48h,
    parentMessageDraft: consultation.parentMessageDraft,
    consultationMode: true,
    consultationId: consultation.consultationId,
    consultationSummary: consultation.coordinatorSummary.finalConclusion,
    participants: consultation.participants.map((item) => item.label),
    shouldEscalateToAdmin: consultation.shouldEscalateToAdmin,
    source: mapConsultationSourceToCardSource(consultation.source),
    model: consultation.model,
    generatedAt: input.generatedAt,
  });
}

export function mergeInterventionCardWithFollowUp(card: InterventionCard, response: AiFollowUpResponse): InterventionCard {
  const nextHomeSteps = uniqueItems([...(response.homeSteps ?? []), ...card.homeSteps], 4);
  const nextObservationPoints = uniqueItems([...(response.observationPoints ?? []), ...card.observationPoints], 4);

  return finalizeInterventionCard({
    ...card,
    childName: card.title.replace(/ AI 干预卡$| 家园协同干预卡$/u, "").trim() || "孩子",
    title: card.title,
    riskLevel: card.riskLevel,
    targetChildId: card.targetChildId,
    triggerReason: card.triggerReason,
    summary: response.answer || card.summary,
    todayInSchoolAction: card.todayInSchoolAction,
    tonightHomeAction: response.tonightTopAction ?? card.tonightHomeAction,
    homeSteps: nextHomeSteps,
    observationPoints: nextObservationPoints,
    tomorrowObservationPoint: response.teacherObservation ?? card.tomorrowObservationPoint,
    reviewIn48h: response.reviewIn48h ?? card.reviewIn48h,
    parentMessageDraft: card.parentMessageDraft,
    teacherFollowupDraft: card.teacherFollowupDraft,
    source: response.source,
    model: response.model ?? card.model,
  });
}

export function attachConsultationToInterventionCard(
  card: InterventionCard | undefined,
  consultation: ConsultationResult | null | undefined
): InterventionCard | undefined {
  if (!card || !consultation) {
    return card;
  }

  return {
    ...card,
    consultationMode: true,
    consultationId: consultation.consultationId,
    consultationSummary: consultation.coordinatorSummary.finalConclusion,
    participants: consultation.participants.map((item) => item.label),
    shouldEscalateToAdmin: consultation.shouldEscalateToAdmin,
    riskLevel: consultation.riskLevel,
    summary: consultation.coordinatorSummary.problemDefinition || card.summary,
    todayInSchoolAction: consultation.schoolAction || card.todayInSchoolAction,
    tonightHomeAction: consultation.homeAction || card.tonightHomeAction,
    observationPoints:
      consultation.observationPoints.length > 0 ? consultation.observationPoints : card.observationPoints,
    reviewIn48h: consultation.reviewIn48h || card.reviewIn48h,
  };
}

export function getInterventionRiskBadgeLabel(riskLevel: AiRiskLevel) {
  if (riskLevel === "high") return "高关注";
  if (riskLevel === "medium") return "需跟进";
  return "日常观察";
}
