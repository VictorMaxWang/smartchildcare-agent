import { NextResponse } from "next/server";
import { forwardBrainRequest } from "@/lib/server/brain-client";

export async function POST(request: Request) {
  const brainForward = await forwardBrainRequest(request, "/api/v1/agents/parent/trend-query");
  if (brainForward.response) return brainForward.response;

  return NextResponse.json(
    {
      error: "Parent trend query requires the FastAPI brain. Local trend fallback is intentionally disabled for T11.",
    },
    { status: 503 }
  );
}
