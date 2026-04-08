import { NextResponse } from "next/server";
import { buildParentStoryBookResponse } from "@/lib/agent/parent-storybook";
import type { ParentStoryBookRequest, ParentStoryBookResponse } from "@/lib/ai/types";
import {
  buildParentStoryBookRequestCacheKey,
  getCachedParentStoryBookResponse,
  prepareParentStoryBookResponseForDelivery,
  setCachedParentStoryBookResponse,
  shouldCacheParentStoryBookResponse,
} from "@/lib/server/parent-storybook-cache";
import {
  createBrainTransportHeaders,
  forwardBrainRequest,
  type BrainForwardResult,
} from "@/lib/server/brain-client";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isParentStoryBookRequest(payload: unknown): payload is ParentStoryBookRequest {
  if (!isRecord(payload)) return false;
  if (!isRecord(payload.snapshot)) return false;
  if (!isRecord(payload.snapshot.child)) return false;
  if (
    "pageCount" in payload &&
    payload.pageCount !== undefined &&
    payload.pageCount !== 4 &&
    payload.pageCount !== 6 &&
    payload.pageCount !== 8
  ) {
    return false;
  }
  if (
    "styleMode" in payload &&
    payload.styleMode !== undefined &&
    payload.styleMode !== "preset" &&
    payload.styleMode !== "custom"
  ) {
    return false;
  }
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

function buildCacheHeaders(value: "hit" | "miss" | "bypass") {
  const headers = new Headers();
  headers.set("x-smartchildcare-storybook-cache", value);
  return headers;
}

function mergeHeaders(...groups: Array<HeadersInit | undefined>) {
  const headers = new Headers();

  for (const group of groups) {
    if (!group) continue;
    new Headers(group).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  headers.set("cache-control", "no-store");
  return headers;
}

async function parseRemoteStoryResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;

  try {
    return (await response.json()) as ParentStoryBookResponse;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let payload: ParentStoryBookRequest;

  try {
    const parsed = (await request.clone().json()) as unknown;
    if (!isParentStoryBookRequest(parsed)) {
      return NextResponse.json(
        { error: "Invalid parent storybook payload" },
        { status: 400, headers: buildCacheHeaders("bypass") }
      );
    }
    payload = parsed;
  } catch (error) {
    console.error("[AI] Invalid parent storybook payload", error);
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: buildCacheHeaders("bypass") }
    );
  }

  const cacheKey = buildParentStoryBookRequestCacheKey(payload);
  const cachedResponse = getCachedParentStoryBookResponse(cacheKey);

  if (cachedResponse) {
    const cachedStory = prepareParentStoryBookResponseForDelivery(cachedResponse.story, {
      cacheState: "hit",
      ttlSeconds: cachedResponse.story.cacheMeta?.ttlSeconds,
    });

    return NextResponse.json(cachedStory, {
      status: 200,
      headers: mergeHeaders(
        createBrainTransportHeaders({
          transport: cachedResponse.transport,
          targetPath: cachedResponse.targetPath,
          upstreamHost: cachedResponse.upstreamHost,
          fallbackReason: cachedResponse.fallbackReason,
        }),
        buildCacheHeaders("hit")
      ),
    });
  }

  const brainForward = await forwardBrainRequest(request, "/api/v1/agents/parent/storybook");

  if (brainForward.response) {
    const remoteStory = await parseRemoteStoryResponse(brainForward.response.clone());
    if (!remoteStory) {
      return brainForward.response;
    }

    const preparedStory = prepareParentStoryBookResponseForDelivery(remoteStory, {
      cacheState: shouldCacheParentStoryBookResponse(remoteStory) ? "miss" : "bypass",
    });

    if (shouldCacheParentStoryBookResponse(preparedStory)) {
      setCachedParentStoryBookResponse(cacheKey, {
        story: preparedStory,
        transport: "remote-brain-proxy",
        targetPath: brainForward.targetPath,
        upstreamHost: brainForward.upstreamHost,
        fallbackReason: null,
      });
    }

    return NextResponse.json(preparedStory, {
      status: brainForward.response.status,
      headers: mergeHeaders(
        brainForward.response.headers,
        buildCacheHeaders(preparedStory.cacheMeta?.storyResponse ?? "bypass")
      ),
    });
  }

  const localFallbackHeaders = buildLocalFallbackHeaders(brainForward);
  const localStory = buildParentStoryBookResponse(payload, {
    transport: "next-json-fallback",
    fallbackReason: brainForward.fallbackReason ?? "brain-proxy-unavailable",
    source: "fallback",
    fallback: true,
  });
  const preparedLocalStory = prepareParentStoryBookResponseForDelivery(localStory, {
    cacheState: "bypass",
  });

  return NextResponse.json(preparedLocalStory, {
    status: 200,
    headers: mergeHeaders(localFallbackHeaders, buildCacheHeaders("bypass")),
  });
}
