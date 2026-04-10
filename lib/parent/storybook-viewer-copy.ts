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
    description: "暖色水彩和柔和高光，适合强调治愈感和成长瞬间。",
  },
  "moonlit-cutout": {
    label: "月夜剪纸",
    shortLabel: "月夜",
    description: "蓝紫夜色和纸艺层次，适合晚安故事与安静情绪。",
  },
  "forest-crayon": {
    label: "森林蜡笔",
    shortLabel: "森林",
    description: "浅绿和木色搭配蜡笔肌理，适合更活泼的绘本演示。",
  },
};

function mapProviderName(kind: "image" | "audio", providerName: string) {
  const normalized = providerName.trim();
  if (!normalized) {
    return kind === "image" ? "未知插画来源" : "未知音频来源";
  }

  if (normalized === "storybook-dynamic-fallback") {
    return "动态剧情插画";
  }
  if (normalized === "storybook-local-dynamic-fallback") {
    return "本地动态剧情插画";
  }
  if (normalized === "storybook-demo-art") {
    return "示例插画兜底";
  }
  if (normalized === "storybook-svg-fallback") {
    return "SVG 兜底插画";
  }
  if (normalized === "storybook-asset") {
    return "预置绘本资产";
  }
  if (normalized === "storybook-mock-preview") {
    return "字幕预演";
  }
  if (normalized === "vivo-story-image") {
    return "vivo 真实图片";
  }
  if (normalized === "vivo-story-tts") {
    return "vivo 真实朗读";
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
      label: "真实媒体",
      summary: "当前图片和音频都命中真实链路，页面展示的是完整实时结果。",
      badgeVariant: "success" as const,
    };
  }

  if (mode === "mixed") {
    return {
      label: "混合交付",
      summary: "当前只有部分页面命中真实媒体，其余页面仍使用真实补齐中的回退结果。",
      badgeVariant: "warning" as const,
    };
  }

  return {
    label: "回退交付",
    summary: "当前主要展示回退插画和本地补读或字幕预演，不宣称真实媒体已完全恢复。",
    badgeVariant: "secondary" as const,
  };
}

export function formatStoryBookSceneStatus(
  kind: "image" | "audio",
  status: ParentStoryBookMediaStatus
) {
  if (kind === "image") {
    if (status === "ready") return "已生成插画";
    if (status === "fallback") return "回退插画";
    if (status === "mock") return "示例插画";
    return "待补插画";
  }

  if (status === "ready") return "已生成音频";
  if (status === "fallback") return "字幕预演";
  if (status === "mock") return "示例音轨";
  return "待补音频";
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
  value?: StoryBookRuntimeImageDelivery | ParentStoryBookMediaStatus | "mixed"
) {
  if (value === "real" || value === "ready") return "真实图片";
  if (value === "mixed") return "混合图片";
  if (value === "dynamic-fallback" || value === "fallback") return "动态剧情插画";
  if (value === "demo-art" || value === "mock") return "示例插画兜底";
  return "SVG 兜底插画";
}

export function formatStoryBookTransport(value?: StoryBookRuntimeTransport | string | null) {
  if (value === "remote-brain-proxy") return "FastAPI 实时链路";
  if (value === "next-json-fallback") return "Next 本地 JSON 回退";
  if (value === "next-stream-fallback") return "Next 本地流式回退";
  return value ?? "未知链路";
}

export function formatStoryBookFallbackReason(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) return "未知回退原因";

  if (normalized === "brain-status-504") {
    return "上游 brain 返回 504";
  }
  if (normalized === "brain-proxy-timeout") {
    return "Next 代理等待 brain 超时";
  }
  if (normalized === "brain-base-url-missing") {
    return "未配置 BRAIN_API_BASE_URL";
  }
  if (normalized === "partial-media-fallback") {
    return "媒体仍在补齐，当前为混合结果";
  }
  if (normalized === "mock-storybook-pipeline") {
    return "当前命中本地回退绘本链路";
  }
  if (normalized === "sparse-parent-context") {
    return "上下文不足，降级为轻量卡片";
  }
  if (normalized.startsWith("brain-status-")) {
    return `上游 brain 返回 ${normalized.slice("brain-status-".length)}`;
  }
  if (normalized.startsWith("brain-fetch-")) {
    return `brain 请求失败：${normalized.slice("brain-fetch-".length)}`;
  }

  return normalized;
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
  const prefix = kind === "image" ? "插画" : "音频";
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
  value?: "stream-url" | "inline-data-url" | "preview-only" | "real" | "mixed" | "local-speech"
) {
  if (value === "real") return "真实逐页朗读";
  if (value === "mixed") return "混合音频";
  if (value === "local-speech") return "本地补读";
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
