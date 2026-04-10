import assert from "node:assert/strict";
import test from "node:test";

import type { ParentStoryBookResponse, ParentStoryBookScene } from "@/lib/ai/types";

import {
  buildCaptionTimeline,
  getCaptionIndexForCharIndex,
  getCaptionIndexForElapsedMs,
  getRuntimeBannerItemsHotfix,
  resolveRuntimeSceneImageDeliveryHotfix,
  resolveRuntimeStoryModeHotfix,
  resolveSceneCaptionTiming,
} from "./StoryBookViewer.tsx";

function buildScene(
  overrides: Partial<ParentStoryBookScene> = {}
): ParentStoryBookScene {
  return {
    sceneIndex: 1,
    sceneTitle: "第一页",
    sceneText: "小兔团团先停一停。它轻轻说出心里的感受。今晚先做一个小动作。",
    imagePrompt: "image prompt",
    imageUrl: "https://cdn.example.com/scene-1.png",
    assetRef: "https://cdn.example.com/scene-1-fallback.svg",
    imageStatus: "ready",
    imageSourceKind: "real",
    audioUrl: null,
    audioRef: "scene-1-audio",
    audioScript: "第一页。小兔团团先停一停。它轻轻说出心里的感受。今晚先做一个小动作。",
    audioStatus: "fallback",
    voiceStyle: "warm-storytelling",
    highlightSource: "manualTheme",
    ...overrides,
  };
}

function buildStory(
  overrides: Partial<ParentStoryBookResponse> = {}
): ParentStoryBookResponse {
  const scenes = overrides.scenes ?? [buildScene()];
  return {
    storyId: "storybook-1",
    childId: "child-1",
    mode: "storybook",
    title: "晚安成长绘本",
    summary: "一部关于表达感受的绘本。",
    moral: "慢一点，也是在认真长大。",
    parentNote: "今晚先陪孩子把感受说出来。",
    source: "rule",
    fallback: true,
    fallbackReason: null,
    generatedAt: "2026-04-10T00:00:00.000Z",
    stylePreset: "sunrise-watercolor",
    providerMeta: {
      provider: "parent-storybook-rule",
      mode: "fallback",
      transport: "remote-brain-proxy",
      imageProvider: "vivo-story-image",
      audioProvider: "vivo-story-tts",
      imageDelivery: "real",
      audioDelivery: "real",
      diagnostics: {
        brain: {
          reachable: true,
          fallbackReason: null,
          upstreamHost: "brain.example.com",
          statusCode: null,
          retryStrategy: "none",
          elapsedMs: 820,
          timeoutMs: 45000,
        },
        image: {
          requestedProvider: "vivo",
          resolvedProvider: "vivo-story-image",
          liveEnabled: true,
          missingConfig: [],
          jobStatus: "ready",
          pendingSceneCount: 0,
          readySceneCount: scenes.length,
          errorSceneCount: 0,
          lastErrorStage: null,
          lastErrorReason: null,
          elapsedMs: 1200,
        },
        audio: {
          requestedProvider: "vivo",
          resolvedProvider: "vivo-story-tts",
          liveEnabled: true,
          missingConfig: [],
          jobStatus: "ready",
          pendingSceneCount: 0,
          readySceneCount: scenes.length,
          errorSceneCount: 0,
          lastErrorStage: null,
          lastErrorReason: null,
          elapsedMs: 900,
        },
      },
      realProvider: true,
      highlightCount: 1,
      sceneCount: scenes.length,
      cacheHitCount: 0,
      cacheWindowSeconds: 900,
    },
    scenes,
    ...overrides,
  };
}

test("resolveSceneCaptionTiming prefers scene captionTiming and preserves per-segment durations", () => {
  const scene = buildScene({
    captionTiming: {
      mode: "duration-derived",
      segmentTexts: ["第一页。", "小兔团团先停一停。", "它轻轻说出心里的感受。"],
      segmentDurationsMs: [2500, 3200, 4100],
    },
  });

  const timing = resolveSceneCaptionTiming(scene);

  assert.equal(timing.mode, "duration-derived");
  assert.deepEqual(timing.segmentTexts, [
    "第一页。",
    "小兔团团先停一停。",
    "它轻轻说出心里的感受。",
  ]);
  assert.deepEqual(timing.segmentDurationsMs, [2500, 3200, 4100]);
});

test("buildCaptionTimeline falls back to sentence segments with minimum readable dwell time", () => {
  const scene = buildScene({
    captionTiming: undefined,
    audioScript: "第一页。小兔团团先停一停。它轻轻说出心里的感受。",
  });

  const timeline = buildCaptionTimeline(scene);

  assert.deepEqual(timeline.segments, [
    "第一页。",
    "小兔团团先停一停。",
    "它轻轻说出心里的感受。",
  ]);
  assert.ok(timeline.durationsMs.every((duration) => duration >= 2400));
  assert.equal(timeline.startsMs.length, timeline.segments.length);
  assert.ok(timeline.totalDurationMs >= 7200);
});

test("caption helpers map elapsed time and speech boundaries onto the correct segment", () => {
  const scene = buildScene({
    audioScript: "第一页。小兔团团先停一停。它轻轻说出心里的感受。",
    captionTiming: {
      mode: "speech-boundary",
      segmentTexts: ["第一页。", "小兔团团先停一停。", "它轻轻说出心里的感受。"],
      segmentDurationsMs: [2600, 2800, 3400],
    },
  });

  const timeline = buildCaptionTimeline(scene);
  const boundaryIndex = scene.audioScript.indexOf("它轻轻");

  assert.equal(getCaptionIndexForElapsedMs(timeline, 1200), 0);
  assert.equal(getCaptionIndexForElapsedMs(timeline, 3200), 1);
  assert.equal(getCaptionIndexForElapsedMs(timeline, 6800), 2);
  assert.equal(getCaptionIndexForCharIndex(timeline, boundaryIndex), 2);
});

test("runtime story mode hotfix reports mixed when browser fell back to local speech", () => {
  const story = buildStory();

  assert.equal(resolveRuntimeStoryModeHotfix(story), "live");
  assert.equal(
    resolveRuntimeStoryModeHotfix(story, {
      canUseLocalSpeech: true,
      playbackSource: "local",
    }),
    "mixed"
  );
});

test("runtime scene image delivery hotfix degrades to fallback when browser swaps to assetRef", () => {
  const scene = buildScene({
    imageSourceKind: "real",
    imageUrl: "https://cdn.example.com/live.png",
    assetRef: "/api/ai/parent-storybook/media/fallback-scene-1",
  });

  assert.equal(resolveRuntimeSceneImageDeliveryHotfix(scene), "real");
  assert.equal(
    resolveRuntimeSceneImageDeliveryHotfix(scene, { useAssetFallback: true }),
    "dynamic-fallback"
  );
});

test("runtime banners hotfix maps brain 504 and local speech honestly", () => {
  const story = buildStory({
    providerMeta: {
      ...buildStory().providerMeta,
      transport: "next-json-fallback",
      imageDelivery: "dynamic-fallback",
      audioDelivery: "preview-only",
      diagnostics: {
        ...buildStory().providerMeta.diagnostics,
        brain: {
          ...buildStory().providerMeta.diagnostics!.brain,
          reachable: false,
          fallbackReason: "brain-status-504",
        },
        image: {
          ...buildStory().providerMeta.diagnostics!.image,
          jobStatus: "warming",
          readySceneCount: 1,
          pendingSceneCount: 2,
        },
        audio: {
          ...buildStory().providerMeta.diagnostics!.audio,
          jobStatus: "warming",
          readySceneCount: 0,
          pendingSceneCount: 3,
        },
      },
    },
  });

  const items = getRuntimeBannerItemsHotfix(story, true, {
    playbackSource: "local",
  });

  assert.ok(items.some((item) => item.label === "未接通 FastAPI brain，当前为本地回退链路"));
  assert.ok(items.some((item) => item.detail.includes("504")));
  assert.ok(items.some((item) => item.label === "真实图片补齐中"));
  assert.ok(items.some((item) => item.label === "当前音频为 local speech"));
  assert.ok(items.every((item) => item.label !== "真实朗读已就绪"));
});
