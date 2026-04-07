import assert from "node:assert/strict";
import test from "node:test";

import { attachNotificationEventToResult } from "./admin-agent";
import type { AdminAgentResult, AdminDispatchEvent } from "./admin-types";

function buildResult(): AdminAgentResult {
  return {
    title: "今日机构优先事项",
    summary: "当前最值得先推动的是安安的家园协同。",
    assistantAnswer: "请先推动安安相关闭环。",
    institutionScope: {
      institutionName: "SmartChildcare",
      date: "2026-04-07",
      visibleChildren: 1,
      classCount: 1,
      attendanceRate: 100,
      healthAbnormalCount: 1,
      growthAttentionCount: 1,
      pendingReviewCount: 1,
      feedbackCount: 0,
      feedbackCompletionRate: 0,
      riskChildrenCount: 1,
      riskClassCount: 0,
      pendingDispatchCount: 0,
    },
    priorityTopItems: [],
    riskChildren: [],
    riskClasses: [],
    feedbackRiskItems: [],
    highlights: [],
    actionItems: [
      {
        id: "action-priority-child-1",
        title: "安安：需要今天完成家园协同",
        targetType: "child",
        targetId: "child-1",
        targetName: "安安",
        priorityLevel: "P1",
        ownerRole: "teacher",
        ownerLabel: "向日葵班班主任",
        action: "今天完成家园协同",
        deadline: "今日放学前",
        summary: "向日葵班班主任在今日放学前执行：今天完成家园协同",
        dispatchPayload: {
          eventType: "admin_action",
          priorityItemId: "priority-child-1",
          title: "P1｜安安",
          summary: "需要今天完成家园协同",
          targetType: "child",
          targetId: "child-1",
          targetName: "安安",
          priorityLevel: "P1",
          priorityScore: 90,
          recommendedOwnerRole: "teacher",
          recommendedOwnerName: "向日葵班班主任",
          recommendedAction: "今天完成家园协同",
          recommendedDeadline: "今日放学前",
          reasonText: "需要今天完成家园协同",
          evidence: [],
          source: {
            institutionName: "SmartChildcare",
            workflow: "daily-priority",
            relatedChildIds: ["child-1"],
            relatedClassNames: ["向日葵班"],
          },
        },
        status: "suggested",
      },
    ],
    recommendedOwnerMap: [],
    quickQuestions: [],
    notificationEvents: [],
    source: "rule",
    generatedAt: "2026-04-07T10:00:00.000Z",
  };
}

function buildConsultationScopedEvent(): AdminDispatchEvent {
  return {
    id: "event-consultation-1",
    institutionId: "inst-1",
    eventType: "admin_action",
    status: "in_progress",
    priorityItemId: "consult-1",
    title: "P1｜安安重点会诊",
    summary: "需要尽快跟进幼儿情绪与家园协同。",
    targetType: "child",
    targetId: "child-1",
    targetName: "安安",
    priorityLevel: "P1",
    priorityScore: 90,
    recommendedOwnerRole: "admin",
    recommendedOwnerName: "陈园长",
    recommendedAction: "午休前先做安抚过渡",
    recommendedDeadline: "2026-04-07T12:30:00.000Z",
    reasonText: "需要园长确认家园协同动作",
    evidence: [],
    source: {
      institutionName: "SmartChildcare",
      workflow: "daily-priority",
      relatedChildIds: ["child-1"],
      relatedClassNames: ["向日葵班"],
      consultationId: "consult-1",
      relatedConsultationIds: ["consult-1"],
    },
    createdBy: "system",
    updatedBy: "system",
    createdAt: "2026-04-07T10:30:00.000Z",
    updatedAt: "2026-04-07T10:35:00.000Z",
    completedAt: null,
  };
}

test("attachNotificationEventToResult does not bind consultation-scoped child events to generic child action items", () => {
  const result = buildResult();
  const next = attachNotificationEventToResult(result, buildConsultationScopedEvent());

  assert.equal(next.actionItems.length, 1);
  assert.equal(next.actionItems[0]?.status, "suggested");
  assert.equal(next.actionItems[0]?.relatedEventId, undefined);
  assert.equal(next.notificationEvents.length, 1);
  assert.equal(next.notificationEvents[0]?.id, "event-consultation-1");
});
