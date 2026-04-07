"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, MoonStar, Play, RotateCcw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ParentStoryBookResponse, ParentStoryBookScene } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

type StoryBookViewerStatus = "loading" | "storybook" | "card" | "error";

export default function StoryBookViewer({
  status,
  story,
  errorMessage,
  onRetry,
  parentHref = "/parent",
}: {
  status: StoryBookViewerStatus;
  story?: ParentStoryBookResponse | null;
  errorMessage?: string | null;
  onRetry?: () => void;
  parentHref?: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const previewTimeoutRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [previewSceneIndex, setPreviewSceneIndex] = useState<number | null>(null);
  const [previewText, setPreviewText] = useState<string>("");

  const scenes = story?.scenes ?? [];
  const mode = story?.mode ?? status;
  const childLabel = useMemo(() => story?.title?.replace(/\s*的.*$/, "") || "今日", [story]);

  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setActiveIndex(0);
      setPreviewSceneIndex(null);
      setPreviewText("");
      if (previewTimeoutRef.current) {
        window.clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = null;
      }
    }, 0);

    return () => {
      window.clearTimeout(resetTimer);
    };
  }, [story?.storyId, status]);

  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) {
        window.clearTimeout(previewTimeoutRef.current);
      }
    };
  }, []);

  function scrollToIndex(index: number) {
    const container = scrollRef.current;
    if (!container) return;
    const nextChild = container.children.item(index) as HTMLElement | null;
    nextChild?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setActiveIndex(index);
  }

  function handleScroll() {
    const container = scrollRef.current;
    if (!container || container.children.length === 0) return;
    const width = container.clientWidth || 1;
    const nextIndex = Math.round(container.scrollLeft / width);
    if (nextIndex !== activeIndex) {
      setActiveIndex(Math.min(container.children.length - 1, Math.max(0, nextIndex)));
    }
  }

  function triggerPreview(scene: ParentStoryBookScene, index: number) {
    if (previewTimeoutRef.current) {
      window.clearTimeout(previewTimeoutRef.current);
    }

    setPreviewSceneIndex(index);
    setPreviewText(scene.audioScript);

    previewTimeoutRef.current = window.setTimeout(() => {
      setPreviewSceneIndex(null);
      setPreviewText("");
      previewTimeoutRef.current = null;
    }, 4200);
  }

  function handlePlay(scene: ParentStoryBookScene, index: number) {
    if (scene.audioStatus === "ready" && scene.audioUrl) {
      try {
        const audio = new Audio(scene.audioUrl);
        audio.play().catch(() => triggerPreview(scene, index));
        setPreviewSceneIndex(index);
        setPreviewText(scene.audioScript);
        previewTimeoutRef.current = window.setTimeout(() => {
          setPreviewSceneIndex(null);
          setPreviewText("");
          previewTimeoutRef.current = null;
        }, 5000);
        return;
      } catch {
        // fall through to preview mode
      }
    }

    triggerPreview(scene, index);
  }

  if (status === "loading") {
    return <LoadingState parentHref={parentHref} />;
  }

  if (status === "error") {
    return (
      <ErrorState
        parentHref={parentHref}
        errorMessage={errorMessage}
        onRetry={onRetry}
      />
    );
  }

  if (!story) {
    return <ErrorState parentHref={parentHref} errorMessage="暂时没有可展示的绘本内容。" onRetry={onRetry} />;
  }

  if (mode === "card") {
    return (
      <div className="min-h-[100svh] bg-[radial-gradient(circle_at_top_left,_rgba(255,247,237,0.98),_rgba(241,245,249,1)_40%,_rgba(226,232,240,1)_100%)] px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto flex min-h-[calc(100svh-2rem)] max-w-3xl flex-col justify-between gap-4">
          <TopBar story={story} parentHref={parentHref} />
          <Card className="overflow-hidden border-white/80 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <CardContent className="space-y-4 p-4 sm:p-6">
              <SceneArtwork scene={story.scenes[0]} active />
              <div className="flex items-center gap-2">
                <Badge variant="info">成长小卡</Badge>
                <Badge variant="secondary">{story.providerMeta.provider}</Badge>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{story.title}</h2>
              <p className="text-sm leading-7 text-slate-600">{story.summary}</p>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-medium tracking-[0.16em] text-slate-400">MORAL</p>
                <p className="mt-2 text-base leading-7 text-slate-800">{story.moral}</p>
              </div>
              <div className="rounded-3xl border border-amber-100 bg-amber-50/80 p-4">
                <p className="text-xs font-medium tracking-[0.16em] text-amber-700">PARENT NOTE</p>
                <p className="mt-2 text-sm leading-7 text-amber-900">{story.parentNote}</p>
              </div>
              <ScenePlayBlock
                scene={story.scenes[0]}
                index={0}
                previewSceneIndex={previewSceneIndex}
                previewText={previewText}
                onPlay={handlePlay}
              />
            </CardContent>
          </Card>
          <FooterActions parentHref={parentHref} onRetry={onRetry} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] bg-[radial-gradient(circle_at_top,_rgba(255,251,235,0.96),_rgba(224,242,254,0.9)_46%,_rgba(241,245,249,1)_100%)] px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] max-w-3xl flex-col gap-4">
        <TopBar story={story} parentHref={parentHref} />

        <Card className="overflow-hidden border-white/80 bg-white/85 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
          <CardHeader className="space-y-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">三幕微绘本</Badge>
                  <Badge variant={story.fallback ? "warning" : "success"}>
                    {story.fallback ? "规则生成" : "AI 绘本"}
                  </Badge>
                  <Badge variant="secondary">{story.providerMeta.imageProvider}</Badge>
                </div>
                <CardTitle className="text-2xl tracking-tight text-slate-900">{story.title}</CardTitle>
                <CardDescription className="max-w-2xl text-sm leading-6 text-slate-600">
                  {story.summary}
                </CardDescription>
              </div>
              <div className="hidden sm:block">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  {activeIndex + 1}/{scenes.length}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {scenes.map((scene, index) => (
                <button
                  key={scene.sceneIndex}
                  type="button"
                  onClick={() => scrollToIndex(index)}
                  className={cn(
                    "h-2.5 rounded-full transition-all",
                    index === activeIndex ? "w-8 bg-slate-900" : "w-2.5 bg-slate-300"
                  )}
                  aria-label={`切换到第 ${index + 1} 幕`}
                />
              ))}
            </div>
          </CardHeader>

          <CardContent className="pb-6">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="storybook-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
            >
              {scenes.map((scene, index) => (
                <article
                  key={scene.sceneIndex}
                  className="min-w-full snap-center rounded-[28px] border border-slate-100 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm"
                >
                  <SceneHeader scene={scene} index={index} active={index === activeIndex} />
                  <div className="mt-4">
                    <SceneArtwork scene={scene} active={index === activeIndex} />
                  </div>
                  <div className="mt-4 space-y-3">
                    <p className="text-lg font-semibold text-slate-900">{scene.sceneTitle}</p>
                    <p className="text-sm leading-7 text-slate-600">{scene.sceneText}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{scene.voiceStyle}</Badge>
                      <Badge variant={scene.imageStatus === "ready" ? "success" : "warning"}>{scene.imageStatus}</Badge>
                      <Badge variant={scene.audioStatus === "ready" ? "success" : "warning"}>{scene.audioStatus}</Badge>
                    </div>
                  </div>
                  <ScenePlayBlock
                    scene={scene}
                    index={index}
                    previewSceneIndex={previewSceneIndex}
                    previewText={previewText}
                    onPlay={handlePlay}
                  />
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => scrollToIndex(Math.max(0, index - 1))}
                      disabled={index === 0}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      上一幕
                    </Button>
                    <Button
                      type="button"
                      variant="premium"
                      className="rounded-full"
                      onClick={() => handlePlay(scene, index)}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      {scene.audioStatus === "ready" ? "播放旁白" : "试听预览"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => scrollToIndex(Math.min(scenes.length - 1, index + 1))}
                      disabled={index === scenes.length - 1}
                    >
                      下一幕
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">来源：{story.providerMeta.provider}</Badge>
                <Badge variant="outline">场景 {scenes.length} 幕</Badge>
                <Badge variant={story.fallback ? "warning" : "success"}>
                  {story.fallback ? "本地回退可演示" : "可继续追问"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" className="rounded-full">
                  <Link href={parentHref}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    返回家长首页
                  </Link>
                </Button>
                {onRetry ? (
                  <Button type="button" variant="premium" className="rounded-full" onClick={onRetry}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    重新生成
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/80 bg-white/70 shadow-sm backdrop-blur">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
              <MoonStar className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">睡前一句话</p>
              <p className="mt-1 truncate text-sm text-slate-600">{story.parentNote}</p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {childLabel}
            </Badge>
          </CardContent>
        </Card>

        <FooterActions parentHref={parentHref} onRetry={onRetry} />
      </div>
    </div>
  );
}

function TopBar({ story, parentHref }: { story: ParentStoryBookResponse; parentHref: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Button asChild variant="outline" className="rounded-full border-white/70 bg-white/80 shadow-sm">
        <Link href={parentHref}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          家长首页
        </Link>
      </Button>
      <div className="flex items-center gap-2">
        <Badge variant="info" className="rounded-full px-3 py-1">
          <Sparkles className="mr-1 h-3.5 w-3.5" />
          {story.mode === "storybook" ? "今日微绘本" : "成长故事卡"}
        </Badge>
      </div>
    </div>
  );
}

function SceneHeader({
  scene,
  index,
  active,
}: {
  scene: ParentStoryBookScene;
  index: number;
  active: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Badge variant={active ? "success" : "secondary"}>第 {index + 1} 幕</Badge>
        <Badge variant="outline">{scene.highlightSource}</Badge>
      </div>
      <Badge variant="outline">{scene.sceneIndex}</Badge>
    </div>
  );
}

function SceneArtwork({ scene, active }: { scene: ParentStoryBookScene; active: boolean }) {
  const imageSrc = scene.imageUrl || scene.assetRef || "/storybook/card.svg";
  return (
    <div
      className={cn(
        "relative h-60 overflow-hidden rounded-[24px] border border-slate-100 bg-white sm:h-72",
        active ? "shadow-[0_16px_60px_rgba(15,23,42,0.12)]" : "shadow-sm"
      )}
    >
      <Image
        src={imageSrc}
        alt={scene.sceneTitle}
        fill
        sizes="(max-width: 640px) 100vw, 768px"
        className="object-cover"
        unoptimized
      />
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-950/60 to-transparent px-4 py-3">
        <p className="text-sm font-medium text-white/90">{scene.sceneTitle}</p>
      </div>
    </div>
  );
}

function ScenePlayBlock({
  scene,
  index,
  previewSceneIndex,
  previewText,
  onPlay,
}: {
  scene: ParentStoryBookScene;
  index: number;
  previewSceneIndex: number | null;
  previewText: string;
  onPlay: (scene: ParentStoryBookScene, index: number) => void;
}) {
  const isPreviewing = previewSceneIndex === index;

  return (
    <div className="mt-4 rounded-3xl border border-slate-100 bg-white/85 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">旁白播放</p>
          <p className="text-xs text-slate-500">{scene.audioStatus === "ready" ? "真实音频可播" : "当前使用预览文案"}</p>
        </div>
        <Button type="button" variant="outline" className="rounded-full" onClick={() => onPlay(scene, index)}>
          <Play className="mr-2 h-4 w-4" />
          {scene.audioStatus === "ready" ? "播放" : "预览"}
        </Button>
      </div>
      {isPreviewing ? (
        <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
          {previewText}
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-slate-200 p-3 text-sm leading-6 text-slate-500">
          点击播放会先展示一段可录屏的讲述预览。
        </div>
      )}
    </div>
  );
}

function FooterActions({ parentHref, onRetry }: { parentHref: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Button asChild variant="outline" className="rounded-full">
        <Link href={parentHref}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回家长页
        </Link>
      </Button>
      {onRetry ? (
        <Button type="button" variant="premium" className="rounded-full" onClick={onRetry}>
          <RotateCcw className="mr-2 h-4 w-4" />
          重试
        </Button>
      ) : null}
    </div>
  );
}

function LoadingState({ parentHref }: { parentHref: string }) {
  return (
    <div className="min-h-[100svh] bg-[radial-gradient(circle_at_top,_rgba(255,251,235,0.96),_rgba(241,245,249,1)_100%)] px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] max-w-3xl flex-col justify-between gap-4">
        <TopBarSkeleton parentHref={parentHref} />
        <Card className="border-white/80 bg-white/85 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="h-6 w-40 animate-pulse rounded-full bg-slate-200" />
            <div className="h-4 w-full animate-pulse rounded-full bg-slate-200" />
            <div className="h-4 w-5/6 animate-pulse rounded-full bg-slate-200" />
            <div className="h-64 rounded-[24px] bg-slate-100" />
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ErrorState({
  parentHref,
  errorMessage,
  onRetry,
}: {
  parentHref: string;
  errorMessage?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="min-h-[100svh] bg-[radial-gradient(circle_at_top,_rgba(254,242,242,0.95),_rgba(241,245,249,1)_100%)] px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex min-h-[calc(100svh-2rem)] max-w-2xl flex-col justify-center gap-4">
        <Card className="border-rose-100 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-900">绘本暂时没生成出来</CardTitle>
            <CardDescription className="text-sm leading-6 text-slate-600">
              {errorMessage ?? "我们先回到家长首页，再试一次。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="rounded-full">
              <Link href={parentHref}>返回家长首页</Link>
            </Button>
            {onRetry ? (
              <Button type="button" variant="premium" className="rounded-full" onClick={onRetry}>
                <RotateCcw className="mr-2 h-4 w-4" />
                再试一次
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TopBarSkeleton({ parentHref }: { parentHref: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Button asChild variant="outline" className="rounded-full border-white/70 bg-white/80 shadow-sm">
        <Link href={parentHref}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          家长首页
        </Link>
      </Button>
      <div className="h-9 w-28 animate-pulse rounded-full bg-white/80" />
    </div>
  );
}
