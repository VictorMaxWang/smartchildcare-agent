import { NextResponse } from "next/server";
import {
  buildAdminAgentContext,
  buildAdminDailyPriorityResult,
  buildAdminQuestionFollowUpPayload,
  buildAdminFollowUpResult,
  buildAdminWeeklyReportResultWithMemory,
  buildAdminWeeklyReportSnapshotWithMemory,
} from "@/lib/agent/admin-agent";
import type { AdminAgentRequestPayload, AdminAgentWorkflowType } from "@/lib/agent/admin-types";
import {
  executeFollowUp,
  executeSuggestion,
  executeWeeklyReport,
  getAiRuntimeOptions,
} from "@/lib/ai/server";
import { forwardBrainRequest } from "@/lib/server/brain-client";
import { buildMemoryContextForPrompt } from "@/lib/server/memory-context";

function isRecordArray(value: unknown) {
  return Array.isArray(value);
}

function isValidWorkflow(value: unknown): value is AdminAgentWorkflowType {
  return value === "daily-priority" || value === "question-follow-up" || value === "weekly-ops-report";
}

function isValidPayload(payload: unknown): payload is AdminAgentRequestPayload {
  if (!payload || typeof payload !== "object") return false;
  const obj = payload as Record<string, unknown>;

  return (
    isValidWorkflow(obj.workflow) &&
    obj.currentUser !== null &&
    typeof obj.currentUser === "object" &&
    isRecordArray(obj.visibleChildren) &&
    isRecordArray(obj.attendanceRecords) &&
    isRecordArray(obj.healthCheckRecords) &&
    isRecordArray(obj.growthRecords) &&
    isRecordArray(obj.guardianFeedbacks) &&
    isRecordArray(obj.mealRecords) &&
    obj.adminBoardData !== null &&
    typeof obj.adminBoardData === "object" &&
    obj.weeklyTrend !== null &&
    typeof obj.weeklyTrend === "object" &&
    isRecordArray(obj.smartInsights)
  );
}

export async function POST(request: Request) {
  const brainForward = await forwardBrainRequest(request, "/api/v1/agents/admin/run");
  if (brainForward.response) return brainForward.response;

  let payload: AdminAgentRequestPayload | null = null;

  try {
    payload = (await request.json()) as AdminAgentRequestPayload;
  } catch (error) {
    console.error("[AI] Invalid admin-agent payload", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidPayload(payload)) {
    return NextResponse.json({ error: "Invalid admin-agent payload" }, { status: 400 });
  }

  const context = buildAdminAgentContext(payload);
  const runtimeOptions = getAiRuntimeOptions(request);

  if (payload.workflow === "daily-priority") {
    const suggestion = await executeSuggestion(
      {
        scope: "institution",
        snapshot: context.suggestionSnapshot,
      },
      runtimeOptions
    );

    const result = buildAdminDailyPriorityResult({
      context,
      suggestion,
    });

    return NextResponse.json(result, { status: 200 });
  }

  if (payload.workflow === "question-follow-up") {
    const question = payload.question?.trim() || "今天最该优先处理的 3 件事是什么？";
    const response = await executeFollowUp(
      buildAdminQuestionFollowUpPayload({
        context,
        question,
        history: payload.history,
      }),
      runtimeOptions
    );

    const result = buildAdminFollowUpResult({
      context,
      question,
      response,
    });

    return NextResponse.json(result, { status: 200 });
  }

  const weeklyMemoryContexts = await Promise.all(
    (context.riskChildren.map((item) => item.childId).slice(0, 3).length > 0
      ? context.riskChildren.map((item) => item.childId).slice(0, 3)
      : payload.visibleChildren.map((item) => item.id).slice(0, 3)
    ).map((childId) =>
      buildMemoryContextForPrompt({
        childId,
        workflowType: "weekly-report",
        query: payload.question?.trim() || "weekly ops report risk child continuity",
        request,
      })
    )
  );
  const report = await executeWeeklyReport(
    {
      role: "admin",
      snapshot: buildAdminWeeklyReportSnapshotWithMemory(payload, context, weeklyMemoryContexts),
    },
    runtimeOptions
  );
  const result = buildAdminWeeklyReportResultWithMemory({
    context,
    report,
    memoryContexts: weeklyMemoryContexts,
  });

  return NextResponse.json(result, { status: 200 });
}
