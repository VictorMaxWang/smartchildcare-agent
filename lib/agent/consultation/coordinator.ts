import type {
  ConsultationParticipant,
  ConsultationResult,
  ConsultationResultSource,
} from "@/lib/ai/types";
import { analyzeCoparentingConsultation } from "@/lib/agent/consultation/coparenting-agent";
import { analyzeDietConsultation } from "@/lib/agent/consultation/diet-agent";
import { analyzeExecutionConsultation } from "@/lib/agent/consultation/execution-agent";
import { analyzeHealthConsultation } from "@/lib/agent/consultation/health-agent";
import type { ConsultationInput } from "@/lib/agent/consultation/input";
import { detectConsultationTrigger } from "@/lib/agent/consultation/trigger";

const PARTICIPANTS: ConsultationParticipant[] = [
  { id: "health-agent", label: "健康观察 Agent" },
  { id: "diet-agent", label: "饮食行为 Agent" },
  { id: "coparenting-agent", label: "家园沟通 Agent" },
  { id: "execution-agent", label: "园内执行 Agent" },
  { id: "coordinator", label: "协调器 Agent" },
];

function createConsultationId(childId: string) {
  return `consult-${childId}-${Date.now()}`;
}

function takeUnique(items: Array<string | undefined>, limit = 5) {
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

function mapToConsultationSource(source: ConsultationResultSource | "ai" | "fallback" | "mock"): ConsultationResultSource {
  if (source === "ai" || source === "fallback" || source === "mock") {
    return source;
  }
  return "rule";
}

export async function maybeRunHighRiskConsultation(input: ConsultationInput): Promise<ConsultationResult | null> {
  const trigger = detectConsultationTrigger(input);
  if (!trigger.shouldTrigger) {
    return null;
  }

  const [healthFinding, dietFinding, coparentingFinding, executionFinding] = await Promise.all([
    Promise.resolve(analyzeHealthConsultation(input)),
    Promise.resolve(analyzeDietConsultation(input)),
    Promise.resolve(analyzeCoparentingConsultation(input)),
    Promise.resolve(analyzeExecutionConsultation(input)),
  ]);

  const agentFindings = [healthFinding, dietFinding, coparentingFinding, executionFinding];
  const schoolAction = executionFinding.actions[0] ?? healthFinding.actions[0] ?? "今日补齐关键观察并在离园前同步。";
  const homeAction = coparentingFinding.actions[0] ?? dietFinding.actions[0] ?? "今晚先执行一个核心家庭动作并记录反馈。";
  const observationPoints = takeUnique(agentFindings.flatMap((item) => item.observationPoints), 4);
  const shouldEscalateToAdmin =
    trigger.triggerTypes.includes("admin-priority") ||
    trigger.triggerTypes.includes("stale-intervention") ||
    trigger.riskLevel === "high";

  const finalConclusion = `${input.childName} 已进入高风险联合分析，需把园内复查、家庭动作和明日观察点压缩为同一条闭环。`;
  const problemDefinition = takeUnique([
    trigger.triggerReason,
    healthFinding.riskExplanation,
    dietFinding.riskExplanation,
  ], 1)[0] ?? `${input.childName} 当前存在需要跨角色协同的连续风险。`;
  const reviewIn48h =
    executionFinding.actions[1] ??
    input.currentInterventionCard?.reviewIn48h ??
    "48 小时内复看晨检、饮食和家长反馈是否同步改善。";

  return {
    consultationId: createConsultationId(input.childId),
    triggerReason: trigger.triggerReason,
    triggerType: trigger.triggerTypes,
    participants: PARTICIPANTS,
    childId: input.childId,
    riskLevel: trigger.riskLevel,
    agentFindings,
    coordinatorSummary: {
      finalConclusion,
      riskLevel: trigger.riskLevel,
      problemDefinition,
      schoolAction,
      homeAction,
      observationPoints,
      reviewIn48h,
      shouldEscalateToAdmin,
    },
    schoolAction,
    homeAction,
    observationPoints,
    reviewIn48h,
    shouldEscalateToAdmin,
    source: mapToConsultationSource(input.responseSource),
    model: input.model,
    generatedAt: input.generatedAt,
  };
}
