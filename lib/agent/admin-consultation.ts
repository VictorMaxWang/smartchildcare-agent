import type { ConsultationResult, ExplainabilityItem } from "@/lib/ai/types";
import type { AdminDispatchEvent } from "@/lib/agent/admin-types";
import { buildConsultationResultTraceViewModel } from "@/lib/consultation/trace-view-model";
import type {
  ConsultationProviderTrace,
  ConsultationTraceMemoryState,
  ConsultationTraceProviderState,
} from "@/lib/consultation/trace-types";

export interface AdminConsultationChildMeta {
  id: string;
  name: string;
  className: string;
}

export interface AdminConsultationDecisionViewModel {
  consultationId: string;
  childId: string;
  childName: string;
  className: string;
  riskLevel: ConsultationResult["riskLevel"];
  riskLabel: string;
  priorityLabel: "P1" | "P2" | "P3";
  status: "pending" | "in_progress" | "completed";
  statusLabel: string;
  statusSource: "consultation" | "dispatch";
  summary: string;
  whyHighPriority: string;
  recommendedOwnerName: string;
  recommendedAt: string;
  recommendedAtLabel: string;
  generatedAtLabel: string;
  triggerReasons: string[];
  keyFindings: string[];
  schoolActions: string[];
  homeActions: string[];
  followUpActions: string[];
}

export interface AdminConsultationTraceViewModel {
  participants: string[];
  keyFindings: string[];
  collaborationSummary: string;
  explainability: ExplainabilityItem[];
  providerState: ConsultationTraceProviderState;
  providerStateLabel: string;
  providerLabel: string | null;
  memoryState: ConsultationTraceMemoryState;
  memoryStateLabel: string;
  memoryDetail: string | null;
  syncTargets: string[];
  evidenceHighlights: string[];
  providerTrace: ConsultationProviderTrace | null;
}

export interface AdminConsultationPriorityItem {
  consultation: ConsultationResult;
  decision: AdminConsultationDecisionViewModel;
  trace: AdminConsultationTraceViewModel;
  dispatchEvent?: AdminDispatchEvent;
}

const RISK_ORDER: Record<ConsultationResult["riskLevel"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const STATUS_ORDER: Record<AdminConsultationDecisionViewModel["status"], number> = {
  pending: 0,
  in_progress: 1,
  completed: 2,
};

function takeUnique(items: Array<string | undefined>, limit = 4) {
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

function formatDateTimeLabel(value: string) {
  if (!value) return "建议今日处理";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getRiskLabel(riskLevel: ConsultationResult["riskLevel"]) {
  if (riskLevel === "high") return "高风险预警";
  if (riskLevel === "medium") return "重点跟进";
  return "持续观察";
}

function getPriorityLabel(riskLevel: ConsultationResult["riskLevel"]): "P1" | "P2" | "P3" {
  if (riskLevel === "high") return "P1";
  if (riskLevel === "medium") return "P2";
  return "P3";
}

function getStatusLabel(status: AdminConsultationDecisionViewModel["status"]) {
  if (status === "completed") return "已完成";
  if (status === "in_progress") return "跟进中";
  return "待分派";
}

function getProviderStateLabel(state: ConsultationTraceProviderState) {
  if (state === "real") return "真实 Provider";
  if (state === "fallback") return "Fallback";
  return "Provider 未知";
}

function getMemoryStateLabel(state: ConsultationTraceMemoryState) {
  if (state === "ready") return "记忆已命中";
  if (state === "empty") return "空记忆";
  if (state === "degraded") return "记忆降级";
  return "记忆未知";
}

function resolveDispatchEvent(
  consultation: ConsultationResult,
  notificationEvents: AdminDispatchEvent[]
) {
  const directMatch = notificationEvents.find(
    (event) => event.targetType === "child" && event.targetId === consultation.childId
  );

  if (directMatch) return directMatch;

  return notificationEvents.find((event) =>
    event.source?.relatedChildIds?.includes(consultation.childId)
  );
}

function resolveDecisionStatus(
  consultation: ConsultationResult,
  dispatchEvent?: AdminDispatchEvent
) {
  if (dispatchEvent) {
    return {
      status: dispatchEvent.status,
      statusSource: "dispatch" as const,
    };
  }

  return {
    status: consultation.directorDecisionCard.status,
    statusSource: "consultation" as const,
  };
}

function buildProviderLabel(providerTrace: ConsultationProviderTrace | null) {
  if (!providerTrace) return null;

  const provider = String(providerTrace.provider ?? providerTrace.source ?? "").trim();
  const model = String(providerTrace.model ?? "").trim();

  if (provider && model) return `${provider} / ${model}`;
  if (provider) return provider;
  if (model) return model;
  return null;
}

function buildMemoryDetail(consultation: ConsultationResult) {
  const usedSources = Array.isArray(consultation.memoryMeta?.usedSources)
    ? consultation.memoryMeta.usedSources
    : [];
  const matchedSnapshots = Array.isArray(consultation.memoryMeta?.matchedSnapshotIds)
    ? consultation.memoryMeta.matchedSnapshotIds
    : [];

  if (usedSources.length > 0) {
    return `命中 ${usedSources.length} 个 memory source`;
  }

  if (matchedSnapshots.length > 0) {
    return `命中 ${matchedSnapshots.length} 个 snapshot`;
  }

  return null;
}

function buildTraceViewModel(consultation: ConsultationResult): AdminConsultationTraceViewModel {
  const traceViewModel = buildConsultationResultTraceViewModel({
    result: consultation,
    mode: "demo",
    streamMessage: "园长侧压缩展示多智能体会诊摘要、Explainability 和同步去向。",
  });
  const providerLabel = buildProviderLabel(traceViewModel.providerTrace);
  const evidenceHighlights = takeUnique(
    traceViewModel.stages.flatMap((stage) =>
      stage.evidence.map((item) => `${item.label}：${item.detail}`)
    ),
    4
  );

  return {
    participants: takeUnique(consultation.participants.map((item) => item.label), 5),
    keyFindings: takeUnique(consultation.keyFindings, 3),
    collaborationSummary: consultation.coordinatorSummary.finalConclusion || consultation.summary,
    explainability: consultation.explainability.slice(0, 3),
    providerState: traceViewModel.providerState,
    providerStateLabel: getProviderStateLabel(traceViewModel.providerState),
    providerLabel,
    memoryState: traceViewModel.memoryState,
    memoryStateLabel: getMemoryStateLabel(traceViewModel.memoryState),
    memoryDetail: buildMemoryDetail(consultation),
    syncTargets: traceViewModel.syncTargets,
    evidenceHighlights,
    providerTrace: traceViewModel.providerTrace,
  };
}

function buildDecisionViewModel(params: {
  consultation: ConsultationResult;
  child: AdminConsultationChildMeta | undefined;
  dispatchEvent?: AdminDispatchEvent;
}): AdminConsultationDecisionViewModel {
  const { consultation, child, dispatchEvent } = params;
  const resolvedStatus = resolveDecisionStatus(consultation, dispatchEvent);
  const recommendedAt =
    dispatchEvent?.recommendedDeadline || consultation.directorDecisionCard.recommendedAt || "";

  return {
    consultationId: consultation.consultationId,
    childId: consultation.childId,
    childName: child?.name ?? consultation.childId,
    className: child?.className ?? dispatchEvent?.source?.relatedClassNames?.[0] ?? "当前班级",
    riskLevel: consultation.riskLevel,
    riskLabel: getRiskLabel(consultation.riskLevel),
    priorityLabel: getPriorityLabel(consultation.riskLevel),
    status: resolvedStatus.status,
    statusLabel: getStatusLabel(resolvedStatus.status),
    statusSource: resolvedStatus.statusSource,
    summary: consultation.summary,
    whyHighPriority:
      consultation.directorDecisionCard.reason ||
      consultation.triggerReasons[0] ||
      consultation.keyFindings[0] ||
      consultation.summary,
    recommendedOwnerName:
      dispatchEvent?.recommendedOwnerName ||
      consultation.directorDecisionCard.recommendedOwnerName ||
      "园长待分派",
    recommendedAt,
    recommendedAtLabel: formatDateTimeLabel(recommendedAt),
    generatedAtLabel: formatDateTimeLabel(consultation.generatedAt),
    triggerReasons: takeUnique(consultation.triggerReasons, 3),
    keyFindings: takeUnique(consultation.keyFindings, 3),
    schoolActions: takeUnique(consultation.todayInSchoolActions, 2),
    homeActions: takeUnique(consultation.tonightAtHomeActions, 2),
    followUpActions: takeUnique(consultation.followUp48h, 2),
  };
}

export function buildAdminConsultationPriorityItems(params: {
  consultations: ConsultationResult[];
  children: AdminConsultationChildMeta[];
  notificationEvents?: AdminDispatchEvent[];
  limit?: number;
}) {
  const childMap = new Map(params.children.map((child) => [child.id, child] as const));
  const notificationEvents = params.notificationEvents ?? [];

  return params.consultations
    .filter((consultation) => consultation.shouldEscalateToAdmin)
    .map((consultation) => {
      const dispatchEvent = resolveDispatchEvent(consultation, notificationEvents);

      return {
        consultation,
        decision: buildDecisionViewModel({
          consultation,
          child: childMap.get(consultation.childId),
          dispatchEvent,
        }),
        trace: buildTraceViewModel(consultation),
        dispatchEvent,
      } satisfies AdminConsultationPriorityItem;
    })
    .sort((left, right) => {
      if (left.consultation.shouldEscalateToAdmin !== right.consultation.shouldEscalateToAdmin) {
        return Number(right.consultation.shouldEscalateToAdmin) - Number(left.consultation.shouldEscalateToAdmin);
      }

      const riskDiff = RISK_ORDER[left.consultation.riskLevel] - RISK_ORDER[right.consultation.riskLevel];
      if (riskDiff !== 0) return riskDiff;

      const statusDiff = STATUS_ORDER[left.decision.status] - STATUS_ORDER[right.decision.status];
      if (statusDiff !== 0) return statusDiff;

      return right.consultation.generatedAt.localeCompare(left.consultation.generatedAt);
    })
    .slice(0, params.limit ?? 4);
}
