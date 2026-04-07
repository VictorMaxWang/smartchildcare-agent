"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import StoryBookViewer from "@/components/parent/StoryBookViewer";
import {
  buildParentStoryBookRequestFromFeed,
  DEFAULT_PARENT_STORYBOOK_STYLE_PRESET,
  resolveParentStoryBookStylePreset,
} from "@/lib/agent/parent-storybook";
import type {
  ParentStoryBookRequest,
  ParentStoryBookResponse,
  ParentStoryBookStylePreset,
} from "@/lib/ai/types";
import {
  buildParentStoryBookCacheKey,
  readParentStoryBookCache,
  type ParentStoryBookClientCacheState,
  writeParentStoryBookCache,
} from "@/lib/parent/storybook-cache";
import { useApp } from "@/lib/store";

type StoryBookPageStatus = "loading" | "storybook" | "card" | "error";

export default function ParentStoryBookPage() {
  const searchParams = useSearchParams();
  const childFromQuery = searchParams.get("child") ?? undefined;
  const presetFromQuery = searchParams.get("preset");
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

  const [status, setStatus] = useState<StoryBookPageStatus>("loading");
  const [story, setStory] = useState<ParentStoryBookResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cacheState, setCacheState] = useState<ParentStoryBookClientCacheState>({
    kind: "none",
  });
  const [selectedPreset, setSelectedPreset] = useState<ParentStoryBookStylePreset>(
    resolveParentStoryBookStylePreset(presetFromQuery)
  );
  const [reloadToken, setReloadToken] = useState(0);
  const networkOnlyRef = useRef(false);
  const storyRef = useRef<ParentStoryBookResponse | null>(null);

  const feeds = getParentFeed();
  const selectedFeed = useMemo(() => {
    if (childFromQuery) {
      return feeds.find((item) => item.child.id === childFromQuery) ?? feeds[0];
    }
    return feeds[0];
  }, [childFromQuery, feeds]);

  useEffect(() => {
    const nextPreset = resolveParentStoryBookStylePreset(presetFromQuery);
    setSelectedPreset((currentPreset) =>
      currentPreset === nextPreset ? currentPreset : nextPreset
    );
  }, [presetFromQuery]);

  useEffect(() => {
    storyRef.current = story;
  }, [story]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    if (selectedPreset === DEFAULT_PARENT_STORYBOOK_STYLE_PRESET) {
      url.searchParams.delete("preset");
    } else {
      url.searchParams.set("preset", selectedPreset);
    }
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [selectedPreset]);

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
      stylePreset: selectedPreset,
    });
  }, [
    getChildInterventionCard,
    getLatestConsultationForChild,
    guardianFeedbacks,
    growthRecords,
    healthCheckRecords,
    mealRecords,
    selectedFeed,
    selectedPreset,
    taskCheckInRecords,
  ]);

  const cacheKey = useMemo(() => {
    if (!request) return null;
    return buildParentStoryBookCacheKey(request, selectedPreset);
  }, [request, selectedPreset]);

  useEffect(() => {
    if (!request || !cacheKey) {
      setStatus("error");
      setStory(null);
      setErrorMessage("No child data is available for storybook generation.");
      setRefreshMessage(null);
      setIsRefreshing(false);
      setCacheState({ kind: "none" });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const bypassCache = networkOnlyRef.current;
    const resolvedCacheKey = cacheKey;
    networkOnlyRef.current = false;

    if (!bypassCache) {
      const cached = readParentStoryBookCache(resolvedCacheKey);
      if (cached) {
        startTransition(() => {
          setStory(cached.story);
          setStatus(cached.story.mode);
          setErrorMessage(null);
          setRefreshMessage(null);
          setIsRefreshing(false);
          setCacheState({
            kind: "hit",
            savedAt: cached.savedAt,
          });
        });
        return () => {
          cancelled = true;
          controller.abort();
        };
      }
    }

    setErrorMessage(null);
    setRefreshMessage(null);
    setCacheState({ kind: "none" });
    setIsRefreshing(Boolean(storyRef.current));
    if (!storyRef.current) {
      setStatus("loading");
    }

    async function loadStory() {
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

        const persisted = writeParentStoryBookCache(
          resolvedCacheKey,
          selectedPreset,
          data
        );
        startTransition(() => {
          setStory(data);
          setStatus(data.mode);
          setErrorMessage(null);
          setRefreshMessage(null);
          setIsRefreshing(false);
          setCacheState(
            persisted
              ? {
                  kind: "saved",
                  savedAt: persisted.savedAt,
                }
              : { kind: "none" }
          );
        });
      } catch (error) {
        if (cancelled) return;

        startTransition(() => {
          const nextMessage =
            error instanceof Error
              ? error.message
              : "Storybook generation failed.";

          if (storyRef.current) {
            setRefreshMessage(
              `Refresh failed, keeping previous story: ${nextMessage}`
            );
            setIsRefreshing(false);
          } else {
            setStory(null);
            setStatus("error");
            setErrorMessage(nextMessage);
          }

          setCacheState({ kind: "none" });
        });
      }
    }

    void loadStory();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [cacheKey, reloadToken, request, selectedPreset]);

  return (
    <StoryBookViewer
      status={status}
      story={story}
      errorMessage={errorMessage}
      refreshMessage={refreshMessage}
      isRefreshing={isRefreshing}
      cacheState={cacheState}
      selectedPresetId={selectedPreset}
      onSelectPreset={(presetId) => {
        startTransition(() => {
          setSelectedPreset(presetId);
        });
      }}
      onRetry={() => {
        networkOnlyRef.current = true;
        setReloadToken((previousToken) => previousToken + 1);
      }}
    />
  );
}
