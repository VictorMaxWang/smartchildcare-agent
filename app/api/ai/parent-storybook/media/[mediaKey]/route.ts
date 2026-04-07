import { readCachedParentStoryBookAudio } from "@/lib/server/parent-storybook-cache";
import {
  createBrainTransportHeaders,
  forwardBrainRequest,
} from "@/lib/server/brain-client";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ mediaKey: string }> }
) {
  const { mediaKey } = await context.params;
  const cachedAudio = readCachedParentStoryBookAudio(mediaKey);

  if (cachedAudio) {
    const body = new Uint8Array(cachedAudio.bytes);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": cachedAudio.contentType,
        "cache-control": "private, max-age=900, immutable",
        "accept-ranges": "bytes",
      },
    });
  }

  const targetPath = `/api/v1/agents/parent/storybook/media/${encodeURIComponent(mediaKey)}`;
  const brainForward = await forwardBrainRequest(request, targetPath);
  if (brainForward.response) return brainForward.response;

  return new Response("storybook media unavailable", {
    status: 404,
    headers: createBrainTransportHeaders({
      transport: "next-json-fallback",
      targetPath,
      upstreamHost: brainForward.upstreamHost,
      fallbackReason: brainForward.fallbackReason ?? "brain-proxy-unavailable",
    }),
  });
}
