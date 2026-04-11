import assert from "node:assert/strict";
import test from "node:test";

import type { AiFollowUpPayload } from "@/lib/ai/types";
import { POST } from "./route.ts";

function withEnv(
  overrides: Partial<Record<"BRAIN_API_BASE_URL", string | undefined>>,
  fn: () => void | Promise<void>
) {
  const previous = {
    BRAIN_API_BASE_URL: process.env.BRAIN_API_BASE_URL,
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

function buildPayload(): AiFollowUpPayload {
  return {
    snapshot: {
      child: {
        id: "child-1",
        name: "Ava",
      },
      summary: {
        health: {
          abnormalCount: 0,
          handMouthEyeAbnormalCount: 0,
          moodKeywords: [],
        },
        meals: {
          recordCount: 1,
          hydrationAvg: 220,
          balancedRate: 80,
          monotonyDays: 0,
          allergyRiskCount: 0,
        },
        growth: {
          recordCount: 1,
          attentionCount: 1,
          pendingReviewCount: 1,
          topCategories: [],
        },
        feedback: {
          count: 1,
          statusCounts: { partial: 1 },
          keywords: ["sleep"],
        },
      },
      recentDetails: {
        health: [],
        meals: [],
        growth: [],
        feedback: [],
      },
      ruleFallback: [
        {
          id: "rule-1",
          title: "Sleep support",
          description: "Keep the bedtime routine stable tonight.",
          level: "warning",
        },
      ],
    },
    suggestionTitle: "Sleep support",
    question: "What should the parent do tonight?",
    latestFeedback: {
      feedbackId: "fb-structured-1",
      childId: "child-1",
      sourceRole: "parent",
      sourceChannel: "manual",
      relatedTaskId: "task-parent-1",
      relatedConsultationId: "consult-1",
      executionStatus: "partial",
      executionCount: 1,
      executorRole: "parent",
      childReaction: "accepted",
      improvementStatus: "slight_improvement",
      barriers: ["Needed one reminder"],
      notes: "The child completed the first two steps.",
      attachments: {},
      submittedAt: "2026-04-10T20:00:00.000Z",
      source: {
        kind: "structured",
        workflow: "manual",
        createdBy: "Parent Chen",
        createdByRole: "parent",
      },
      fallback: {},
    },
    currentInterventionCard: {
      id: "card-1",
      title: "Sleep support",
      tonightHomeAction: "Keep the same bedtime routine tonight.",
      observationPoints: ["Watch bedtime resistance."],
      tomorrowObservationPoint: "Check morning arrival mood.",
      reviewIn48h: "Review bedtime stability in 48 hours.",
    },
    history: [{ role: "user", content: "We tried the first half of the routine." }],
  };
}

test("follow-up route accepts structured latestFeedback and falls back locally when brain endpoints are unavailable", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.endsWith("/api/v1/agents/parent/follow-up")) {
      return new Response(JSON.stringify({ error: "not implemented" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.endsWith("/api/v1/memory/context")) {
      return new Response(JSON.stringify({ error: "memory unavailable" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }

    throw new Error(`Unexpected fetch url: ${url}`);
  }) as typeof fetch;

  try {
    await withEnv({ BRAIN_API_BASE_URL: "http://brain.example.com" }, async () => {
      const response = await POST(
        new Request("http://localhost:3000/api/ai/follow-up", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-ai-force-fallback": "1",
          },
          body: JSON.stringify(buildPayload()),
        })
      );

      const body = (await response.json()) as Record<string, unknown>;

      assert.equal(response.status, 200);
      assert.equal(typeof body.answer, "string");
      assert.notEqual((body.answer as string).length, 0);
      assert.equal(body.error, undefined);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
