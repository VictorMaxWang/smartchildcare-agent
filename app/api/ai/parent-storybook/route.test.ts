import assert from "node:assert/strict";
import test from "node:test";

import type { ParentStoryBookRequest, ParentStoryBookResponse } from "@/lib/ai/types";
import { parentStoryBookCacheInternals } from "@/lib/server/parent-storybook-cache";
import { POST } from "./route.ts";

function withEnv(
  overrides: Partial<Record<"BRAIN_API_BASE_URL" | "NEXT_PUBLIC_BACKEND_BASE_URL", string | undefined>>,
  fn: () => void | Promise<void>
) {
  const previous = {
    BRAIN_API_BASE_URL: process.env.BRAIN_API_BASE_URL,
    NEXT_PUBLIC_BACKEND_BASE_URL: process.env.NEXT_PUBLIC_BACKEND_BASE_URL,
  };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return Promise.resolve(fn()).finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

function buildPayload(): ParentStoryBookRequest {
  return {
    childId: "child-1",
    requestSource: "route-test",
    stylePreset: "sunrise-watercolor",
    styleMode: "preset",
    pageCount: 6,
    snapshot: {
      child: {
        id: "child-1",
        name: "安安",
        className: "小一班",
      },
      summary: {
        health: {
          abnormalCount: 0,
          handMouthEyeAbnormalCount: 0,
        },
        meals: {
          recordCount: 1,
          hydrationAvg: 420,
          balancedRate: 85,
          monotonyDays: 0,
          allergyRiskCount: 0,
        },
        growth: {
          recordCount: 1,
          attentionCount: 0,
          pendingReviewCount: 0,
          topCategories: [],
        },
        feedback: {
          count: 1,
          statusCounts: {},
          keywords: [],
        },
      },
      ruleFallback: [],
    },
    highlightCandidates: [
      {
        kind: "todayGrowth",
        title: "今天的亮点",
        detail: "今天愿意主动打招呼。",
        priority: 1,
        source: "todayGrowth",
      },
    ],
  };
}

function buildRemoteStory(): ParentStoryBookResponse {
  return {
    storyId: "storybook-remote-1",
    childId: "child-1",
    mode: "storybook",
    title: "成长绘本",
    summary: "远端 story 结构已返回。",
    moral: "一点点成长也值得被看见。",
    parentNote: "今晚继续温柔陪伴。",
    source: "vivo",
    fallback: false,
    fallbackReason: null,
    generatedAt: "2026-04-10T00:00:00.000Z",
    stylePreset: "sunrise-watercolor",
    providerMeta: {
      provider: "parent-storybook-rule",
      mode: "live",
      imageProvider: "vivo-story-image",
      audioProvider: "vivo-story-tts",
      imageDelivery: "real",
      audioDelivery: "real",
      realProvider: true,
      highlightCount: 1,
      sceneCount: 1,
      cacheHitCount: 0,
      cacheWindowSeconds: 900,
      diagnostics: {
        brain: {
          reachable: true,
          fallbackReason: null,
          upstreamHost: "brain.example.com",
          statusCode: null,
          retryStrategy: "none",
          elapsedMs: 120,
          timeoutMs: null,
        },
        image: {
          requestedProvider: "vivo",
          resolvedProvider: "vivo-story-image",
          liveEnabled: true,
          missingConfig: [],
          jobStatus: "ready",
          pendingSceneCount: 0,
          readySceneCount: 1,
          errorSceneCount: 0,
          lastErrorStage: null,
          lastErrorReason: null,
          elapsedMs: 120,
        },
        audio: {
          requestedProvider: "vivo",
          resolvedProvider: "vivo-story-tts",
          liveEnabled: true,
          missingConfig: [],
          jobStatus: "ready",
          pendingSceneCount: 0,
          readySceneCount: 1,
          errorSceneCount: 0,
          lastErrorStage: null,
          lastErrorReason: null,
          elapsedMs: 120,
        },
      },
    },
    scenes: [
      {
        sceneIndex: 1,
        sceneTitle: "第一页",
        sceneText: "远端媒体已命中。",
        imagePrompt: "image prompt",
        imageUrl: "https://cdn.example.com/story-1.png",
        assetRef: "https://cdn.example.com/story-1.png",
        imageStatus: "ready",
        imageSourceKind: "real",
        audioUrl: "data:audio/wav;base64,UklGRg==",
        audioRef: "audio-1",
        audioScript: "远端音频。",
        audioStatus: "ready",
        captionTiming: {
          mode: "duration-derived",
          segmentTexts: ["远端音频。"],
          segmentDurationsMs: [2600],
        },
        voiceStyle: "warm-storytelling",
        highlightSource: "todayGrowth",
        imageCacheHit: false,
        audioCacheHit: false,
      },
    ],
  };
}

test("parent storybook route keeps remote brain diagnostics on successful proxy", async () => {
  const originalFetch = globalThis.fetch;
  parentStoryBookCacheInternals.storyResponseCache.clear();
  parentStoryBookCacheInternals.mediaAssetCache.clear();

  globalThis.fetch = (async () =>
    new Response(JSON.stringify(buildRemoteStory()), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;

  try {
    await withEnv(
      {
        BRAIN_API_BASE_URL: "http://brain.example.com",
        NEXT_PUBLIC_BACKEND_BASE_URL: undefined,
      },
      async () => {
        const response = await POST(
          new Request("http://localhost:3000/api/ai/parent-storybook", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(buildPayload()),
          })
        );
        const body = (await response.json()) as ParentStoryBookResponse;

        assert.equal(response.status, 200);
        assert.equal(body.providerMeta.transport, "remote-brain-proxy");
        assert.equal(body.providerMeta.diagnostics?.brain.reachable, true);
        assert.equal(body.providerMeta.diagnostics?.brain.fallbackReason, null);
        assert.equal(body.providerMeta.diagnostics?.brain.timeoutMs, 35000);
        assert.equal(typeof body.providerMeta.diagnostics?.brain.elapsedMs, "number");
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
    parentStoryBookCacheInternals.storyResponseCache.clear();
    parentStoryBookCacheInternals.mediaAssetCache.clear();
  }
});

test("parent storybook route reports brain proxy timeout and falls back honestly", async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  parentStoryBookCacheInternals.storyResponseCache.clear();
  parentStoryBookCacheInternals.mediaAssetCache.clear();

  globalThis.setTimeout = (((callback: TimerHandler) =>
    originalSetTimeout(callback, 0)) as unknown) as typeof globalThis.setTimeout;
  globalThis.fetch = (((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) {
        reject(new Error("missing abort signal"));
        return;
      }
      signal.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    })) as unknown) as typeof fetch;

  try {
    await withEnv(
      {
        BRAIN_API_BASE_URL: "http://brain.example.com",
        NEXT_PUBLIC_BACKEND_BASE_URL: undefined,
      },
      async () => {
        const response = await POST(
          new Request("http://localhost:3000/api/ai/parent-storybook", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(buildPayload()),
          })
        );
        const body = (await response.json()) as ParentStoryBookResponse;

        assert.equal(response.status, 200);
        assert.equal(body.providerMeta.transport, "next-json-fallback");
        assert.equal(body.providerMeta.diagnostics?.brain.reachable, false);
        assert.equal(body.providerMeta.diagnostics?.brain.fallbackReason, "brain-proxy-timeout");
        assert.equal(body.providerMeta.diagnostics?.brain.timeoutMs, 35000);
        assert.equal(typeof body.providerMeta.diagnostics?.brain.elapsedMs, "number");
        assert.equal(body.providerMeta.imageDelivery, "dynamic-fallback");
        assert.equal(body.providerMeta.audioDelivery, "preview-only");
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    parentStoryBookCacheInternals.storyResponseCache.clear();
    parentStoryBookCacheInternals.mediaAssetCache.clear();
  }
});
