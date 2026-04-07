import { NextResponse } from "next/server";
import { buildParentStoryBookResponse } from "@/lib/agent/parent-storybook";
import type { ParentStoryBookRequest } from "@/lib/ai/types";
import {
  createBrainTransportHeaders,
  forwardBrainRequest,
  type BrainForwardResult,
} from "@/lib/server/brain-client";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isParentStoryBookRequest(payload: unknown): payload is ParentStoryBookRequest {
  if (!isRecord(payload)) return false;
  if (!isRecord(payload.snapshot)) return false;
  if (!isRecord(payload.snapshot.child)) return false;
  return Array.isArray(payload.highlightCandidates);
}

function buildLocalFallbackHeaders(brainForward: BrainForwardResult) {
  return createBrainTransportHeaders({
    transport: "next-json-fallback",
    targetPath: brainForward.targetPath,
    upstreamHost: brainForward.upstreamHost,
    fallbackReason: brainForward.fallbackReason ?? "brain-proxy-unavailable",
  });
}

export async function POST(request: Request) {
  const brainForward = await forwardBrainRequest(request, "/api/v1/agents/parent/storybook");
  if (brainForward.response) return brainForward.response;

  const localFallbackHeaders = buildLocalFallbackHeaders(brainForward);

  let payload: ParentStoryBookRequest;
  try {
    const parsed = (await request.json()) as unknown;
    if (!isParentStoryBookRequest(parsed)) {
      return NextResponse.json(
        { error: "Invalid parent storybook payload" },
        { status: 400, headers: localFallbackHeaders }
      );
    }
    payload = parsed;
  } catch (error) {
    console.error("[AI] Invalid parent storybook payload", error);
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: localFallbackHeaders }
    );
  }

  const response = buildParentStoryBookResponse(payload, {
    transport: "next-json-fallback",
    fallbackReason: brainForward.fallbackReason ?? "brain-proxy-unavailable",
    source: "fallback",
    fallback: true,
  });
  return NextResponse.json(response, { status: 200, headers: localFallbackHeaders });
}
