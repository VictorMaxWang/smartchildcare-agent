import { NextResponse } from "next/server";
import { executeFollowUp, getAiRuntimeOptions, isValidFollowUpPayload } from "@/lib/ai/server";
import type { AiFollowUpPayload, ChildSuggestionSnapshot } from "@/lib/ai/types";
import { buildConsultationInputFromSnapshot } from "@/lib/agent/consultation/input";
import { maybeRunHighRiskConsultation } from "@/lib/agent/consultation/coordinator";

export async function POST(request: Request) {
  let payload: AiFollowUpPayload | null = null;

  try {
    payload = (await request.json()) as AiFollowUpPayload;
  } catch (error) {
    console.error("[AI] Invalid follow-up payload", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidFollowUpPayload(payload)) {
    return NextResponse.json({ error: "Invalid follow-up payload" }, { status: 400 });
  }

  const result = await executeFollowUp(payload, getAiRuntimeOptions(request));
  const consultation =
    payload.scope === "institution"
      ? null
      : await maybeRunHighRiskConsultation(
          buildConsultationInputFromSnapshot({
            snapshot: payload.snapshot as ChildSuggestionSnapshot,
            latestFeedback: payload.latestFeedback,
            currentInterventionCard: payload.currentInterventionCard,
            question: payload.question,
            followUp: result,
            source: "api",
          })
        );

  if (consultation) {
    return NextResponse.json({ ...result, consultation }, { status: 200 });
  }

  return NextResponse.json(result, { status: 200 });
}
