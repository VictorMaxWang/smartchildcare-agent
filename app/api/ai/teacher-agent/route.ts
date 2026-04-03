import { NextResponse } from "next/server";
import {
  executeFollowUp,
  executeSuggestion,
  executeWeeklyReport,
  getAiRuntimeOptions,
} from "@/lib/ai/server";
import {
  buildTeacherAgentChildContext,
  buildTeacherAgentClassContext,
  buildTeacherChildSuggestionSnapshot,
  buildTeacherCommunicationFollowUpPayload,
  buildTeacherCommunicationResult,
  buildTeacherFollowUpResult,
  buildTeacherWeeklyReportSnapshot,
  buildTeacherWeeklySummaryResult,
  type TeacherAgentRequestPayload,
  type TeacherAgentWorkflowType,
} from "@/lib/agent/teacher-agent";
import { buildConsultationInputFromSnapshot } from "@/lib/agent/consultation/input";
import { maybeRunHighRiskConsultation } from "@/lib/agent/consultation/coordinator";
import { attachConsultationToInterventionCard } from "@/lib/agent/intervention-card";

function isRecordArray(value: unknown) {
  return Array.isArray(value);
}

function isValidWorkflow(value: unknown): value is TeacherAgentWorkflowType {
  return value === "communication" || value === "follow-up" || value === "weekly-summary";
}

function isValidPayload(payload: unknown): payload is TeacherAgentRequestPayload {
  if (!payload || typeof payload !== "object") return false;
  const obj = payload as Record<string, unknown>;

  return (
    isValidWorkflow(obj.workflow) &&
    (obj.scope === "class" || obj.scope === "child") &&
    obj.currentUser !== null &&
    typeof obj.currentUser === "object" &&
    isRecordArray(obj.visibleChildren) &&
    isRecordArray(obj.presentChildren) &&
    isRecordArray(obj.healthCheckRecords) &&
    isRecordArray(obj.growthRecords) &&
    isRecordArray(obj.guardianFeedbacks)
  );
}

export async function POST(request: Request) {
  let payload: TeacherAgentRequestPayload | null = null;

  try {
    payload = (await request.json()) as TeacherAgentRequestPayload;
  } catch (error) {
    console.error("[AI] Invalid teacher-agent payload", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidPayload(payload)) {
    return NextResponse.json({ error: "Invalid teacher-agent payload" }, { status: 400 });
  }

  const classContext = buildTeacherAgentClassContext(payload);
  const childContext = buildTeacherAgentChildContext(classContext, payload.targetChildId);
  const runtimeOptions = getAiRuntimeOptions(request);

  if (payload.workflow === "communication") {
    if (!childContext) {
      return NextResponse.json({ error: "No visible child available for communication workflow" }, { status: 400 });
    }

    const aiResponse = await executeFollowUp(buildTeacherCommunicationFollowUpPayload(childContext), runtimeOptions);
    const baseResult = buildTeacherCommunicationResult({
      context: childContext,
      response: aiResponse,
    });
    const consultation = await maybeRunHighRiskConsultation(
      buildConsultationInputFromSnapshot({
        snapshot: buildTeacherChildSuggestionSnapshot(childContext),
        latestFeedback: childContext.latestFeedback
          ? {
              date: childContext.latestFeedback.date,
              status: childContext.latestFeedback.status,
              content: childContext.latestFeedback.content,
              executed: childContext.latestFeedback.executed,
              childReaction: childContext.latestFeedback.childReaction,
              improved: childContext.latestFeedback.improved,
              freeNote: childContext.latestFeedback.freeNote,
            }
          : undefined,
        focusReasons: childContext.focusReasons,
        followUp: aiResponse,
        source: "teacher",
      })
    );
    const result = consultation
      ? {
          ...baseResult,
          consultation,
          consultationMode: true,
          interventionCard: attachConsultationToInterventionCard(baseResult.interventionCard, consultation),
        }
      : baseResult;

    return NextResponse.json(result, { status: 200 });
  }

  if (payload.workflow === "follow-up") {
    if (!childContext) {
      return NextResponse.json({ error: "No visible child available for follow-up workflow" }, { status: 400 });
    }

    const aiSuggestion = await executeSuggestion(
      { snapshot: buildTeacherChildSuggestionSnapshot(childContext) },
      runtimeOptions
    );
    const baseResult = buildTeacherFollowUpResult({
      classContext,
      childContext,
      suggestion: aiSuggestion,
    });
    const consultation = await maybeRunHighRiskConsultation(
      buildConsultationInputFromSnapshot({
        snapshot: buildTeacherChildSuggestionSnapshot(childContext),
        latestFeedback: childContext.latestFeedback
          ? {
              date: childContext.latestFeedback.date,
              status: childContext.latestFeedback.status,
              content: childContext.latestFeedback.content,
              executed: childContext.latestFeedback.executed,
              childReaction: childContext.latestFeedback.childReaction,
              improved: childContext.latestFeedback.improved,
              freeNote: childContext.latestFeedback.freeNote,
            }
          : undefined,
        focusReasons: childContext.focusReasons,
        suggestion: aiSuggestion,
        source: "teacher",
      })
    );
    const result = consultation
      ? {
          ...baseResult,
          consultation,
          consultationMode: true,
          interventionCard: attachConsultationToInterventionCard(baseResult.interventionCard, consultation),
        }
      : baseResult;

    return NextResponse.json(result, { status: 200 });
  }

  const aiReport = await executeWeeklyReport(
    { snapshot: buildTeacherWeeklyReportSnapshot(classContext) },
    runtimeOptions
  );
  const result = buildTeacherWeeklySummaryResult({
    classContext,
    report: aiReport,
  });

  return NextResponse.json(result, { status: 200 });
}
