import assert from "node:assert/strict";
import test from "node:test";

import type { ParentStoryBookScene } from "@/lib/ai/types";

import {
  buildCaptionTimeline,
  getCaptionIndexForCharIndex,
  getCaptionIndexForElapsedMs,
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
    imageUrl: "data:image/svg+xml;base64,PHN2Zy8+",
    assetRef: "data:image/svg+xml;base64,PHN2Zy8+",
    imageStatus: "fallback",
    imageSourceKind: "demo-art",
    audioUrl: null,
    audioRef: "scene-1-audio",
    audioScript: "第一页。小兔团团先停一停。它轻轻说出心里的感受。今晚先做一个小动作。",
    audioStatus: "fallback",
    voiceStyle: "warm-storytelling",
    highlightSource: "manualTheme",
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
