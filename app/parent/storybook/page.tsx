"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import StoryBookViewer from "@/components/parent/StoryBookViewer";
import { buildParentStoryBookRequestFromFeed } from "@/lib/agent/parent-storybook";
import type { ParentStoryBookRequest, ParentStoryBookResponse } from "@/lib/ai/types";
import { useApp } from "@/lib/store";

type StoryBookPageStatus = "loading" | "storybook" | "card" | "error";

export default function ParentStoryBookPage() {
  const searchParams = useSearchParams();
  const childFromQuery = searchParams.get("child") ?? undefined;
  const {
    getParentFeed,
    healthCheckRecords,
    mealRecords,
    growthRecords,
    guardianFeedbacks,
    taskCheckInRecords,
    getChildInterventionCard,
    getLatestConsultationForChild,
  } = useApp();
  const feeds = getParentFeed();
  const selectedFeed = useMemo(() => {
    if (childFromQuery) {
      return feeds.find((item) => item.child.id === childFromQuery) ?? feeds[0];
    }
    return feeds[0];
  }, [childFromQuery, feeds]);

  const request = useMemo<ParentStoryBookRequest | null>(() => {
    if (!selectedFeed) return null;
    return buildParentStoryBookRequestFromFeed({
      feed: selectedFeed,
      healthCheckRecords,
      mealRecords,
      growthRecords,
      guardianFeedbacks,
      taskCheckInRecords,
      latestInterventionCard: getChildInterventionCard(selectedFeed.child.id) ?? null,
      latestConsultation: getLatestConsultationForChild(selectedFeed.child.id) ?? null,
      requestSource: "parent-storybook-page",
    });
  }, [
    getChildInterventionCard,
    getLatestConsultationForChild,
    selectedFeed,
    healthCheckRecords,
    mealRecords,
    growthRecords,
    guardianFeedbacks,
    taskCheckInRecords,
  ]);

  const [status, setStatus] = useState<StoryBookPageStatus>("loading");
  const [story, setStory] = useState<ParentStoryBookResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!request) {
      setStatus("error");
      setErrorMessage("当前没有可用的孩子数据，暂时无法生成绘本。");
      setStory(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function loadStory() {
      setStatus("loading");
      setErrorMessage(null);

      try {
        const response = await fetch("/api/ai/parent-storybook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`storybook request failed: ${response.status}`);
        }

        const data = (await response.json()) as ParentStoryBookResponse;
        if (cancelled) return;

        setStory(data);
        setStatus(data.mode);
      } catch (error) {
        if (cancelled) return;
        setStory(null);
        setStatus("error");
        setErrorMessage(error instanceof Error ? error.message : "绘本生成失败");
      }
    }

    void loadStory();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [request, reloadToken]);

  return (
    <StoryBookViewer
      status={status}
      story={story}
      errorMessage={errorMessage}
      onRetry={() => setReloadToken((prev) => prev + 1)}
    />
  );
}
