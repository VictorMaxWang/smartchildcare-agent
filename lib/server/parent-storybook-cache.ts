import crypto from "node:crypto";
import type {
  BrainTransport,
} from "@/lib/server/brain-client";
import type {
  ParentStoryBookCacheMeta,
  ParentStoryBookProviderMeta,
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

type StoryBookMediaCacheEntry = {
  expiresAt: number;
  contentType: string;
  bytes: Buffer;
};

const storyResponseCache = new Map<string, StoryBookResponseCacheEntry>();
const mediaAssetCache = new Map<string, StoryBookMediaCacheEntry>();

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

  for (const [key, entry] of mediaAssetCache.entries()) {
    if (entry.expiresAt <= current) {
      mediaAssetCache.delete(key);
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

function resolveProviderAudioDelivery(
  story: ParentStoryBookResponse
): ParentStoryBookProviderMeta["audioDelivery"] {
  const readySceneCount = story.scenes.filter(
    (scene) => scene.audioStatus === "ready" && Boolean(scene.audioUrl)
  ).length;

  if (readySceneCount === 0) return "preview-only";
  if (readySceneCount === story.scenes.length) return "real";
  return "mixed";
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

export function cacheParentStoryBookMediaDataUrl(dataUrl: string, seed: string) {
  cleanupExpired();
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  const mediaId = crypto
    .createHash("sha1")
    .update(`${seed}:${dataUrl.slice(0, 128)}:${parsed.bytes.length}`)
    .digest("hex");

  mediaAssetCache.set(mediaId, {
    expiresAt: now() + STORYBOOK_MEDIA_TTL_SECONDS * 1000,
    contentType: parsed.contentType,
    bytes: parsed.bytes,
  });

  return `/api/ai/parent-storybook/media/${mediaId}`;
}

export function cacheParentStoryBookAudioDataUrl(dataUrl: string, seed: string) {
  return cacheParentStoryBookMediaDataUrl(dataUrl, seed);
}

export function cacheParentStoryBookSvgContent(svg: string, seed: string) {
  const encoded = Buffer.from(svg, "utf8").toString("base64");
  return cacheParentStoryBookMediaDataUrl(
    `data:image/svg+xml;base64,${encoded}`,
    seed
  );
}

export function readCachedParentStoryBookMedia(mediaId: string) {
  cleanupExpired();
  const entry = mediaAssetCache.get(mediaId);
  if (!entry) return null;

  return {
    contentType: entry.contentType,
    bytes: entry.bytes,
  };
}

export function readCachedParentStoryBookAudio(mediaId: string) {
  return readCachedParentStoryBookMedia(mediaId);
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
      const cachedUrl = cacheParentStoryBookMediaDataUrl(
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

    if (
      typeof scene.imageUrl === "string" &&
      scene.imageUrl.startsWith("data:image/svg+xml")
    ) {
      const cachedImageUrl = cacheParentStoryBookMediaDataUrl(
        scene.imageUrl,
        `${nextStory.storyId}:image:${scene.sceneIndex}`
      );
      if (cachedImageUrl) {
        return {
          ...scene,
          imageUrl: cachedImageUrl,
          assetRef: cachedImageUrl,
        };
      }
    }

    return scene;
  });

  nextStory.providerMeta = {
    ...nextStory.providerMeta,
    audioDelivery:
      nextStory.providerMeta.audioDelivery ??
      resolveProviderAudioDelivery(nextStory),
  };

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
  mediaAssetCache,
};
