import assert from "node:assert/strict";
import test from "node:test";

import { buildActionizedWeeklyReportResponse, resolveWeeklyReportRole } from "./weekly-report.ts";
import type { WeeklyReportPayload, WeeklyReportRole, WeeklyReportSnapshot } from "./types.ts";

function createSnapshot(role: WeeklyReportRole | string): WeeklyReportSnapshot {
  return {
    institutionName: "Demo Institution",
    periodLabel: "last 7 days",
    role,
    overview: {
      visibleChildren: 18,
      attendanceRate: 92,
      mealRecordCount: 32,
      healthAbnormalCount: 2,
      growthAttentionCount: 3,
      pendingReviewCount: 2,
      feedbackCount: 5,
    },
    diet: {
      balancedRate: 78,
      hydrationAvg: 155,
      monotonyDays: 1,
      vegetableDays: 4,
      proteinDays: 5,
    },
    topAttentionChildren: [
      {
        childName: "Anan",
        attentionCount: 2,
        hydrationAvg: 120,
        vegetableDays: 2,
      },
    ],
    highlights: ["weekly records stayed consistent"],
    risks: ["pending review items need a Monday cleanup"],
  };
}

test("weekly-report resolves explicit role before legacy snapshot role", () => {
  const payload: WeeklyReportPayload = {
    role: "parent",
    snapshot: createSnapshot("admin"),
  };

  assert.equal(resolveWeeklyReportRole(payload), "parent");
});

test("weekly-report normalizes legacy snapshot role labels", () => {
  assert.equal(resolveWeeklyReportRole({ snapshot: createSnapshot("teacher class weekly") }), "teacher");
  assert.equal(resolveWeeklyReportRole({ snapshot: createSnapshot("admin ops") }), "admin");
  assert.equal(resolveWeeklyReportRole({ snapshot: createSnapshot("parent weekly") }), "parent");
});

test("weekly-report actionized builder emits teacher sections and keeps legacy fields", () => {
  const report = buildActionizedWeeklyReportResponse({
    role: "teacher",
    snapshot: createSnapshot("teacher"),
    summary: "teacher weekly summary",
    highlights: ["weekly records stayed consistent"],
    risks: ["pending review items need a Monday cleanup"],
    nextWeekActions: ["review abnormal checks and pending reviews on Monday"],
    trendPrediction: "stable",
    disclaimer: "demo boundary only",
    source: "mock",
  });

  assert.equal(report.schemaVersion, "v2-actionized");
  assert.equal(report.role, "teacher");
  assert.deepEqual(
    report.sections.map((section) => section.id),
    ["weeklyAnomalies", "makeUpItems", "nextWeekObservationFocus"]
  );
  assert.equal(report.nextWeekActions[0], "review abnormal checks and pending reviews on Monday");
  assert.equal(report.primaryAction?.ownerRole, "teacher");
});

test("weekly-report actionized builder emits admin sections", () => {
  const report = buildActionizedWeeklyReportResponse({
    role: "admin",
    snapshot: createSnapshot("admin"),
    summary: "admin weekly summary",
    highlights: ["priority roster is ready"],
    risks: ["evening feedback coverage is still weak"],
    nextWeekActions: ["sort high-risk follow-up order on Monday", "track parent feedback completion as a fixed metric"],
    trendPrediction: "up",
    disclaimer: "demo boundary only",
    source: "fallback",
  });

  assert.deepEqual(
    report.sections.map((section) => section.id),
    ["highRiskClosureRate", "parentFeedbackRate", "classIssueHeat", "nextWeekGovernanceFocus"]
  );
  assert.equal(report.primaryAction?.ownerRole, "admin");
});

test("weekly-report actionized builder emits parent sections", () => {
  const report = buildActionizedWeeklyReportResponse({
    role: "parent",
    snapshot: createSnapshot("parent"),
    summary: "parent weekly summary",
    highlights: ["sleep rhythm looked steadier this week"],
    risks: ["an evening home update is still missing"],
    nextWeekActions: ["keep just one home action for next week"],
    trendPrediction: "down",
    disclaimer: "demo boundary only",
    source: "mock",
  });

  assert.deepEqual(
    report.sections.map((section) => section.id),
    ["weeklyChanges", "topHomeAction", "feedbackNeeded"]
  );
  assert.equal(report.primaryAction?.ownerRole, "parent");
});
