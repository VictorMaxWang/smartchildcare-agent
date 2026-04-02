import { NextResponse } from "next/server";
import { requestDashscopeFollowUp, requestDashscopeSuggestion, requestDashscopeWeeklyReport } from "@/lib/ai/dashscope";
import { buildFallbackFollowUp, buildFallbackSuggestion, buildFallbackWeeklyReport } from "@/lib/ai/fallback";
import { buildMockAiFollowUp, buildMockAiSuggestion, buildMockWeeklyReport } from "@/lib/ai/mock";
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
  const configuredModel = process.env.AI_MODEL || "qwen-turbo";
  const forceMock = process.env.NEXT_PUBLIC_FORCE_MOCK_MODE === "true";
  const forceFallback = process.env.NODE_ENV !== "production" && request.headers.get("x-ai-force-fallback") === "1";
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

  if (payload.workflow === "communication") {
    if (!childContext) {
      return NextResponse.json({ error: "No visible child available for communication workflow" }, { status: 400 });
    }

    const followUpPayload = buildTeacherCommunicationFollowUpPayload(childContext);

    if (forceMock) {
      const result = buildTeacherCommunicationResult({
        context: childContext,
        response: buildMockAiFollowUp(followUpPayload),
        meta: { source: "mock", model: "mock-follow-up" },
      });
      return NextResponse.json(result, { status: 200 });
    }

    const fallbackResponse = buildFallbackFollowUp(followUpPayload);

    if (forceFallback) {
      const result = buildTeacherCommunicationResult({
        context: childContext,
        response: fallbackResponse,
        meta: { source: "fallback", model: "follow-up-rule-fallback" },
      });
      return NextResponse.json(result, { status: 200 });
    }

    const aiResponse = await requestDashscopeFollowUp(followUpPayload);
    const result = buildTeacherCommunicationResult({
      context: childContext,
      response: aiResponse ?? fallbackResponse,
      meta: aiResponse
        ? { source: "ai", model: configuredModel }
        : { source: "fallback", model: "follow-up-rule-fallback" },
    });

    return NextResponse.json(result, { status: 200 });
  }

  if (payload.workflow === "follow-up") {
    const snapshot = childContext ? buildTeacherChildSuggestionSnapshot(childContext) : null;

    if (forceMock && snapshot) {
      const result = buildTeacherFollowUpResult({
        classContext,
        childContext,
        suggestion: buildMockAiSuggestion(snapshot),
        meta: { source: "mock", model: "mock-suggestion" },
      });
      return NextResponse.json(result, { status: 200 });
    }

    if (forceFallback || !snapshot) {
      const result = buildTeacherFollowUpResult({
        classContext,
        childContext,
        suggestion: snapshot ? buildFallbackSuggestion(snapshot.ruleFallback) : undefined,
        meta: snapshot
          ? { source: "fallback", model: "rule-fallback" }
          : { source: "fallback" },
      });
      return NextResponse.json(result, { status: 200 });
    }

    const aiSuggestion = await requestDashscopeSuggestion(snapshot);
    const result = buildTeacherFollowUpResult({
      classContext,
      childContext,
      suggestion: aiSuggestion ?? buildFallbackSuggestion(snapshot.ruleFallback),
      meta: aiSuggestion
        ? { source: "ai", model: configuredModel }
        : { source: "fallback", model: "rule-fallback" },
    });

    return NextResponse.json(result, { status: 200 });
  }

  const weeklySnapshot = buildTeacherWeeklyReportSnapshot(classContext);

  if (forceMock) {
    const result = buildTeacherWeeklySummaryResult({
      classContext,
      report: buildMockWeeklyReport(weeklySnapshot),
      meta: { source: "mock", model: "mock-weekly-report" },
    });
    return NextResponse.json(result, { status: 200 });
  }

  const fallbackReport = buildFallbackWeeklyReport(weeklySnapshot);

  if (forceFallback) {
    const result = buildTeacherWeeklySummaryResult({
      classContext,
      report: fallbackReport,
      meta: { source: "fallback", model: "weekly-rule-fallback" },
    });
    return NextResponse.json(result, { status: 200 });
  }

  const aiReport = await requestDashscopeWeeklyReport(weeklySnapshot);
  const result = buildTeacherWeeklySummaryResult({
    classContext,
    report: aiReport ?? fallbackReport,
    meta: aiReport
      ? { source: "ai", model: configuredModel }
      : { source: "fallback", model: "weekly-rule-fallback" },
  });

  return NextResponse.json(result, { status: 200 });
}
