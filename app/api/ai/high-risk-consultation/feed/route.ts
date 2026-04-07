import { NextResponse } from "next/server";
import { createBrainTransportHeaders, forwardBrainRequest } from "@/lib/server/brain-client";

function buildLocalFallbackHeaders(targetPath: string, fallbackReason: string | null, upstreamHost: string | null) {
  return createBrainTransportHeaders({
    transport: "next-json-fallback",
    targetPath,
    upstreamHost,
    fallbackReason: fallbackReason ?? "brain-proxy-unavailable",
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const targetPath = `/api/v1/agents/consultations/high-risk/feed${url.search}`;
  const brainForward = await forwardBrainRequest(request, targetPath);
  if (brainForward.response) return brainForward.response;

  return NextResponse.json(
    {
      items: [],
      count: 0,
      fallback: true,
      error: "high-risk consultation feed is unavailable",
    },
    {
      status: 503,
      headers: buildLocalFallbackHeaders(
        targetPath,
        brainForward.fallbackReason,
        brainForward.upstreamHost
      ),
    }
  );
}
