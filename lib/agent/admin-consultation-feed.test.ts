import assert from "node:assert/strict";
import test from "node:test";

import type { ConsultationResult } from "@/lib/ai/types";
import type { AdminDispatchEvent } from "@/lib/agent/admin-types";
import {
  buildAdminConsultationPriorityItems,
  normalizeAdminConsultationFeedItem,
} from "./admin-consultation.ts";

function buildLocalConsultation(
  overrides: Partial<ConsultationResult> = {}
): ConsultationResult {
  return {
    consultationId: "consult-1",
    triggerReason: "连续两天情绪波动",
    triggerType: ["health-abnormal"],
    triggerReasons: ["连续两天情绪波动", "晨检备注出现异常"],
    participants: [
      { id: "health", label: "Health Agent", role: "health" },
      { id: "parent", label: "Parent Agent", role: "parent" },
    ],
    childId: "child-1",
    riskLevel: "high",
    agentFindings: [
      {
        agent: "health",
        summary: "晨检情绪偏低",
        riskLevel: "high",
        evidence: ["连续两次晨检异常"],
      },
    ],
    summary: "需尽快跟进幼儿情绪与家园协同。",
    keyFindings: ["情绪波动持续", "需要家园同步观察"],
    healthAgentView: {
      summary: "晨检异常",
      evidence: ["连续两次晨检异常"],
      action: "加强晨检记录",
    },
    dietBehaviorAgentView: {
      summary: "午餐进食一般",
      evidence: ["饮水偏少"],
      action: "补充观察饮水",
    },
    parentCommunicationAgentView: {
      summary: "家长反馈延迟",
      evidence: ["连续两天未反馈"],
      action: "发送简短回访",
    },
    inSchoolActionAgentView: {
      summary: "园内情绪安抚",
      evidence: ["午休前哭闹"],
      action: "安排固定安抚动作",
    },
    todayInSchoolActions: ["午休前先做安抚过渡"],
    tonightAtHomeActions: ["晚间记录入睡前情绪变化"],
    followUp48h: ["48 小时内复盘情绪和家长反馈"],
    parentMessageDraft: "今晚请先关注孩子入睡前情绪。",
    directorDecisionCard: {
      status: "pending",
      reason: "需要园长确认家园协同动作",
      recommendedOwnerRole: "admin",
      recommendedOwnerName: "陈园长",
      recommendedAt: "2026-04-07T12:30:00.000Z",
    },
    explainability: [
      { label: "关键发现", detail: "连续两次晨检异常" },
      { label: "协调结论", detail: "需要园长牵头同步老师和家长" },
    ],
    nextCheckpoints: ["明早回看情绪状态"],
    coordinatorSummary: {
      finalConclusion: "建议园长在今日午间前确认跟进人。",
      riskLevel: "high",
      problemDefinition: "情绪波动需尽快协调",
      schoolAction: "加强园内观察",
      homeAction: "家长晚间反馈",
      observationPoints: ["入园情绪", "午休情况"],
      reviewIn48h: "48 小时后复查",
      shouldEscalateToAdmin: true,
    },
    schoolAction: "加强园内观察",
    homeAction: "家长晚间反馈",
    observationPoints: ["入园情绪", "午休情况"],
    reviewIn48h: "48 小时后复查",
    shouldEscalateToAdmin: true,
    continuityNotes: ["过去一周有类似波动"],
    memoryMeta: {
      backend: "memory",
      degraded: false,
      usedSources: ["snapshot"],
      errors: [],
      matchedSnapshotIds: ["snap-1"],
      matchedTraceIds: ["trace-1"],
    },
    source: "vivo",
    provider: "vivo",
    model: "BlueLM",
    providerTrace: {
      provider: "vivo",
      model: "BlueLM",
      realProvider: true,
      transport: "fastapi-brain",
    },
    traceMeta: {
      agentParticipants: ["Health Agent", "Parent Agent"],
      keyFindings: ["情绪波动持续"],
      coordinationConclusion: "需要园长牵头同步老师和家长",
    },
    realProvider: true,
    fallback: false,
    generatedAt: "2026-04-07T10:00:00.000Z",
    ...overrides,
  };
}

function buildNotificationEvent(
  overrides: Partial<AdminDispatchEvent> = {}
): AdminDispatchEvent {
  return {
    id: "event-1",
    institutionId: "inst-1",
    eventType: "admin-focus",
    status: "in_progress",
    priorityItemId: "consult-1",
    title: "跟进高风险会诊",
    summary: "请园长协调老师与家长。",
    targetType: "child",
    targetId: "child-1",
    targetName: "安安",
    priorityLevel: "P1",
    priorityScore: 95,
    recommendedOwnerRole: "admin",
    recommendedOwnerName: "王园长",
    recommendedAction: "确认协同安排",
    recommendedDeadline: "2026-04-07T13:00:00.000Z",
    reasonText: "高风险会诊升级",
    evidence: [{ label: "risk", value: "high", weight: 1 }],
    source: {
      institutionName: "SmartChildcare",
      workflow: "daily-priority",
      relatedChildIds: ["child-1"],
      relatedClassNames: ["向日葵班"],
    },
    createdBy: "system",
    updatedBy: "system",
    createdAt: "2026-04-07T10:30:00.000Z",
    updatedAt: "2026-04-07T10:35:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

test("normalizeAdminConsultationFeedItem keeps valid feed payloads and rejects malformed history", () => {
  const valid = normalizeAdminConsultationFeedItem({
    consultationId: "consult-1",
    childId: "child-1",
    generatedAt: "2026-04-07T10:00:00.000Z",
    riskLevel: "high",
    triggerReason: "连续两天情绪波动",
    triggerReasons: ["连续两天情绪波动"],
    summary: "需尽快跟进幼儿情绪与家园协同。",
    directorDecisionCard: {
      status: "pending",
      recommendedOwnerName: "陈园长",
      recommendedOwnerRole: "admin",
      recommendedAt: "2026-04-07T12:30:00.000Z",
    },
    status: "pending",
    ownerName: "陈园长",
    ownerRole: "admin",
    dueAt: "2026-04-07T12:30:00.000Z",
    shouldEscalateToAdmin: true,
  });

  assert.ok(valid);
  assert.equal(valid?.consultationId, "consult-1");
  assert.equal(
    normalizeAdminConsultationFeedItem({
      childId: "child-1",
      riskLevel: "high",
    }),
    null
  );
});

test("buildAdminConsultationPriorityItems prefers backend feed and overlays dispatch status owner and dueAt", () => {
  const items = buildAdminConsultationPriorityItems({
    feedItems: [
      {
        consultationId: "consult-1",
        childId: "child-1",
        generatedAt: "2026-04-07T10:00:00.000Z",
        riskLevel: "high",
        triggerReason: "连续两天情绪波动",
        triggerReasons: ["连续两天情绪波动", "晨检备注出现异常"],
        summary: "需尽快跟进幼儿情绪与家园协同。",
        directorDecisionCard: {
          status: "pending",
          reason: "需要园长确认家园协同动作",
          recommendedOwnerName: "陈园长",
          recommendedOwnerRole: "admin",
          recommendedAt: "2026-04-07T12:30:00.000Z",
        },
        status: "pending",
        ownerName: "陈园长",
        ownerRole: "admin",
        dueAt: "2026-04-07T12:30:00.000Z",
        shouldEscalateToAdmin: true,
        explainabilitySummary: {
          agentParticipants: ["Health Agent", "Parent Agent"],
          keyFindings: ["情绪波动持续", "需要家园同步观察"],
          coordinationConclusion: "需要园长牵头同步老师和家长",
          evidenceHighlights: ["晨检: 连续两次异常"],
        },
        providerTraceSummary: {
          provider: "vivo",
          model: "BlueLM",
          realProvider: true,
        },
        memoryMetaSummary: {
          backend: "memory",
          degraded: false,
          usedSources: ["snapshot"],
          errors: [],
          matchedSnapshotIds: ["snap-1"],
          matchedTraceIds: ["trace-1"],
        },
      },
    ],
    localConsultations: [buildLocalConsultation()],
    children: [{ id: "child-1", name: "安安", className: "向日葵班" }],
    notificationEvents: [buildNotificationEvent()],
    limit: 4,
  });

  assert.equal(items.length, 1);
  assert.equal(items[0]?.decision.status, "in_progress");
  assert.equal(items[0]?.decision.recommendedOwnerName, "王园长");
  assert.equal(items[0]?.trace.providerState, "real");
  assert.deepEqual(items[0]?.decision.schoolActions, ["午休前先做安抚过渡"]);
  assert.ok(items[0]?.trace.syncTargets.length);
});

test("buildAdminConsultationPriorityItems filters malformed feed rows and keeps partial rows renderable", () => {
  const items = buildAdminConsultationPriorityItems({
    feedItems: [
      {
        consultationId: "consult-2",
        childId: "child-2",
        generatedAt: "2026-04-07T09:00:00.000Z",
        riskLevel: "medium",
        summary: "需要继续观察，但暂无补充摘要字段。",
        directorDecisionCard: {},
        shouldEscalateToAdmin: true,
      },
      {
        childId: "child-3",
        riskLevel: "high",
      },
    ],
    children: [{ id: "child-2", name: "乐乐", className: "海豚班" }],
    notificationEvents: [],
    limit: 4,
  });

  assert.equal(items.length, 1);
  assert.equal(items[0]?.consultationId, "consult-2");
  assert.deepEqual(items[0]?.decision.schoolActions, []);
  assert.equal(items[0]?.trace.providerState, "unknown");
  assert.equal(items[0]?.trace.memoryState, "unknown");
  assert.deepEqual(items[0]?.trace.explainability, []);
});
