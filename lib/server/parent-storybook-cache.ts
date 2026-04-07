import crypto from "node:crypto";
import type {
  BrainTransport,
} from "@/lib/server/brain-client";
import type {
  ParentStoryBookCacheMeta,
  ParentStoryBookResponse,
} from "@/lib/ai/types";

const STORYBOOK_RESPONSE_TTL_SECONDS = 12 * 60;
const STORYBOOK_MEDIA_TTL_SECONDS = 20 * 60;

type StoryBookResponseCacheEntry = {
  expiresAt: number;
  value: {
    story: ParentStoryBookResponse;
    transport: BrainTransport;
    targetPath: string;
    upstreamHost: string | null;
    fallbackReason: string | null;
  };
};

type StoryBookAudioCacheEntry = {
  expiresAt: number;
  contentType: string;
  bytes: Buffer;
};

const storyResponseCache = new Map<string, StoryBookResponseCacheEntry>();
const audioAssetCache = new Map<string, StoryBookAudioCacheEntry>();

function now() {
  return Date.now();
}

function cleanupExpired() {
  const current = now();

  for (const [key, entry] of storyResponseCache.entries()) {
    if (entry.expiresAt <= current) {
      storyResponseCache.delete(key);
    }
  }

  for (const [key, entry] of audioAssetCache.entries()) {
    if (entry.expiresAt <= current) {
      audioAssetCache.delete(key);
    }
  }
}

function cloneStory(story: ParentStoryBookResponse) {
  return JSON.parse(JSON.stringify(story)) as ParentStoryBookResponse;
}

function parseDataUrl(dataUrl: string) {
  const matched = dataUrl.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/i);
  if (!matched) return null;

  const contentType = matched[1] || "application/octet-stream";
  const encodedPayload = matched[2] || "";

  try {
    return {
      contentType,
      bytes: Buffer.from(encodedPayload, "base64"),
    };
  } catch {
    return null;
  }
}

function countRealScenes(story: ParentStoryBookResponse) {
  return story.scenes.filter(
    (scene) => scene.imageStatus === "ready" || scene.audioStatus === "ready"
  ).length;
}

function resolveAudioDelivery(story: ParentStoryBookResponse): ParentStoryBookCacheMeta["audioDelivery"] {
  const hasReadyAudio = story.scenes.some(
    (scene) => scene.audioStatus === "ready" && Boolean(scene.audioUrl)
  );

  if (!hasReadyAudio) return "preview-only";

  return "stream-url";
}

export function buildParentStoryBookRequestCacheKey(payload: unknown) {
  return crypto.createHash("sha1").update(JSON.stringify(payload)).digest("hex");
}

export function shouldCacheParentStoryBookResponse(story: ParentStoryBookResponse) {
  return countRealScenes(story) > 0;
}

export function getCachedParentStoryBookResponse(cacheKey: string) {
  cleanupExpired();
  const entry = storyResponseCache.get(cacheKey);
  if (!entry) return null;

  return {
    ...entry.value,
    story: cloneStory(entry.value.story),
  };
}

export function setCachedParentStoryBookResponse(
  cacheKey: string,
  value: StoryBookResponseCacheEntry["value"],
  ttlSeconds = STORYBOOK_RESPONSE_TTL_SECONDS
) {
  cleanupExpired();
  storyResponseCache.set(cacheKey, {
    expiresAt: now() + ttlSeconds * 1000,
    value: {
      ...value,
      story: cloneStory(value.story),
    },
  });
}

export function cacheParentStoryBookAudioDataUrl(dataUrl: string, seed: string) {
  cleanupExpired();
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  const mediaId = crypto
    .createHash("sha1")
    .update(`${seed}:${dataUrl.slice(0, 128)}:${parsed.bytes.length}`)
    .digest("hex");

  audioAssetCache.set(mediaId, {
    expiresAt: now() + STORYBOOK_MEDIA_TTL_SECONDS * 1000,
    contentType: parsed.contentType,
    bytes: parsed.bytes,
  });

  return `/api/ai/parent-storybook/media/${mediaId}`;
}

export function readCachedParentStoryBookAudio(mediaId: string) {
  cleanupExpired();
  const entry = audioAssetCache.get(mediaId);
  if (!entry) return null;

  return {
    contentType: entry.contentType,
    bytes: entry.bytes,
  };
}

export function prepareParentStoryBookResponseForDelivery(
  story: ParentStoryBookResponse,
  options: {
    cacheState: ParentStoryBookCacheMeta["storyResponse"];
    ttlSeconds?: number;
  }
) {
  const nextStory = cloneStory(story);
  let audioDelivery: ParentStoryBookCacheMeta["audioDelivery"] =
    resolveAudioDelivery(nextStory);

  nextStory.scenes = nextStory.scenes.map((scene) => {
    if (
      scene.audioStatus === "ready" &&
      typeof scene.audioUrl === "string" &&
      scene.audioUrl.startsWith("data:audio/")
    ) {
      const cachedUrl = cacheParentStoryBookAudioDataUrl(
        scene.audioUrl,
        `${nextStory.storyId}:${scene.sceneIndex}`
      );
      if (cachedUrl) {
        audioDelivery = "stream-url";
        return {
          ...scene,
          audioUrl: cachedUrl,
        };
      }
    }

    return scene;
  });

  nextStory.cacheMeta = {
    storyResponse: options.cacheState,
    audioDelivery,
    ttlSeconds: options.ttlSeconds ?? STORYBOOK_RESPONSE_TTL_SECONDS,
    realSceneCount: countRealScenes(nextStory),
  };

  return nextStory;
}

export const parentStoryBookCacheInternals = {
  storyResponseCache,
  audioAssetCache,
};
