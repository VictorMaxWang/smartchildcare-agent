import { NextResponse } from "next/server";
import {
  buildAdminAgentContext,
  buildAdminDailyPriorityResult,
  buildAdminQuestionFollowUpPayload,
  buildAdminFollowUpResult,
  buildAdminWeeklyReportResult,
  buildAdminWeeklyReportSnapshot,
} from "@/lib/agent/admin-agent";
import type { AdminAgentRequestPayload, AdminAgentWorkflowType } from "@/lib/agent/admin-types";
import {
  executeFollowUp,
  executeSuggestion,
  executeWeeklyReport,
  getAiRuntimeOptions,
} from "@/lib/ai/server";

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

  const report = await executeWeeklyReport(
    {
      snapshot: buildAdminWeeklyReportSnapshot(payload, context),
    },
    runtimeOptions
  );
  const result = buildAdminWeeklyReportResult({
    context,
    report,
  });

  return NextResponse.json(result, { status: 200 });
}
