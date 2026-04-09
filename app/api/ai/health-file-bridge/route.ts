import { NextResponse } from "next/server";
import {
  buildHealthFileBridgeResponse,
  isValidHealthFileBridgeRequest,
} from "@/lib/agent/health-file-bridge";
import {
  createBrainTransportHeaders,
  forwardBrainRequest,
  type BrainForwardResult,
} from "@/lib/server/brain-client";
import type { HealthFileBridgeRequest } from "@/lib/ai/types";

function buildLocalFallbackHeaders(brainForward: BrainForwardResult) {
  return createBrainTransportHeaders({
    transport: "next-json-fallback",
    targetPath: brainForward.targetPath,
    upstreamHost: brainForward.upstreamHost,
    fallbackReason: brainForward.fallbackReason ?? "brain-proxy-unavailable",
  });
}

export async function POST(request: Request) {
  const brainForward = await forwardBrainRequest(request, "/api/v1/agents/health-file-bridge");
  if (brainForward.response) return brainForward.response;

  const headers = buildLocalFallbackHeaders(brainForward);

  let payload: HealthFileBridgeRequest | null = null;
  try {
    payload = (await request.json()) as HealthFileBridgeRequest;
  } catch (error) {
    console.error("[AI] Invalid health-file-bridge payload", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers });
  }

  if (!isValidHealthFileBridgeRequest(payload)) {
    return NextResponse.json(
      { error: "Invalid health-file-bridge payload" },
      { status: 400, headers }
    );
  }

  return NextResponse.json(
    buildHealthFileBridgeResponse(payload, {
      source: "next-local-rule",
      fallback: true,
      mock: true,
      liveReadyButNotVerified: true,
    }),
    { status: 200, headers }
  );
}
