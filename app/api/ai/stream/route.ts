import { createMockBrainStreamResponse, forwardBrainRequest } from "@/lib/server/brain-client";

export async function POST(request: Request) {
  const proxied = await forwardBrainRequest(request, "/api/v1/stream/agent");
  if (proxied) return proxied;
  return createMockBrainStreamResponse();
}
