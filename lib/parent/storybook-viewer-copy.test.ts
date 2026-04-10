import assert from "node:assert/strict";
import test from "node:test";

import {
  describeStoryBookMode,
  formatStoryBookAudioDelivery,
  formatStoryBookHighlightSource,
  formatStoryBookProviderLabel,
  formatStoryBookResponseCache,
  formatStoryBookSceneImageDelivery,
  formatStoryBookSceneStatus,
  formatStoryBookTransport,
  formatStoryBookVoiceStyle,
  getStoryBookPresetCopy,
} from "./storybook-viewer-copy.ts";

test("describeStoryBookMode maps live mixed fallback to Chinese labels and summaries", () => {
  assert.deepEqual(describeStoryBookMode("live"), {
    label: "完整实时结果",
    summary: "当前已命中真实插画和真实逐页朗读，页面展示的是完整 live 结果。",
    badgeVariant: "success",
  });
  assert.deepEqual(describeStoryBookMode("mixed"), {
    label: "混合交付",
    summary: "当前只有部分页面命中真实媒体，其余页面仍由兜底图或本地补读/字幕预演补齐。",
    badgeVariant: "warning",
  });
  assert.deepEqual(describeStoryBookMode("fallback"), {
    label: "兜底交付",
    summary: "当前主要展示动态剧情插画与本地补读/字幕预演，还不是完整 live 媒体结果。",
    badgeVariant: "secondary",
  });
});

test("storybook viewer copy maps media status and playback labels to Chinese", () => {
  assert.equal(formatStoryBookSceneStatus("image", "ready"), "已生成插画");
  assert.equal(formatStoryBookSceneStatus("image", "fallback"), "兜底插画");
  assert.equal(formatStoryBookSceneStatus("audio", "ready"), "已生成配音");
  assert.equal(formatStoryBookSceneStatus("audio", "mock"), "演示音轨");
  assert.equal(formatStoryBookVoiceStyle("gentle-bedtime"), "晚安轻声");
  assert.equal(formatStoryBookVoiceStyle("warm-storytelling"), "温柔讲述");
});

test("storybook viewer copy maps provider, cache and source badges to Chinese", () => {
  assert.equal(
    formatStoryBookProviderLabel("image", "vivo-story-image+storybook-dynamic-fallback"),
    "插画：vivo 实时插画 + 动态剧情插画"
  );
  assert.equal(
    formatStoryBookProviderLabel("audio", "storybook-mock-preview"),
    "配音：字幕预演"
  );
  assert.equal(formatStoryBookResponseCache("hit"), "响应缓存命中");
  assert.equal(formatStoryBookAudioDelivery("preview-only"), "字幕预演");
  assert.equal(formatStoryBookSceneImageDelivery("dynamic-fallback"), "动态剧情插画");
  assert.equal(formatStoryBookSceneImageDelivery("demo-art"), "演示插画");
  assert.equal(formatStoryBookSceneImageDelivery("svg-fallback"), "兜底插画");
  assert.equal(formatStoryBookTransport("remote-brain-proxy"), "FastAPI 实时链路");
  assert.equal(formatStoryBookHighlightSource("interventionCard"), "今晚动作");
});

test("getStoryBookPresetCopy returns Chinese preset metadata", () => {
  const preset = getStoryBookPresetCopy("forest-crayon");

  assert.equal(preset.shortLabel, "森林");
  assert.match(preset.description, /演示画风|活泼/);
});
