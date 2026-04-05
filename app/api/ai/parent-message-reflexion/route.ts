import { NextResponse } from "next/server";
import { forwardBrainRequest } from "@/lib/server/brain-client";

export async function POST(request: Request) {
  const brainForward = await forwardBrainRequest(
    request,
    "/api/v1/agents/parent/message-reflexion"
  );
  if (brainForward.response) return brainForward.response;

  return NextResponse.json(
    {
      error: "Parent message reflexion requires the FastAPI brain.",
    },
    { status: 503 }
  );
}
