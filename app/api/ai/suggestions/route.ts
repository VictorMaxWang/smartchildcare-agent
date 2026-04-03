import { NextResponse } from "next/server";
import { executeSuggestion, getAiRuntimeOptions, isValidSuggestionPayload } from "@/lib/ai/server";
import type { AiSuggestionPayload, ChildSuggestionSnapshot } from "@/lib/ai/types";
import { buildConsultationInputFromSnapshot } from "@/lib/agent/consultation/input";
import { maybeRunHighRiskConsultation } from "@/lib/agent/consultation/coordinator";

export async function POST(request: Request) {
  let payload: AiSuggestionPayload | null = null;

  try {
    payload = (await request.json()) as AiSuggestionPayload;
  } catch (error) {
    console.error("[AI] Invalid suggestion payload", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidSuggestionPayload(payload)) {
    return NextResponse.json({ error: "Invalid snapshot payload" }, { status: 400 });
  }

  const result = await executeSuggestion(payload, getAiRuntimeOptions(request));
  const consultation =
    payload.scope === "institution"
      ? null
      : await maybeRunHighRiskConsultation(
          buildConsultationInputFromSnapshot({
            snapshot: payload.snapshot as ChildSuggestionSnapshot,
            suggestion: result,
            source: "api",
          })
        );

  if (consultation) {
    return NextResponse.json({ ...result, consultation }, { status: 200 });
  }

  return NextResponse.json(result, { status: 200 });
}
