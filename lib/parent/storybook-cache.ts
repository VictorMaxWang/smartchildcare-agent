import type {
  ParentStoryBookRequest,
  ParentStoryBookResponse,
  ParentStoryBookStylePreset,
} from "@/lib/ai/types";
import { stableStorybookHash } from "./storybook-presets";

const STORYBOOK_CACHE_PREFIX = "smartchildcare:parent-storybook";
export const STORYBOOK_CACHE_TTL_MS = 15 * 60 * 1000;

export interface ParentStoryBookClientCacheState {
  kind: "none" | "hit" | "saved";
  savedAt?: number;
}

interface ParentStoryBookClientCacheEntry {
  savedAt: number;
  presetId: ParentStoryBookStylePreset;
  story: ParentStoryBookResponse;
}

export function buildParentStoryBookCacheKey(
  request: ParentStoryBookRequest,
  presetId: ParentStoryBookStylePreset
) {
  const seed = JSON.stringify({
    childId: request.childId,
    requestSource: request.requestSource,
    storyMode: request.storyMode,
    generationMode: request.generationMode,
    manualTheme: request.manualTheme,
    manualPrompt: request.manualPrompt,
    pageCount: request.pageCount,
    goalKeywords: request.goalKeywords,
    protagonistArchetype: request.protagonistArchetype,
    stylePreset: presetId,
    styleMode: request.styleMode,
    customStylePrompt: request.customStylePrompt,
    customStyleNegativePrompt: request.customStyleNegativePrompt,
    stylePrompt: request.stylePrompt,
    snapshot: request.snapshot,
    highlightCandidates: request.highlightCandidates,
  });
  return `${STORYBOOK_CACHE_PREFIX}:${stableStorybookHash(seed)}`;
}

export function shouldPersistParentStoryBook(
  story: ParentStoryBookResponse | null | undefined
) {
  if (!story) return false;
  if (story.providerMeta.realProvider) return true;
  return story.scenes.some(
    (scene) =>
      scene.imageStatus === "ready" || scene.audioStatus === "ready"
  );
}

export function readParentStoryBookCache(cacheKey: string) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(cacheKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ParentStoryBookClientCacheEntry;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.savedAt !== "number" ||
      !parsed.story
    ) {
      window.sessionStorage.removeItem(cacheKey);
      return null;
    }

    if (Date.now() - parsed.savedAt > STORYBOOK_CACHE_TTL_MS) {
      window.sessionStorage.removeItem(cacheKey);
      return null;
    }

    return parsed;
  } catch {
    window.sessionStorage.removeItem(cacheKey);
    return null;
  }
}

export function writeParentStoryBookCache(
  cacheKey: string,
  presetId: ParentStoryBookStylePreset,
  story: ParentStoryBookResponse
) {
  if (typeof window === "undefined") return null;
  if (!shouldPersistParentStoryBook(story)) return null;

  const entry: ParentStoryBookClientCacheEntry = {
    savedAt: Date.now(),
    presetId,
    story,
  };

  try {
    window.sessionStorage.setItem(cacheKey, JSON.stringify(entry));
    return entry;
  } catch {
    return null;
  }
}

export function clearParentStoryBookCache(cacheKey: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(cacheKey);
}
