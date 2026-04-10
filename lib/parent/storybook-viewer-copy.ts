import type {
  ParentStoryBookMediaStatus,
  ParentStoryBookStylePreset,
} from "@/lib/ai/types";

const PRESET_COPY: Record<
  ParentStoryBookStylePreset,
  { label: string; shortLabel: string; description: string }
> = {
  "sunrise-watercolor": {
    label: "晨光水彩",
    shortLabel: "晨光",
    description: "暖黄水彩与高光晕染，更适合比赛录屏里的治愈成长瞬间。",
  },
  "moonlit-cutout": {
    label: "月夜剪纸",
    shortLabel: "月夜",
    description: "靛蓝夜色与层叠纸艺质感，突出睡前故事和晚安情绪。",
  },
  "forest-crayon": {
    label: "森林蜡笔",
    shortLabel: "森林",
    description: "浅绿与木质色调配合蜡笔笔触，适合切出更活泼的一套演示画风。",
  },
};

function mapProviderName(kind: "image" | "audio", providerName: string) {
  const normalized = providerName.trim();
  if (!normalized) {
    return kind === "image" ? "未知插画来源" : "未知配音来源";
  }

  if (normalized === "storybook-dynamic-fallback") {
    return "动态剧情插画";
  }
  if (normalized === "storybook-local-dynamic-fallback") {
    return "本地动态剧情插画";
  }
  if (normalized === "storybook-demo-art") {
    return "演示插画";
  }
  if (normalized === "storybook-svg-fallback") {
    return "极端兜底插画";
  }
  if (normalized === "storybook-asset") {
    return "预置绘本资产";
  }
  if (normalized === "storybook-mock-preview") {
    return "字幕预演";
  }
  if (normalized === "vivo-story-image") {
    return "vivo 实时插画";
  }
  if (normalized === "vivo-story-tts") {
    return "vivo 实时配音";
  }
  if (normalized === "parent-storybook-rule") {
    return "规则故事引擎";
  }

  return normalized;
}

export function getStoryBookPresetCopy(preset: ParentStoryBookStylePreset) {
  return PRESET_COPY[preset];
}

export function describeStoryBookMode(mode: string) {
  if (mode === "live") {
    return {
      label: "完整实时结果",
      summary: "当前已命中真实插画和真实逐页朗读，页面展示的是完整 live 结果。",
      badgeVariant: "success" as const,
    };
  }

  if (mode === "mixed") {
    return {
      label: "混合交付",
      summary: "当前只有部分页面命中真实媒体，其余页面仍由兜底图或本地补读/字幕预演补齐。",
      badgeVariant: "warning" as const,
    };
  }

  return {
    label: "兜底交付",
    summary: "当前主要展示动态剧情插画与本地补读/字幕预演，还不是完整 live 媒体结果。",
    badgeVariant: "secondary" as const,
  };
}

export function formatStoryBookSceneStatus(
  kind: "image" | "audio",
  status: ParentStoryBookMediaStatus
) {
  if (kind === "image") {
    if (status === "ready") return "已生成插画";
    if (status === "fallback") return "兜底插画";
    if (status === "mock") return "预置画面";
    return "待补画面";
  }

  if (status === "ready") return "已生成配音";
  if (status === "fallback") return "字幕预演";
  if (status === "mock") return "演示音轨";
  return "待补配音";
}

export type StoryBookRuntimeTransport =
  | "remote-brain-proxy"
  | "next-json-fallback"
  | "next-stream-fallback";

export type StoryBookRuntimeImageDelivery =
  | "real"
  | "dynamic-fallback"
  | "demo-art"
  | "svg-fallback";

export function formatStoryBookSceneImageDelivery(
  value?: StoryBookRuntimeImageDelivery | ParentStoryBookMediaStatus
) {
  if (value === "real" || value === "ready") return "真实插画";
  if (value === "dynamic-fallback" || value === "fallback") return "动态剧情插画";
  if (value === "demo-art" || value === "mock") return "演示插画";
  return "兜底插画";
}

export function formatStoryBookTransport(value?: StoryBookRuntimeTransport | string | null) {
  if (value === "remote-brain-proxy") return "FastAPI 实时链路";
  if (value === "next-json-fallback") return "本地 JSON 回退";
  if (value === "next-stream-fallback") return "本地流式回退";
  return value ?? "未知链路";
}

export function formatStoryBookHighlightSource(source: string) {
  if (source === "todayGrowth") return "今日成长";
  if (source === "suggestions" || source === "warningSuggestion") return "今日提醒";
  if (source === "latestConsultation" || source === "consultationSummary") return "会诊结论";
  if (source === "interventionCard" || source === "consultationAction") return "今晚动作";
  if (source === "guardianFeedback") return "家长反馈";
  if (source === "weeklyTrend") return "7 天趋势";
  if (source === "manualTheme") return "主题主线";
  if (source === "goalKeyword") return "关键词";
  if (source === "childTrait") return "孩子线索";
  if (source === "rule" || source === "ruleFallback") return "规则兜底";
  return source;
}

export function formatStoryBookProviderLabel(
  kind: "image" | "audio",
  providerName: string
) {
  const prefix = kind === "image" ? "插画" : "配音";
  const label = providerName
    .split("+")
    .map((item) => mapProviderName(kind, item))
    .join(" + ");
  return `${prefix}：${label}`;
}

export function formatStoryBookResponseCache(value?: "hit" | "miss" | "bypass") {
  if (value === "hit") return "响应缓存命中";
  if (value === "miss") return "实时生成响应";
  return "跳过响应缓存";
}

export function formatStoryBookAudioDelivery(
  value?: "stream-url" | "inline-data-url" | "preview-only" | "real" | "mixed"
) {
  if (value === "real") return "真实逐页朗读";
  if (value === "mixed") return "部分真实朗读";
  if (value === "stream-url") return "短链音频";
  if (value === "inline-data-url") return "内联音频";
  return "字幕预演";
}

export function formatStoryBookClientCache(kind: "none" | "hit" | "saved") {
  if (kind === "hit") return "本地缓存命中";
  if (kind === "saved") return "已写入本地缓存";
  return "未使用本地缓存";
}

export function formatStoryBookVoiceStyle(value: string) {
  if (value === "gentle-bedtime") return "晚安轻声";
  if (value === "warm-storytelling") return "温柔讲述";
  if (value === "calm-encouraging") return "轻声鼓励";
  return value;
}
