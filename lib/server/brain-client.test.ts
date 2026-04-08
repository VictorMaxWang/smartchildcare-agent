import assert from "node:assert/strict";
import test from "node:test";

import {
  brainClientInternals,
  forwardBrainRequest,
  getBrainBaseUrl,
} from "./brain-client.ts";

function withEnv(
  overrides: Partial<Record<"BRAIN_API_BASE_URL" | "NEXT_PUBLIC_BACKEND_BASE_URL" | "APP_PORT", string | undefined>>,
  fn: () => void | Promise<void>
) {
  const previous = {
    BRAIN_API_BASE_URL: process.env.BRAIN_API_BASE_URL,
    NEXT_PUBLIC_BACKEND_BASE_URL: process.env.NEXT_PUBLIC_BACKEND_BASE_URL,
    APP_PORT: process.env.APP_PORT,
  };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return Promise.resolve(fn()).finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

test("brain client normalizes configured base URLs that include /api/v1", async () => {
  await withEnv(
    {
      BRAIN_API_BASE_URL: "http://brain.example.com/api/v1/",
      NEXT_PUBLIC_BACKEND_BASE_URL: undefined,
    },
    () => {
      const details = brainClientInternals.resolveBrainBaseUrlDetails();

      assert.equal(getBrainBaseUrl(), "http://brain.example.com");
      assert.equal(details.rawBaseUrl, "http://brain.example.com/api/v1");
      assert.equal(details.normalizedBaseUrl, "http://brain.example.com");
      assert.equal(details.hadApiV1Suffix, true);
      assert.equal(details.implicitDefault, false);
    }
  );
});

test("brain client retries a 404 once with a normalized base URL", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push(url);

    if (calls.length === 1) {
      return new Response("not found", { status: 404 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await withEnv(
      {
        BRAIN_API_BASE_URL: "http://brain.example.com/api/v1",
        NEXT_PUBLIC_BACKEND_BASE_URL: undefined,
      },
      async () => {
        const request = new Request("http://localhost:3000/api/ai/parent-storybook", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ok: true }),
        });

        const result = await forwardBrainRequest(
          request,
          "/api/v1/agents/parent/storybook"
        );

        assert.equal(calls[0], "http://brain.example.com/api/v1/api/v1/agents/parent/storybook");
        assert.equal(calls[1], "http://brain.example.com/api/v1/agents/parent/storybook");
        assert.equal(result.response?.status, 200);
        assert.equal(result.fallbackReason, null);
        assert.equal(result.statusCode, null);
        assert.equal(result.retryStrategy, "normalized-base-retry");
        assert.equal(result.upstreamHost, "brain.example.com");
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("brain client returns fallback diagnostics after normalized retry still fails", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push(url);
    return new Response("missing", { status: 404 });
  }) as typeof fetch;

  try {
    await withEnv(
      {
        BRAIN_API_BASE_URL: "http://brain.example.com/api/v1/",
        NEXT_PUBLIC_BACKEND_BASE_URL: undefined,
      },
      async () => {
        const request = new Request("http://localhost:3000/api/ai/parent-storybook", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ok: true }),
        });

        const result = await forwardBrainRequest(
          request,
          "/api/v1/agents/parent/storybook"
        );

        assert.equal(calls.length, 2);
        assert.equal(result.response, null);
        assert.equal(result.fallbackReason, "brain-status-404");
        assert.equal(result.statusCode, 404);
        assert.equal(result.retryStrategy, "normalized-base-retry");
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
