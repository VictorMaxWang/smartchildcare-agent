import { NextResponse } from "next/server";
import { executeFollowUp, getAiRuntimeOptions, isValidFollowUpPayload } from "@/lib/ai/server";
import type { AiFollowUpPayload, ChildSuggestionSnapshot } from "@/lib/ai/types";
import { buildConsultationInputFromSnapshot } from "@/lib/agent/consultation/input";
import { maybeRunHighRiskConsultation } from "@/lib/agent/consultation/coordinator";
import { forwardBrainRequest } from "@/lib/server/brain-client";
import { buildMemoryContextForPrompt } from "@/lib/server/memory-context";

export async function POST(request: Request) {
  const proxied = await forwardBrainRequest(request, "/api/v1/agents/parent/follow-up");
  if (proxied) return proxied;

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

  const memoryContext =
    payload.scope === "institution" || !("child" in payload.snapshot)
      ? null
      : await buildMemoryContextForPrompt({
          childId: payload.snapshot.child.id,
          workflowType: "parent-follow-up",
          query: payload.question,
          request,
        });
  const nextPayload =
    payload.scope === "institution" || !("child" in payload.snapshot) || !memoryContext
      ? payload
      : {
          ...payload,
          snapshot: {
            ...payload.snapshot,
            memoryContext: memoryContext.promptContext,
            continuityNotes: payload.snapshot.continuityNotes ?? [
              `参考了${payload.snapshot.child.name}的长期与近期连续上下文`,
            ],
          },
          memoryContext: memoryContext.promptContext,
          continuityNotes: payload.continuityNotes,
        };

  const result = await executeFollowUp(nextPayload, getAiRuntimeOptions(request));
  const consultation =
    payload.scope === "institution"
      ? null
      : await maybeRunHighRiskConsultation(
          buildConsultationInputFromSnapshot({
            snapshot: (nextPayload.snapshot as ChildSuggestionSnapshot),
            latestFeedback: payload.latestFeedback,
            currentInterventionCard: payload.currentInterventionCard,
            question: payload.question,
            followUp: result,
            source: "api",
            memoryContext,
          })
        );

  if (consultation) {
    return NextResponse.json(
      {
        ...result,
        consultation,
        continuityNotes: result.continuityNotes ?? consultation.continuityNotes,
        ...(process.env.NODE_ENV !== "production" || request.headers.get("x-debug-memory") === "1"
          ? { memoryMeta: result.memoryMeta ?? consultation.memoryMeta ?? memoryContext?.meta }
          : {}),
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      ...result,
      ...(process.env.NODE_ENV !== "production" || request.headers.get("x-debug-memory") === "1"
        ? { memoryMeta: result.memoryMeta ?? memoryContext?.meta }
        : {}),
    },
    { status: 200 }
  );
}
