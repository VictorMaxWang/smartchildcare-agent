"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, AudioLines, LoaderCircle, Pause, Play, Radio, RotateCcw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PARENT_STORYBOOK_PRESETS, splitStoryBookCaptionSegments } from "@/lib/agent/parent-storybook-presets";
import type { ParentStoryBookResponse, ParentStoryBookScene, ParentStoryBookStylePreset } from "@/lib/ai/types";
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

type StoryBookViewerStatus = "loading" | "storybook" | "card" | "error";
type PlaybackState = "idle" | "loading" | "playing" | "paused" | "preview";

const PREVIEW_STEP_SECONDS = 1.6;

function getTheme(preset: ParentStoryBookStylePreset) {
  if (preset === "moonlit-cutout") {
    return {
      page: "bg-[radial-gradient(circle_at_top,_rgba(219,234,254,0.95),_rgba(191,219,254,0.8)_32%,_rgba(224,231,255,0.72)_60%,_rgba(248,250,252,1)_100%)]",
      panel: "bg-white/76 border-white/70",
      accent: "bg-sky-600 text-white hover:bg-sky-600/90",
      quiet: "border-sky-200/80 bg-white/80 text-sky-900 hover:bg-sky-50",
      dot: "bg-sky-600",
      dotIdle: "bg-sky-100",
      chip: "bg-sky-100 text-sky-700",
      caption: "border-sky-200 bg-sky-50 text-sky-950",
      progress: "bg-gradient-to-r from-sky-600 via-indigo-500 to-slate-500",
    };
  }
  if (preset === "forest-crayon") {
    return {
      page: "bg-[radial-gradient(circle_at_top_right,_rgba(220,252,231,0.92),_rgba(187,247,208,0.75)_32%,_rgba(254,249,195,0.65)_60%,_rgba(248,250,252,1)_100%)]",
      panel: "bg-white/76 border-white/70",
      accent: "bg-emerald-600 text-white hover:bg-emerald-600/90",
      quiet: "border-emerald-200/80 bg-white/80 text-emerald-900 hover:bg-emerald-50",
      dot: "bg-emerald-600",
      dotIdle: "bg-emerald-100",
      chip: "bg-emerald-100 text-emerald-700",
      caption: "border-emerald-200 bg-emerald-50 text-emerald-950",
      progress: "bg-gradient-to-r from-emerald-600 via-lime-500 to-amber-400",
    };
  }
  return {
    page: "bg-[radial-gradient(circle_at_top_left,_rgba(255,245,220,0.95),_rgba(254,226,226,0.72)_35%,_rgba(224,242,254,0.9)_70%,_rgba(248,250,252,1)_100%)]",
    panel: "bg-white/78 border-white/72",
    accent: "bg-amber-500 text-white hover:bg-amber-500/90",
    quiet: "border-amber-200/80 bg-white/80 text-amber-900 hover:bg-amber-50",
    dot: "bg-amber-500",
    dotIdle: "bg-amber-100",
    chip: "bg-amber-100 text-amber-700",
    caption: "border-amber-200 bg-amber-50 text-amber-950",
    progress: "bg-gradient-to-r from-amber-500 via-orange-400 to-rose-400",
  };
}

function formatSeconds(value: number) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const seconds = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getCaptionStatusText(
  scene: ParentStoryBookScene,
  isPlaying: boolean,
  playbackState: PlaybackState
) {
  if (scene.audioStatus === "ready") {
    if (playbackState === "loading" && isPlaying) return "真实配音加载中";
    if (playbackState === "paused" && isPlaying) return "真实配音已暂停";
    if (isPlaying) return "真实配音播放中";
    return "真实配音已就绪";
  }

  if (isPlaying) return "字幕预演播放中";
  return "当前为字幕预演";
}

function getPlaybackActionText(
  scene: ParentStoryBookScene,
  isPlaying: boolean,
  playbackState: PlaybackState
) {
  if (scene.audioStatus === "ready") {
    if (playbackState === "paused" && isPlaying) return "继续播放";
    if (isPlaying) return "暂停配音";
    return "播放配音";
  }

  return isPlaying ? "停止预演" : "开始预演";
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

export default function StoryBookViewer({
  status,
  story,
  errorMessage,
  refreshMessage,
  cacheState,
  isRefreshing = false,
  selectedPreset,
  selectedPresetId,
  onPresetChange,
  onSelectPreset,
  onRetry,
  parentHref = "/parent",
}: {
  status: StoryBookViewerStatus;
  story?: ParentStoryBookResponse | null;
  errorMessage?: string | null;
  refreshMessage?: string | null;
  cacheState?: { kind: "none" | "hit" | "saved"; savedAt?: number };
  isRefreshing?: boolean;
  selectedPreset?: ParentStoryBookStylePreset;
  selectedPresetId?: ParentStoryBookStylePreset;
  onPresetChange?: (preset: ParentStoryBookStylePreset) => void;
  onSelectPreset?: (preset: ParentStoryBookStylePreset) => void;
  onRetry?: () => void;
  parentHref?: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const tokenRef = useRef(0);

  const [activeIndex, setActiveIndex] = useState(0);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [playbackSceneIndex, setPlaybackSceneIndex] = useState<number | null>(null);
  const [captionIndex, setCaptionIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const scenes = story?.scenes ?? [];
  const presetId = selectedPreset ?? selectedPresetId ?? story?.stylePreset ?? "sunrise-watercolor";
  const theme = getTheme(presetId);
  const isCard = (story?.mode ?? status) === "card";
  const cacheBadge = cacheState?.kind ?? "none";
  const handlePresetSelect = onPresetChange ?? onSelectPreset;

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
    clearPreview();
    clearAudio();
    setPlaybackState("idle");
    setPlaybackSceneIndex(null);
    setCaptionIndex(0);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
  }

  useEffect(() => {
    return () => {
      invalidate();
      clearPreview();
      clearAudio();
    };
  }, []);

  useEffect(() => {
    invalidate();
    clearPreview();
    clearAudio();
    const resetTimer = window.setTimeout(() => {
      setPlaybackState("idle");
      setPlaybackSceneIndex(null);
      setCaptionIndex(0);
      setProgress(0);
      setCurrentTime(0);
      setDuration(0);
      setActiveIndex(0);
    }, 0);

    return () => {
      window.clearTimeout(resetTimer);
    };
  }, [story?.storyId, status]);

  function scrollToScene(index: number) {
    const container = scrollRef.current;
    if (!container) return;
    const nextChild = container.children.item(index) as HTMLElement | null;
    nextChild?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setActiveIndex(index);
  }

  function startPreview(scene: ParentStoryBookScene, index: number) {
    const token = invalidate();
    clearAudio();
    clearPreview();
    const segments = splitStoryBookCaptionSegments(scene.audioScript || scene.sceneText);
    const safeSegments = segments.length > 0 ? segments : [scene.audioScript || scene.sceneText];
    setPlaybackSceneIndex(index);
    setPlaybackState("preview");
    setCaptionIndex(0);
    setProgress(safeSegments.length ? 1 / safeSegments.length : 1);
    setCurrentTime(0);
    setDuration(safeSegments.length * PREVIEW_STEP_SECONDS);

    let step = 0;
    previewTimerRef.current = window.setInterval(() => {
      if (tokenRef.current !== token) return;
      step += 1;
      if (step >= safeSegments.length) {
        stopPlayback();
        return;
      }
      setCaptionIndex(step);
      setProgress((step + 1) / safeSegments.length);
      setCurrentTime(step * PREVIEW_STEP_SECONDS);
    }, PREVIEW_STEP_SECONDS * 1000);
  }

  function startAudio(scene: ParentStoryBookScene, index: number) {
    if (!scene.audioUrl) {
      startPreview(scene, index);
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

    audio.onloadedmetadata = () => {
      if (tokenRef.current !== token) return;
      setDuration(Number.isFinite(audio.duration) ? audio.duration : safeSegments.length * PREVIEW_STEP_SECONDS);
    };
    audio.onplaying = () => {
      if (tokenRef.current !== token) return;
      setPlaybackState("playing");
    };
    audio.onpause = () => {
      if (tokenRef.current !== token || audio.ended) return;
      setPlaybackState("paused");
    };
    audio.ontimeupdate = () => {
      if (tokenRef.current !== token) return;
      const safeDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : safeSegments.length * PREVIEW_STEP_SECONDS;
      const nextProgress = safeDuration > 0 ? Math.min(audio.currentTime / safeDuration, 1) : 0;
      const nextCaption = safeSegments.length > 1 ? Math.min(safeSegments.length - 1, Math.floor(nextProgress * safeSegments.length)) : 0;
      setDuration(safeDuration);
      setCurrentTime(audio.currentTime);
      setProgress(nextProgress);
      setCaptionIndex(nextCaption);
    };
    audio.onended = () => {
      if (tokenRef.current !== token) return;
      stopPlayback();
    };
    audio.onerror = () => {
      if (tokenRef.current !== token) return;
      startPreview(scene, index);
    };
    audio.play().catch(() => {
      if (tokenRef.current !== token) return;
      startPreview(scene, index);
    });
  }

  function handlePlay(scene: ParentStoryBookScene, index: number) {
    if (playbackSceneIndex === index) {
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
    scrollToScene(index);
    if (scene.audioStatus === "ready" && scene.audioUrl) {
      startAudio(scene, index);
      return;
    }
    startPreview(scene, index);
  }

  if (status === "loading") {
    return <StateShell kind="loading" parentHref={parentHref} pageClass={theme.page} panelClass={theme.panel} quietClass={theme.quiet} />;
  }
  if (status === "error" || !story) {
    return <StateShell kind="error" parentHref={parentHref} pageClass={theme.page} panelClass={theme.panel} quietClass={theme.quiet} accentClass={theme.accent} errorMessage={errorMessage} onRetry={onRetry} />;
  }

  const modeCopy = describeStoryBookMode(story.providerMeta.mode);
  const responseCacheLabel = formatStoryBookResponseCache(
    story.cacheMeta?.storyResponse
  );
  const audioDeliveryLabel = formatStoryBookAudioDelivery(
    story.cacheMeta?.audioDelivery
  );
  const clientCacheLabel = formatStoryBookClientCache(cacheBadge);
  const storyTypeLabel = isCard ? "成长故事卡" : "晚安微绘本";

  return (
    <div className={cn("min-h-[100svh] px-4 py-4 sm:px-6 sm:py-6", theme.page)}>
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] max-w-3xl flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="outline" className={cn("rounded-full shadow-sm", theme.quiet)}>
            <Link href={parentHref}><ArrowLeft className="mr-2 h-4 w-4" />返回家长首页</Link>
          </Button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="info"><Sparkles className="mr-1.5 h-3.5 w-3.5" />{storyTypeLabel}</Badge>
            <Badge variant={modeCopy.badgeVariant}><Radio className="mr-1.5 h-3.5 w-3.5" />{modeCopy.label}</Badge>
          </div>
        </div>

        <Card className={cn("overflow-hidden backdrop-blur-xl", theme.panel)}>
          <CardHeader className="space-y-4 pb-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={story.cacheMeta?.storyResponse === "hit" ? "success" : "outline"}>{responseCacheLabel}</Badge>
                {story.providerMeta.cacheHitCount ? <Badge variant="success">素材缓存命中 {story.providerMeta.cacheHitCount}</Badge> : null}
                <Badge variant="secondary">{formatStoryBookProviderLabel("image", story.providerMeta.imageProvider)}</Badge>
                <Badge variant="secondary">{formatStoryBookProviderLabel("audio", story.providerMeta.audioProvider)}</Badge>
              </div>
              <CardTitle className="text-2xl tracking-tight text-slate-950">{story.title}</CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-6 text-slate-600">{story.summary}</CardDescription>
            </div>

            <div className="rounded-[28px] border border-white/70 bg-white/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={modeCopy.badgeVariant}>{modeCopy.label}</Badge>
                <Badge variant={story.providerMeta.realProvider ? "success" : "secondary"}>
                  {story.providerMeta.realProvider ? "含真实生成能力" : "当前为演示资源"}
                </Badge>
                <Badge variant="outline">分镜 {story.providerMeta.sceneCount}</Badge>
                <Badge variant="outline">亮点 {story.providerMeta.highlightCount} 条</Badge>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-700">{modeCopy.summary}</p>
            </div>

            <div className="space-y-3 rounded-[28px] border border-white/60 bg-white/55 p-3">
              <div className="flex flex-wrap gap-2">
                {PARENT_STORYBOOK_PRESETS.map((item) => {
                  const presetCopy = getStoryBookPresetCopy(item.id);
                  return (
                    <button key={item.id} type="button" onClick={() => handlePresetSelect?.(item.id)} className={cn("rounded-2xl border px-3 py-2 text-left text-sm transition-all", item.id === presetId ? "border-slate-900 bg-white text-slate-950 shadow-sm" : "border-white/60 bg-white/55 text-slate-600")}>
                      <div className="font-semibold">{presetCopy.shortLabel}</div>
                      <div className="mt-1 text-xs opacity-80">{presetCopy.description}</div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs leading-6 text-slate-500">可随时切换绘本风格；即使当前媒体走兜底，录屏画面和故事节奏也会保持完整。</p>
            </div>

            {refreshMessage ? <div className="rounded-3xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm leading-6 text-amber-900">{refreshMessage}</div> : null}
            {isRefreshing ? <div className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />正在刷新风格与媒体，当前先保留上一版微绘本。</div> : null}
            {cacheBadge !== "none" ? <div className="text-xs text-slate-500">{clientCacheLabel}</div> : null}
          </CardHeader>

          <CardContent className="pb-6">
            <div ref={scrollRef} onScroll={() => {
              const node = scrollRef.current;
              if (!node) return;
              const nextIndex = Math.round(node.scrollLeft / (node.clientWidth || 1));
              if (nextIndex !== activeIndex) setActiveIndex(nextIndex);
            }} className={cn("storybook-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2", isCard ? "pointer-events-none overflow-hidden" : "")}>
              {scenes.map((scene, index) => {
                const isActive = index === activeIndex;
                const isPlaying = playbackSceneIndex === index && playbackState !== "idle";
                const isScenePlaybackTarget = playbackSceneIndex === index;
                const segments = splitStoryBookCaptionSegments(scene.audioScript || scene.sceneText);
                const playbackActionText = getPlaybackActionText(scene, isPlaying, playbackState);
                return (
                  <article key={scene.sceneIndex} className={cn("min-w-full snap-center rounded-[30px] border border-white/60 p-4 transition-all duration-300 sm:p-5", isActive ? "translate-y-0 scale-100 bg-white/84 shadow-[0_22px_70px_rgba(15,23,42,0.12)]" : "translate-y-1 scale-[0.985] bg-white/68 shadow-[0_12px_40px_rgba(15,23,42,0.06)]")}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={isActive ? "success" : "secondary"}>第 {index + 1} 幕</Badge>
                        <Badge variant="outline" className={theme.chip}>{formatStoryBookHighlightSource(scene.highlightSource)}</Badge>
                        {isPlaying ? <Badge variant="info"><AudioLines className="mr-1.5 h-3.5 w-3.5" />{scene.audioStatus === "ready" ? "配音中" : "预演中"}</Badge> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={scene.imageStatus === "ready" ? "success" : "warning"}>{formatStoryBookSceneStatus("image", scene.imageStatus)}</Badge>
                        <Badge variant={scene.audioStatus === "ready" ? "success" : "warning"}>{formatStoryBookSceneStatus("audio", scene.audioStatus)}</Badge>
                      </div>
                    </div>

                    <div className="relative mt-4 h-64 overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-sm sm:h-80">
                      <Image src={scene.imageUrl || scene.assetRef || "/storybook/card.svg"} alt={scene.sceneTitle} fill sizes="(max-width: 640px) 100vw, 768px" className={cn("object-cover transition-transform duration-500", isActive ? "scale-[1.01]" : "scale-100")} unoptimized />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/55 to-transparent px-4 py-4"><p className="text-sm font-semibold text-white">{scene.sceneTitle}</p></div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <p className="text-base leading-7 text-slate-700">{scene.sceneText}</p>
                      <div className="rounded-[28px] border border-white/70 bg-white/72 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-950">字幕跟读</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {getCaptionStatusText(scene, isPlaying, playbackState)}
                            </p>
                          </div>
                          <Button type="button" variant="outline" className={cn("rounded-full", theme.quiet)} onClick={() => handlePlay(scene, index)}>
                            {isPlaying && playbackState !== "paused" ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                            {playbackActionText}
                          </Button>
                        </div>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full transition-[width] duration-300", theme.progress)} style={{ width: `${Math.max(playbackSceneIndex === index ? progress * 100 : 0, isPlaying ? 8 : 0)}%` }} /></div>
                        <div className="mt-3 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-slate-400"><span>{formatStoryBookVoiceStyle(scene.voiceStyle)}</span><span>{getPlaybackTimeLabel(scene, isScenePlaybackTarget, currentTime, duration)}</span></div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(segments.length > 0 ? segments : [scene.sceneText]).map((segment, segmentIndex) => (
                            <span key={`${scene.sceneIndex}-${segmentIndex}`} className={cn("rounded-2xl border px-3 py-2 text-sm leading-6 transition-all duration-300", isPlaying && segmentIndex === captionIndex ? theme.caption : "border-white/60 bg-white/70 text-slate-600")}>{segment}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <Button type="button" variant="outline" className={cn("rounded-full", theme.quiet)} onClick={() => scrollToScene(Math.max(0, index - 1))} disabled={index === 0}><ArrowLeft className="mr-2 h-4 w-4" />上一幕</Button>
                      <Button type="button" className={cn("rounded-full shadow-sm", theme.accent)} onClick={() => handlePlay(scene, index)}>
                        {isPlaying && playbackState !== "paused" ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                        {playbackActionText}
                      </Button>
                      <Button type="button" variant="outline" className={cn("rounded-full", theme.quiet)} onClick={() => scrollToScene(Math.min(scenes.length - 1, index + 1))} disabled={index === scenes.length - 1}>下一幕<ArrowRight className="ml-2 h-4 w-4" /></Button>
                    </div>
                  </article>
                );
              })}
            </div>

            {!isCard ? <div className="mt-4 flex items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{scenes.map((scene, index) => <button key={scene.sceneIndex} type="button" onClick={() => scrollToScene(index)} className={cn("h-2.5 rounded-full transition-all", index === activeIndex ? `w-10 ${theme.dot}` : `w-2.5 ${theme.dotIdle}`)} aria-label={`跳转到第 ${index + 1} 幕`} />)}</div><p className="text-xs text-slate-500">左右滑动或点按钮切换，移动端动效保持轻量。</p></div> : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Card className={cn("border-white/70", theme.panel)}><CardContent className="space-y-3 p-4"><div className="flex flex-wrap gap-2"><Badge variant={modeCopy.badgeVariant}>{modeCopy.label}</Badge><Badge variant="outline">分镜 {story.providerMeta.sceneCount}</Badge><Badge variant="outline">亮点 {story.providerMeta.highlightCount}</Badge></div><p className="text-sm leading-7 text-slate-600">{modeCopy.summary}</p><p className="text-sm leading-7 text-slate-600">故事收束：{story.moral}</p></CardContent></Card>
              <Card className={cn("border-white/70", theme.panel)}><CardContent className="space-y-3 p-4"><div className="flex flex-wrap gap-2"><Badge variant="outline">{audioDeliveryLabel}</Badge><Badge variant="outline">{responseCacheLabel}</Badge><Badge variant="outline">缓存窗 {Math.round((story.providerMeta.cacheWindowSeconds ?? 0) / 60)} 分钟</Badge></div><p className="text-sm leading-7 text-slate-600">{story.cacheMeta?.audioDelivery === "stream-url" ? "真实配音通过短链媒体地址下发，移动端加载更稳。" : story.cacheMeta?.audioDelivery === "inline-data-url" ? "真实配音以内联数据下发，适合纯前端预览。" : "当前没有可直接播放的真实配音，自动回落到字幕预演。"}</p><p className="text-sm leading-7 text-slate-600">今晚陪伴动作：{story.parentNote}</p></CardContent></Card>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="outline" className={cn("rounded-full", theme.quiet)}><Link href={parentHref}><ArrowLeft className="mr-2 h-4 w-4" />返回</Link></Button>
          {onRetry ? <Button type="button" className={cn("rounded-full shadow-sm", theme.accent)} onClick={onRetry}><RotateCcw className="mr-2 h-4 w-4" />重新生成</Button> : null}
        </div>
      </div>
    </div>
  );
}

function StateShell({
  kind,
  parentHref,
  pageClass,
  panelClass,
  quietClass,
  accentClass,
  errorMessage,
  onRetry,
}: {
  kind: "loading" | "error";
  parentHref: string;
  pageClass: string;
  panelClass: string;
  quietClass: string;
  accentClass?: string;
  errorMessage?: string | null;
  onRetry?: () => void;
}) {
  if (kind === "loading") {
    return (
      <div className={cn("min-h-[100svh] px-4 py-4 sm:px-6 sm:py-6", pageClass)}>
        <div className="mx-auto flex min-h-[calc(100svh-2rem)] max-w-3xl flex-col justify-between gap-4">
          <Button asChild variant="outline" className={cn("w-fit rounded-full", quietClass)}><Link href={parentHref}><ArrowLeft className="mr-2 h-4 w-4" />返回家长首页</Link></Button>
          <Card className={cn("backdrop-blur-xl", panelClass)}><CardContent className="space-y-4 p-4 sm:p-6"><div className="h-6 w-40 animate-pulse rounded-full bg-slate-200" /><div className="h-4 w-full animate-pulse rounded-full bg-slate-200" /><div className="h-4 w-5/6 animate-pulse rounded-full bg-slate-200" /><div className="h-72 rounded-[28px] bg-slate-100" /><div className="grid gap-3 sm:grid-cols-3"><div className="h-14 animate-pulse rounded-2xl bg-slate-100" /><div className="h-14 animate-pulse rounded-2xl bg-slate-100" /><div className="h-14 animate-pulse rounded-2xl bg-slate-100" /></div></CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-[100svh] px-4 py-4 sm:px-6 sm:py-6", pageClass)}>
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] max-w-2xl flex-col justify-center gap-4">
        <Card className={cn("backdrop-blur-xl", panelClass)}>
          <CardHeader><CardTitle className="text-2xl text-slate-950">微绘本暂时不可用</CardTitle><CardDescription className="text-sm leading-6 text-slate-600">{errorMessage ?? "请先返回上一页，再重新尝试。"}</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className={cn("rounded-full", quietClass)}><Link href={parentHref}>返回家长首页</Link></Button>
            {onRetry ? <Button type="button" className={cn("rounded-full shadow-sm", accentClass)} onClick={onRetry}><RotateCcw className="mr-2 h-4 w-4" />重新生成</Button> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
