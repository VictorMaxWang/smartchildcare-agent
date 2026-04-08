"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  AudioLines,
  LoaderCircle,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PARENT_STORYBOOK_PRESETS, splitStoryBookCaptionSegments } from "@/lib/agent/parent-storybook-presets";
import type {
  ParentStoryBookGenerationMode,
  ParentStoryBookPageCount,
  ParentStoryBookResponse,
  ParentStoryBookScene,
  ParentStoryBookStylePreset,
  ParentStoryBookStyleMode,
} from "@/lib/ai/types";
import {
  describeStoryBookMode,
  formatStoryBookAudioDelivery,
  formatStoryBookClientCache,
  formatStoryBookHighlightSource,
  formatStoryBookProviderLabel,
  formatStoryBookResponseCache,
  formatStoryBookSceneStatus,
  formatStoryBookVoiceStyle,
  getStoryBookPresetCopy,
} from "@/lib/parent/storybook-viewer-copy";
import { cn } from "@/lib/utils";

type StoryBookViewerStatus = "loading" | "storybook" | "card" | "empty" | "error";
type PlaybackState = "idle" | "loading" | "playing" | "paused" | "preview";
type StoryBookTheme = ReturnType<typeof getTheme>;

const PREVIEW_STEP_SECONDS = 1.6;

function getTheme(preset: ParentStoryBookStylePreset) {
  if (preset === "moonlit-cutout") {
    return {
      page: "bg-[radial-gradient(circle_at_top,_rgba(219,234,254,0.95),_rgba(191,219,254,0.82)_30%,_rgba(224,231,255,0.76)_62%,_rgba(248,250,252,1)_100%)]",
      panel: "bg-white/82 border-white/70",
      accent: "bg-sky-600 text-white hover:bg-sky-600/90",
      quiet: "border-sky-200/80 bg-white/80 text-sky-900 hover:bg-sky-50",
      dot: "bg-sky-600",
      dotIdle: "bg-sky-100",
      chip: "bg-sky-100 text-sky-700",
      progress: "bg-gradient-to-r from-sky-600 via-indigo-500 to-slate-500",
    };
  }
  if (preset === "forest-crayon") {
    return {
      page: "bg-[radial-gradient(circle_at_top_right,_rgba(220,252,231,0.92),_rgba(187,247,208,0.78)_30%,_rgba(254,249,195,0.66)_58%,_rgba(248,250,252,1)_100%)]",
      panel: "bg-white/82 border-white/70",
      accent: "bg-emerald-600 text-white hover:bg-emerald-600/90",
      quiet: "border-emerald-200/80 bg-white/80 text-emerald-900 hover:bg-emerald-50",
      dot: "bg-emerald-600",
      dotIdle: "bg-emerald-100",
      chip: "bg-emerald-100 text-emerald-700",
      progress: "bg-gradient-to-r from-emerald-600 via-lime-500 to-amber-400",
    };
  }
  return {
    page: "bg-[radial-gradient(circle_at_top_left,_rgba(255,245,220,0.95),_rgba(254,226,226,0.75)_32%,_rgba(224,242,254,0.9)_68%,_rgba(248,250,252,1)_100%)]",
    panel: "bg-white/82 border-white/70",
    accent: "bg-amber-500 text-white hover:bg-amber-500/90",
    quiet: "border-amber-200/80 bg-white/80 text-amber-900 hover:bg-amber-50",
    dot: "bg-amber-500",
    dotIdle: "bg-amber-100",
    chip: "bg-amber-100 text-amber-700",
    progress: "bg-gradient-to-r from-amber-500 via-orange-400 to-rose-400",
  };
}

function formatSeconds(value: number) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  const minutes = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getGenerationModeCopy(mode: ParentStoryBookGenerationMode) {
  switch (mode) {
    case "manual-theme":
      return {
        label: "主题生成",
        description: "只围绕手动输入的教育主题生成完整成长绘本，不读取孩子个体数据。",
      };
    case "hybrid":
      return {
        label: "混合生成",
        description: "把手动主题和当前孩子的成长线索一起编织成更贴身的绘本。",
      };
    default:
      return {
        label: "个性化生成",
        description: "基于当前孩子的成长信息、反馈与建议生成个性化成长绘本。",
      };
  }
}

function getPlaybackActionText(
  scene: ParentStoryBookScene,
  isPlaying: boolean,
  playbackState: PlaybackState
) {
  if (scene.audioStatus === "ready" && scene.audioUrl) {
    if (playbackState === "paused" && isPlaying) return "继续朗读";
    if (isPlaying) return "暂停朗读";
    return "播放朗读";
  }
  return isPlaying ? "停止预演" : "字幕预演";
}

function getCaptionStatusText(
  scene: ParentStoryBookScene,
  isPlaying: boolean,
  playbackState: PlaybackState
) {
  if (scene.audioStatus === "ready" && scene.audioUrl) {
    if (playbackState === "loading" && isPlaying) return "正在加载真实配音";
    if (playbackState === "paused" && isPlaying) return "朗读已暂停";
    if (isPlaying) return "真实朗读播放中";
    return "真实朗读已就绪";
  }
  return isPlaying ? "字幕预演中" : "当前使用字幕预演";
}

function getPlaybackTimeLabel(
  scene: ParentStoryBookScene,
  isSceneActive: boolean,
  currentTime: number,
  duration: number
) {
  if (isSceneActive && duration > 0) {
    return `${formatSeconds(currentTime)} / ${formatSeconds(duration)}`;
  }
  return scene.audioStatus === "ready" ? "可播放" : "预演中";
}

function getPlaybackActionTextV2(
  scene: ParentStoryBookScene,
  isPlaying: boolean,
  playbackState: PlaybackState
) {
  if (scene.audioStatus === "ready" && scene.audioUrl) {
    if (playbackState === "paused" && isPlaying) return "继续朗读";
    if (isPlaying) return "暂停朗读";
    return "播放朗读";
  }
  return isPlaying ? "停止预演" : "字幕预演";
}

function getCaptionStatusTextV2(
  scene: ParentStoryBookScene,
  isPlaying: boolean,
  playbackState: PlaybackState
) {
  if (scene.audioStatus === "ready" && scene.audioUrl) {
    if (playbackState === "loading" && isPlaying) return "正在加载真实朗读";
    if (playbackState === "paused" && isPlaying) return "真实朗读已暂停";
    if (isPlaying) return "真实朗读播放中";
    return "真实朗读已就绪";
  }
  return isPlaying ? "当前仅在进行字幕预演" : "当前仅字幕预演，未生成真实音频";
}

function getPlaybackTimeLabelV2(
  scene: ParentStoryBookScene,
  isSceneActive: boolean,
  currentTime: number,
  duration: number
) {
  if (isSceneActive && duration > 0) {
    return `${formatSeconds(currentTime)} / ${formatSeconds(duration)}`;
  }
  return scene.audioStatus === "ready" && scene.audioUrl ? "可播放" : "仅字幕预演";
}

function getBookPlaybackLabel(
  audioDelivery?: ParentStoryBookResponse["providerMeta"]["audioDelivery"],
  isBookPlaying?: boolean
) {
  if (isBookPlaying) return "停止全书";
  if (audioDelivery === "real") return "播放全书";
  if (audioDelivery === "mixed") return "播放全书（含字幕预演页）";
  return "全书字幕预演";
}

export default function StoryBookViewer({
  status,
  story,
  errorMessage,
  refreshMessage,
  cacheState,
  isRefreshing = false,
  selectedChildName,
  hasChildContext,
  generationMode,
  manualTheme,
  pageCount,
  selectedPresetId,
  themeChips,
  pageCountOptions,
  generationHint,
  canGenerate,
  onSelectPreset,
  onGenerationModeChange,
  onManualThemeChange,
  onSelectThemeChip,
  onPageCountChange,
  onGenerate,
  onRetry,
  parentHref = "/parent",
}: {
  status: StoryBookViewerStatus;
  story?: ParentStoryBookResponse | null;
  errorMessage?: string | null;
  refreshMessage?: string | null;
  cacheState?: { kind: "none" | "hit" | "saved"; savedAt?: number };
  isRefreshing?: boolean;
  selectedChildName?: string;
  hasChildContext: boolean;
  generationMode: ParentStoryBookGenerationMode;
  manualTheme: string;
  pageCount: ParentStoryBookPageCount;
  selectedPresetId: ParentStoryBookStylePreset;
  themeChips: string[];
  pageCountOptions: ParentStoryBookPageCount[];
  generationHint?: string | null;
  canGenerate: boolean;
  onSelectPreset: (preset: ParentStoryBookStylePreset) => void;
  onGenerationModeChange: (mode: ParentStoryBookGenerationMode) => void;
  onManualThemeChange: (value: string) => void;
  onSelectThemeChip: (theme: string) => void;
  onPageCountChange: (count: ParentStoryBookPageCount) => void;
  onGenerate: () => void;
  onRetry?: () => void;
  parentHref?: string;
}) {
  const theme = getTheme(story?.stylePreset ?? selectedPresetId);
  const modeCopy = story ? describeStoryBookMode(story.providerMeta.mode) : null;
  const selectedThemeChip = themeChips.includes(manualTheme.trim()) ? manualTheme.trim() : null;
  const requiresTheme =
    generationMode === "manual-theme" || generationMode === "hybrid";

  const bodyContent = !story ? (
    <EmptyStoryState
      status={status}
      errorMessage={errorMessage}
      onRetry={onRetry}
      parentHref={parentHref}
      quietClass={theme.quiet}
      accentClass={theme.accent}
    />
  ) : (
    <StoryBookSceneStream key={story.storyId} story={story} theme={theme} />
  );

  return (
    <div className={cn("min-h-[100svh] px-4 py-4 sm:px-6 sm:py-6", theme.page)}>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Button
            asChild
            variant="outline"
            className={cn("rounded-full shadow-sm", theme.quiet)}
          >
            <Link href={parentHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回家长首页
            </Link>
          </Button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="info">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              成长绘本 Agent V2
            </Badge>
            {modeCopy ? (
              <Badge variant={modeCopy.badgeVariant}>
                <Radio className="mr-1.5 h-3.5 w-3.5" />
                {modeCopy.label}
              </Badge>
            ) : null}
          </div>
        </div>

        <Card className={cn("overflow-hidden backdrop-blur-xl", theme.panel)}>
          <CardHeader className="space-y-4 pb-4">
            <div className="space-y-2">
              <CardTitle className="text-2xl tracking-tight text-slate-950">
                {story?.title ?? "Parent Storybook V2"}
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-7 text-slate-600">
                {story?.summary ??
                  "把孩子的成长线索、家长反馈和教育主题，讲成一部图文音一体、移动端优先的成长绘本。"}
              </CardDescription>
            </div>

            <div className="rounded-[30px] border border-white/70 bg-white/68 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {getGenerationModeCopy(generationMode).label}
                </Badge>
                <Badge variant="outline">页数 {pageCount}</Badge>
                {selectedChildName ? (
                  <Badge variant="secondary">当前孩子：{selectedChildName}</Badge>
                ) : (
                  <Badge variant="warning">当前未选择孩子</Badge>
                )}
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                {getGenerationModeCopy(generationMode).description}
              </p>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    生成模式
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["child-personalized", "个性化"],
                        ["manual-theme", "主题"],
                        ["hybrid", "混合"],
                      ] as const
                    ).map(([value, label]) => {
                      const disabled = value !== "manual-theme" && !hasChildContext;
                      const selected = generationMode === value;
                      return (
                        <Button
                          key={value}
                          type="button"
                          variant={selected ? "default" : "outline"}
                          className={cn("rounded-full", selected ? theme.accent : theme.quiet)}
                          disabled={disabled}
                          onClick={() => onGenerationModeChange(value)}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {requiresTheme ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        快捷主题
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {themeChips.map((themeLabel) => (
                          <button
                            key={themeLabel}
                            type="button"
                            onClick={() => onSelectThemeChip(themeLabel)}
                            className={cn(
                              "rounded-full border px-3 py-2 text-sm transition-all",
                              selectedThemeChip === themeLabel
                                ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                                : "border-white/60 bg-white/75 text-slate-700 hover:bg-white"
                            )}
                          >
                            {themeLabel}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        主题输入
                      </p>
                      <Input
                        value={manualTheme}
                        onChange={(event) => onManualThemeChange(event.target.value)}
                        placeholder="例如：表达情绪、独立入睡、勇敢尝试"
                        className="h-11 rounded-2xl border-white/70 bg-white/88 text-slate-900 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    页数切换
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pageCountOptions.map((value) => (
                      <Button
                        key={value}
                        type="button"
                        variant={pageCount === value ? "default" : "outline"}
                        className={cn("rounded-full", pageCount === value ? theme.accent : theme.quiet)}
                        onClick={() => onPageCountChange(value)}
                      >
                        {value} 页
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    风格预设
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PARENT_STORYBOOK_PRESETS.map((item) => {
                      const presetCopy = getStoryBookPresetCopy(item.id);
                      const selected = item.id === selectedPresetId;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSelectPreset(item.id)}
                          className={cn(
                            "rounded-2xl border px-3 py-2 text-left text-sm transition-all",
                            selected
                              ? "border-slate-900 bg-white text-slate-950 shadow-sm"
                              : "border-white/60 bg-white/65 text-slate-600"
                          )}
                        >
                          <div className="font-semibold">{presetCopy.shortLabel}</div>
                          <div className="mt-1 text-xs opacity-80">
                            {presetCopy.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/70 bg-white/72 px-4 py-3">
                  <div className="text-sm text-slate-600">
                    {generationHint ? generationHint : "参数调整完成后，点击重新生成应用到整本绘本。"}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {story && onRetry ? (
                      <Button
                        type="button"
                        variant="outline"
                        className={cn("rounded-full", theme.quiet)}
                        onClick={onRetry}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        刷新当前版本
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      className={cn("rounded-full shadow-sm", theme.accent)}
                      disabled={!canGenerate}
                      onClick={onGenerate}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      重新生成
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {refreshMessage ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm leading-6 text-amber-900">
                {refreshMessage}
              </div>
            ) : null}
            {isRefreshing ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                正在刷新绘本资源，当前先保留上一版内容。
              </div>
            ) : null}
          </CardHeader>

          <CardContent className="space-y-5 pb-6">
            {bodyContent}

            {story ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Card className={cn("border-white/70", theme.panel)}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap gap-2">
                      {modeCopy ? (
                        <Badge variant={modeCopy.badgeVariant}>{modeCopy.label}</Badge>
                      ) : null}
                      <Badge variant="outline">分镜 {story.providerMeta.sceneCount}</Badge>
                      <Badge variant="outline">亮点 {story.providerMeta.highlightCount}</Badge>
                    </div>
                    <p className="text-sm leading-7 text-slate-600">
                      {modeCopy?.summary}
                    </p>
                    <p className="text-sm leading-7 text-slate-600">
                      收束提示：{story.parentNote}
                    </p>
                  </CardContent>
                </Card>

                <Card className={cn("border-white/70", theme.panel)}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">
                        {formatStoryBookAudioDelivery(story.cacheMeta?.audioDelivery)}
                      </Badge>
                      <Badge variant="outline">
                        {formatStoryBookResponseCache(story.cacheMeta?.storyResponse)}
                      </Badge>
                      {cacheState && cacheState.kind !== "none" ? (
                        <Badge variant="outline">
                          {formatStoryBookClientCache(cacheState.kind)}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm leading-7 text-slate-600">
                      {formatStoryBookProviderLabel("image", story.providerMeta.imageProvider)}
                    </p>
                    <p className="text-sm leading-7 text-slate-600">
                      {formatStoryBookProviderLabel("audio", story.providerMeta.audioProvider)}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StoryBookSceneStream({
  story,
  theme,
}: {
  story: ParentStoryBookResponse;
  theme: StoryBookTheme;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const queueRef = useRef<number[]>([]);
  const sceneRefs = useRef<Record<number, HTMLElement | null>>({});
  const tokenRef = useRef(0);

  const [activeIndex, setActiveIndex] = useState(0);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [playbackSceneIndex, setPlaybackSceneIndex] = useState<number | null>(null);
  const [captionIndex, setCaptionIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBookPlaying, setIsBookPlaying] = useState(false);

  const scenes = useMemo(() => story.scenes ?? [], [story.scenes]);

  function invalidate() {
    tokenRef.current += 1;
    return tokenRef.current;
  }

  function clearPreview() {
    if (previewTimerRef.current) {
      window.clearInterval(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  }

  function clearAudio() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.onloadedmetadata = null;
    audio.onplaying = null;
    audio.onpause = null;
    audio.ontimeupdate = null;
    audio.onended = null;
    audio.onerror = null;
    audio.removeAttribute("src");
    audio.load();
    audioRef.current = null;
  }

  function stopPlayback() {
    invalidate();
    queueRef.current = [];
    clearPreview();
    clearAudio();
    setPlaybackState("idle");
    setPlaybackSceneIndex(null);
    setCaptionIndex(0);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setIsBookPlaying(false);
  }

  function scrollToScene(index: number) {
    sceneRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    setActiveIndex(index);
  }

  useEffect(() => {
    return () => {
      invalidate();
      clearPreview();
      clearAudio();
    };
  }, []);

  useEffect(() => {
    if (!scenes.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (!visibleEntry) return;
        const index = Number(visibleEntry.target.getAttribute("data-scene-index"));
        if (!Number.isNaN(index)) {
          setActiveIndex(index);
        }
      },
      {
        root: null,
        threshold: [0.35, 0.55, 0.8],
        rootMargin: "-12% 0px -24% 0px",
      }
    );

    scenes.forEach((_, index) => {
      const node = sceneRefs.current[index];
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [scenes]);

  function advanceQueue() {
    const nextIndex = queueRef.current.shift();
    if (nextIndex === undefined) {
      stopPlayback();
      return;
    }
    const nextScene = scenes[nextIndex];
    if (!nextScene) {
      stopPlayback();
      return;
    }
    startScenePlayback(nextScene, nextIndex, { continueBook: true });
  }

  function startPreview(
    scene: ParentStoryBookScene,
    index: number,
    options?: { continueBook?: boolean }
  ) {
    const token = invalidate();
    clearAudio();
    clearPreview();

    const segments = splitStoryBookCaptionSegments(scene.audioScript || scene.sceneText);
    const safeSegments = segments.length > 0 ? segments : [scene.audioScript || scene.sceneText];
    const totalDuration = safeSegments.length * PREVIEW_STEP_SECONDS;

    setPlaybackSceneIndex(index);
    setPlaybackState("preview");
    setCaptionIndex(0);
    setProgress(safeSegments.length ? 1 / safeSegments.length : 1);
    setCurrentTime(0);
    setDuration(totalDuration);
    setIsBookPlaying(Boolean(options?.continueBook || queueRef.current.length));
    scrollToScene(index);

    let step = 0;
    previewTimerRef.current = window.setInterval(() => {
      if (tokenRef.current !== token) return;
      step += 1;
      if (step >= safeSegments.length) {
        clearPreview();
        advanceQueue();
        return;
      }
      setCaptionIndex(step);
      setProgress((step + 1) / safeSegments.length);
      setCurrentTime(step * PREVIEW_STEP_SECONDS);
    }, PREVIEW_STEP_SECONDS * 1000);
  }

  function startAudio(
    scene: ParentStoryBookScene,
    index: number,
    options?: { continueBook?: boolean }
  ) {
    if (!scene.audioUrl) {
      startPreview(scene, index, options);
      return;
    }

    const token = invalidate();
    clearPreview();
    clearAudio();

    const audio = new Audio(scene.audioUrl);
    const segments = splitStoryBookCaptionSegments(scene.audioScript || scene.sceneText);
    const safeSegments = segments.length > 0 ? segments : [scene.audioScript || scene.sceneText];
    audioRef.current = audio;
    setPlaybackSceneIndex(index);
    setPlaybackState("loading");
    setCaptionIndex(0);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setIsBookPlaying(Boolean(options?.continueBook || queueRef.current.length));
    scrollToScene(index);

    audio.onloadedmetadata = () => {
      if (tokenRef.current !== token) return;
      setDuration(
        Number.isFinite(audio.duration)
          ? audio.duration
          : safeSegments.length * PREVIEW_STEP_SECONDS
      );
    };
    audio.onplaying = () => {
      if (tokenRef.current !== token) return;
      setPlaybackState("playing");
    };
    audio.onpause = () => {
      if (tokenRef.current !== token || audio.ended) return;
      setPlaybackState("paused");
      if (!queueRef.current.length) {
        setIsBookPlaying(false);
      }
    };
    audio.ontimeupdate = () => {
      if (tokenRef.current !== token) return;
      const safeDuration =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : safeSegments.length * PREVIEW_STEP_SECONDS;
      const nextProgress = safeDuration > 0 ? Math.min(audio.currentTime / safeDuration, 1) : 0;
      const nextCaption =
        safeSegments.length > 1
          ? Math.min(safeSegments.length - 1, Math.floor(nextProgress * safeSegments.length))
          : 0;
      setDuration(safeDuration);
      setCurrentTime(audio.currentTime);
      setProgress(nextProgress);
      setCaptionIndex(nextCaption);
    };
    audio.onended = () => {
      if (tokenRef.current !== token) return;
      advanceQueue();
    };
    audio.onerror = () => {
      if (tokenRef.current !== token) return;
      startPreview(scene, index, options);
    };
    audio.play().catch(() => {
      if (tokenRef.current !== token) return;
      startPreview(scene, index, options);
    });
  }

  function startScenePlayback(
    scene: ParentStoryBookScene,
    index: number,
    options?: { continueBook?: boolean }
  ) {
    if (scene.audioStatus === "ready" && scene.audioUrl) {
      startAudio(scene, index, options);
      return;
    }
    startPreview(scene, index, options);
  }

  function handlePlayScene(scene: ParentStoryBookScene, index: number) {
    if (playbackSceneIndex === index) {
      queueRef.current = [];
      setIsBookPlaying(false);
      if (playbackState === "playing" || playbackState === "loading") {
        audioRef.current?.pause();
        return;
      }
      if (playbackState === "paused" && audioRef.current) {
        void audioRef.current.play().catch(() => startPreview(scene, index));
        return;
      }
      if (playbackState === "preview") {
        stopPlayback();
        return;
      }
    }

    queueRef.current = [];
    setIsBookPlaying(false);
    startScenePlayback(scene, index);
  }

  function handlePlayBook() {
    if (!scenes.length) return;
    if (isBookPlaying) {
      stopPlayback();
      return;
    }

    const startIndex = Math.min(activeIndex, scenes.length - 1);
    queueRef.current = scenes
      .map((_, index) => index)
      .filter((index) => index > startIndex);
    startScenePlayback(scenes[startIndex], startIndex, { continueBook: true });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-[28px] border border-white/70 bg-white/70 px-4 py-3 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <Badge variant="info">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            第 {activeIndex + 1} / {scenes.length} 页
          </Badge>
          <Badge variant={story.mode === "card" ? "warning" : "success"}>
            {story.mode === "card" ? "轻量成长卡" : "成长绘本"}
          </Badge>
        </div>
        <Button
          type="button"
          className={cn("rounded-full shadow-sm", theme.accent)}
          onClick={handlePlayBook}
        >
          {isBookPlaying ? (
            <Pause className="mr-2 h-4 w-4" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          {isBookPlaying ? "停止全书" : "播放全书"}
        </Button>
      </div>

      <div className="space-y-5">
        {scenes.map((scene, index) => {
          const isPlaying = playbackSceneIndex === index && playbackState !== "idle";
          const isSceneActive = playbackSceneIndex === index;
          const segments = splitStoryBookCaptionSegments(scene.audioScript || scene.sceneText);
          return (
            <article
              key={scene.sceneIndex}
              ref={(node) => {
                sceneRefs.current[index] = node;
              }}
              data-scene-index={index}
              className={cn(
                "rounded-[34px] border border-white/65 bg-white/84 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.08)] transition-all duration-500 sm:p-5",
                activeIndex === index
                  ? "scale-[1.01] shadow-[0_28px_80px_rgba(15,23,42,0.14)]"
                  : "scale-[0.992] opacity-95"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={activeIndex === index ? "success" : "secondary"}>
                    第 {index + 1} 页
                  </Badge>
                  <Badge variant="outline" className={theme.chip}>
                    {formatStoryBookHighlightSource(scene.highlightSource)}
                  </Badge>
                  {isPlaying ? (
                    <Badge variant="info">
                      <AudioLines className="mr-1.5 h-3.5 w-3.5" />
                      {scene.audioStatus === "ready" ? "朗读中" : "预演中"}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={scene.imageStatus === "ready" ? "success" : "warning"}>
                    {formatStoryBookSceneStatus("image", scene.imageStatus)}
                  </Badge>
                  <Badge variant={scene.audioStatus === "ready" ? "success" : "warning"}>
                    {formatStoryBookSceneStatus("audio", scene.audioStatus)}
                  </Badge>
                </div>
              </div>

              <div className="relative mt-4 overflow-hidden rounded-[30px] border border-white/80 bg-white shadow-sm">
                <div className="relative aspect-[4/5] w-full sm:aspect-[5/6]">
                  <Image
                    src={scene.imageUrl || scene.assetRef || "/storybook/card.svg"}
                    alt={scene.sceneTitle}
                    fill
                    sizes="(max-width: 768px) 100vw, 720px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/55 via-slate-950/10 to-transparent px-4 py-4">
                  <p className="text-lg font-semibold tracking-tight text-white">
                    {scene.sceneTitle}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <p className="text-base leading-8 text-slate-700">{scene.sceneText}</p>

                <div className="rounded-[28px] border border-white/70 bg-white/78 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">逐页朗读</p>
                      <p className="mt-1 text-xs leading-6 text-slate-500">
                        {getCaptionStatusText(scene, isPlaying, playbackState)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn("rounded-full", theme.quiet)}
                      onClick={() => handlePlayScene(scene, index)}
                    >
                      {isPlaying && playbackState !== "paused" ? (
                        <Pause className="mr-2 h-4 w-4" />
                      ) : (
                        <Play className="mr-2 h-4 w-4" />
                      )}
                      {getPlaybackActionText(scene, isPlaying, playbackState)}
                    </Button>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-300",
                        theme.progress
                      )}
                      style={{
                        width: `${
                          Math.max(
                            isSceneActive ? progress * 100 : 0,
                            isPlaying ? 8 : 0
                          )
                        }%`,
                      }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-slate-400">
                    <span>{formatStoryBookVoiceStyle(scene.voiceStyle)}</span>
                    <span>
                      {getPlaybackTimeLabel(
                        scene,
                        isSceneActive,
                        currentTime,
                        duration
                      )}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(segments.length > 0 ? segments : [scene.sceneText]).map((segment, segmentIndex) => (
                      <span
                        key={`${scene.sceneIndex}-${segmentIndex}`}
                        className={cn(
                          "rounded-2xl border px-3 py-2 text-sm leading-6 transition-all duration-300",
                          isPlaying && segmentIndex === captionIndex
                            ? "border-transparent bg-slate-900 text-white"
                            : "border-white/60 bg-white/70 text-slate-600"
                        )}
                      >
                        {segment}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function EmptyStoryState({
  status,
  errorMessage,
  onRetry,
  parentHref,
  quietClass,
  accentClass,
}: {
  status: StoryBookViewerStatus;
  errorMessage?: string | null;
  onRetry?: () => void;
  parentHref: string;
  quietClass: string;
  accentClass: string;
}) {
  if (status === "loading") {
    return (
      <div className="space-y-4">
        {[0, 1].map((item) => (
          <div
            key={item}
            className="rounded-[30px] border border-white/70 bg-white/80 p-4 shadow-sm"
          >
            <div className="h-5 w-24 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-4 aspect-[4/5] animate-pulse rounded-[26px] bg-slate-100" />
            <div className="mt-4 h-4 w-5/6 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-3 h-4 w-3/4 animate-pulse rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <Card className="border-red-100 bg-red-50/80">
        <CardHeader>
          <CardTitle className="text-xl text-red-900">成长绘本暂时不可用</CardTitle>
          <CardDescription className="leading-7 text-red-700">
            {errorMessage ?? "请稍后重试，或调整参数后再次生成。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className={cn("rounded-full", quietClass)}>
            <Link href={parentHref}>返回家长首页</Link>
          </Button>
          {onRetry ? (
            <Button type="button" className={cn("rounded-full", accentClass)} onClick={onRetry}>
              <RotateCcw className="mr-2 h-4 w-4" />
              重试
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/70 bg-white/78">
      <CardHeader>
        <CardTitle className="text-xl text-slate-950">先设定这本成长绘本</CardTitle>
        <CardDescription className="leading-7 text-slate-600">
          选择模式、主题、页数和风格后，点击“重新生成”，就会得到一部图文音一体的成长绘本。
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm leading-7 text-slate-600">
        主题模式和混合模式需要先输入主题；如果当前没有可用孩子数据，系统会自动推荐你先用主题模式开始。
      </CardContent>
    </Card>
  );
}
