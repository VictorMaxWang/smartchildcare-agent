import { NextResponse } from "next/server";
import { executeWeeklyReport, getAiRuntimeOptions, isValidWeeklyReportPayload } from "@/lib/ai/server";
import type { WeeklyReportPayload } from "@/lib/ai/types";
import { forwardBrainRequest } from "@/lib/server/brain-client";

export async function POST(request: Request) {
  const proxied = await forwardBrainRequest(request, "/api/v1/agents/reports/weekly");
  if (proxied) return proxied;

  let payload: WeeklyReportPayload | null = null;

  try {
    payload = (await request.json()) as WeeklyReportPayload;
  } catch (error) {
    console.error("[AI] Invalid weekly-report payload", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidWeeklyReportPayload(payload)) {
    return NextResponse.json({ error: "Invalid snapshot payload" }, { status: 400 });
  }

  const result = await executeWeeklyReport(payload, getAiRuntimeOptions(request));
  return NextResponse.json(result, { status: 200 });
}
