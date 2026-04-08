import assert from "node:assert/strict";
import test from "node:test";

import type { ParentStoryBookPageCount, ParentStoryBookRequest } from "@/lib/ai/types";
import { buildParentStoryBookCacheKey } from "../parent/storybook-cache.ts";

import {
  buildParentStoryBookRequestFromFeed,
  buildParentStoryBookResponse,
} from "./parent-storybook.ts";

function buildRequest(
  overrides: Partial<ParentStoryBookRequest> = {}
): ParentStoryBookRequest {
  return {
    childId: "child-1",
    storyMode: "storybook",
    generationMode: "child-personalized",
    requestSource: "storybook-test",
    stylePreset: "sunrise-watercolor",
    stylePrompt: "默认晨光水彩风格",
    pageCount: 6,
    goalKeywords: [],
    snapshot:
      overrides.snapshot ?? {
        child: {
          id: "child-1",
          name: "安安",
          className: "小一班",
          specialNotes: "喜欢先观察，再慢慢加入。",
        },
        summary: {
          health: {
            abnormalCount: 0,
            handMouthEyeAbnormalCount: 0,
          },
          meals: {
            recordCount: 2,
            hydrationAvg: 420,
            balancedRate: 84,
            monotonyDays: 0,
            allergyRiskCount: 0,
          },
          growth: {
            recordCount: 2,
            attentionCount: 0,
            pendingReviewCount: 0,
            topCategories: [{ category: "情绪表达", count: 2 }],
          },
          feedback: {
            count: 1,
            statusCounts: { "在家已配合": 1 },
            keywords: ["睡前安抚"],
          },
        },
        ruleFallback: [],
      },
    highlightCandidates:
      overrides.highlightCandidates ?? [
        {
          kind: "todayGrowth",
          title: "今天的小亮点",
          detail: "今天愿意主动说早安，也愿意轻轻挥手。",
          priority: 1,
          source: "todayGrowth",
        },
        {
          kind: "consultationAction",
          title: "今晚可以做的小事",
          detail: "睡前一起回顾今天最安心的一个瞬间。",
          priority: 2,
          source: "interventionCard",
        },
        {
          kind: "weeklyTrend",
          title: "一周趋势",
          detail: "最近一周的节奏都在慢慢稳定下来。",
          priority: 3,
          source: "weeklyTrend",
        },
      ],
    latestInterventionCard: overrides.latestInterventionCard ?? null,
    latestConsultation: overrides.latestConsultation ?? null,
    ...overrides,
  };
}

test("buildParentStoryBookRequestFromFeed supports manual-theme without child data", () => {
  const request = buildParentStoryBookRequestFromFeed({
    feed: null,
    healthCheckRecords: [],
    mealRecords: [],
    growthRecords: [],
    guardianFeedbacks: [],
    taskCheckInRecords: [],
    requestSource: "storybook-test",
    generationMode: "manual-theme",
    manualTheme: "独立入睡",
    manualPrompt: "把睡前分离讲成轻柔的晚安绘本。",
    pageCount: 6,
    goalKeywords: ["独立入睡", "睡前安抚"],
    stylePreset: "moonlit-cutout",
  });

  const response = buildParentStoryBookResponse(request);

  assert.equal(request.generationMode, "manual-theme");
  assert.equal(request.childId, undefined);
  assert.equal(request.pageCount, 6);
  assert.equal(request.snapshot.child.id, "storybook-guest");
  assert.equal(request.highlightCandidates[0]?.kind, "manualTheme");
  assert.equal(response.mode, "storybook");
  assert.equal(response.scenes.length, 6);
  assert.equal(response.providerMeta.sceneCount, 6);
  assert.ok(response.scenes.every((scene) => scene.audioScript.length > 0));
  assert.match(response.scenes.at(-1)?.sceneText ?? "", /今晚|明天/);
});

test("buildParentStoryBookResponse honors page count variants", () => {
  const pageCounts: ParentStoryBookPageCount[] = [4, 6, 8];
  for (const pageCount of pageCounts) {
    const response = buildParentStoryBookResponse(
      buildRequest({ pageCount, requestSource: `storybook-${pageCount}` })
    );

    assert.equal(response.mode, "storybook");
    assert.equal(response.scenes.length, pageCount);
    assert.equal(response.providerMeta.sceneCount, pageCount);
  }
});

test("hybrid storybook threads theme and child context into scene text prompt and audio", () => {
  const childContextDetail = "它先停一停，再轻轻说出“我有点难过”。";
  const response = buildParentStoryBookResponse(
    buildRequest({
      generationMode: "hybrid",
      manualTheme: "表达情绪",
      manualPrompt: "让孩子知道情绪可以被轻轻说出来。",
      pageCount: 4,
      goalKeywords: ["表达情绪"],
      highlightCandidates: [
        {
          kind: "manualTheme",
          title: "主题：表达情绪",
          detail: "把“表达情绪”讲成孩子能听懂的小故事。",
          priority: 1,
          source: "manualTheme",
        },
        {
          kind: "warningSuggestion",
          title: "先停一停",
          detail: childContextDetail,
          priority: 2,
          source: "suggestions",
        },
        {
          kind: "consultationAction",
          title: "今晚可以做的小事",
          detail: "睡前一起练习一句“我现在有点难过”。",
          priority: 3,
          source: "interventionCard",
        },
        {
          kind: "todayGrowth",
          title: "今天的小亮点",
          detail: "今天已经愿意先抱一抱，再慢慢说出自己的需要。",
          priority: 4,
          source: "todayGrowth",
        },
      ],
    })
  );

  assert.equal(response.scenes.length, 4);
  assert.ok(response.scenes.some((scene) => scene.sceneText.includes("表达情绪")));
  assert.ok(response.scenes.some((scene) => scene.sceneText.includes("先停一停")));
  assert.ok(response.scenes.some((scene) => scene.imagePrompt.includes("表达情绪")));
  assert.ok(response.scenes.some((scene) => scene.imagePrompt.includes("先停一停")));
  assert.ok(response.scenes.some((scene) => scene.audioScript.includes("表达情绪")));
  assert.ok(response.scenes.some((scene) => scene.audioScript.includes("先停一停")));
});

test("storybook cache key changes when mode theme and page count change", () => {
  const baseRequest = buildRequest();
  const baseKey = buildParentStoryBookCacheKey(baseRequest, "sunrise-watercolor");
  const themeKey = buildParentStoryBookCacheKey(
    buildRequest({
      generationMode: "manual-theme",
      manualTheme: "勇气",
      pageCount: 6,
    }),
    "sunrise-watercolor"
  );
  const pageKey = buildParentStoryBookCacheKey(
    buildRequest({ pageCount: 8 }),
    "sunrise-watercolor"
  );
  const modeKey = buildParentStoryBookCacheKey(
    buildRequest({
      generationMode: "hybrid",
      manualTheme: "分享",
      goalKeywords: ["分享"],
    }),
    "sunrise-watercolor"
  );

  assert.notEqual(baseKey, themeKey);
  assert.notEqual(baseKey, pageKey);
  assert.notEqual(baseKey, modeKey);
  assert.equal(new Set([baseKey, themeKey, pageKey, modeKey]).size, 4);
});
