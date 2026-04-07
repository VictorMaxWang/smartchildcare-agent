import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  cacheParentStoryBookAudioDataUrl,
  parentStoryBookCacheInternals,
  readCachedParentStoryBookAudio,
} from "./parent-storybook-cache.ts";

const mediaRouteRoot = fileURLToPath(
  new URL("../../app/api/ai/parent-storybook/media", import.meta.url)
);

test("parent storybook media keeps a single dynamic route directory", () => {
  const dynamicRouteDirectories = fs
    .readdirSync(mediaRouteRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\[.+\]$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(dynamicRouteDirectories, ["[mediaKey]"]);
  assert.equal(
    fs.existsSync(path.join(mediaRouteRoot, "[mediaKey]", "route.ts")),
    true
  );
});

test("parent storybook media cache keeps the opaque media URL contract", () => {
  const { audioAssetCache } = parentStoryBookCacheInternals;
  audioAssetCache.clear();

  const audioUrl = cacheParentStoryBookAudioDataUrl(
    "data:audio/wav;base64,UklGRg==",
    "storybook-1:scene-1"
  );

  assert.equal(typeof audioUrl, "string");
  assert.match(
    audioUrl ?? "",
    /^\/api\/ai\/parent-storybook\/media\/[a-f0-9]+$/
  );

  const mediaKey = audioUrl?.split("/").at(-1);
  assert.ok(mediaKey);

  const cachedAudio = readCachedParentStoryBookAudio(mediaKey);
  assert.ok(cachedAudio);
  assert.equal(cachedAudio.contentType, "audio/wav");
  assert.deepEqual(
    Array.from(cachedAudio.bytes),
    Array.from(Buffer.from("UklGRg==", "base64"))
  );

  audioAssetCache.clear();
});
