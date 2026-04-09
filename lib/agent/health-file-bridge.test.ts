import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHealthFileBridgeResponse,
  isValidHealthFileBridgeRequest,
} from "./health-file-bridge.ts";

test("health-file-bridge helper returns complete skeleton output for metadata-only files", () => {
  const request = {
    childId: "child-1",
    sourceRole: "teacher",
    files: [
      {
        fileId: "file-1",
        name: "external-health-note.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
      },
    ],
    requestSource: "unit-test",
  } as const;

  assert.equal(isValidHealthFileBridgeRequest(request), true);

  const result = buildHealthFileBridgeResponse(request, {
    source: "next-local-rule",
    fallback: true,
    mock: true,
    liveReadyButNotVerified: true,
  });

  assert.equal(result.source, "next-local-rule");
  assert.equal(result.fallback, true);
  assert.equal(result.mock, true);
  assert.equal(result.liveReadyButNotVerified, true);
  assert.ok(result.disclaimer.includes("T7 skeleton"));
  assert.ok(result.extractedFacts.length >= 3);
  assert.equal(result.riskItems[0]?.title, "Need manual interpretation by teacher");
  assert.ok(result.schoolTodayActions.length > 0);
  assert.ok(result.familyTonightActions.length > 0);
  assert.ok(result.followUpPlan.length > 0);
  assert.equal(result.writebackSuggestion.status, "placeholder");
});

test("health-file-bridge helper promotes fever and medication cues into bridge actions", () => {
  const request = {
    childId: "child-2",
    sourceRole: "parent",
    fileKind: "prescription",
    files: [
      {
        fileId: "file-2",
        name: "recheck-slip.png",
        mimeType: "image/png",
        sizeBytes: 4096,
        previewText: "发热 38.1，明早复查，继续雾化",
      },
    ],
    requestSource: "unit-test",
    optionalNotes: "家长补充：有过敏史，今天仍在用药。",
  } as const;

  const result = buildHealthFileBridgeResponse(request, {
    source: "next-local-rule",
    fallback: true,
    mock: true,
    liveReadyButNotVerified: true,
  });

  const riskTitles = result.riskItems.map((item) => item.title);
  const factLabels = result.extractedFacts.map((item) => item.label);
  const schoolActions = result.schoolTodayActions.map((item) => item.title);

  assert.ok(riskTitles.includes("Need teacher review before routine care"));
  assert.ok(riskTitles.includes("Need same-day health recheck in daycare"));
  assert.ok(factLabels.includes("Allergy or medication signal"));
  assert.ok(factLabels.includes("Temperature signal"));
  assert.ok(schoolActions.includes("Review allergy or medication instructions with the care team"));
  assert.equal(result.escalationSuggestion.level, "school-health-review");
  assert.equal(result.escalationSuggestion.shouldEscalate, true);
});
