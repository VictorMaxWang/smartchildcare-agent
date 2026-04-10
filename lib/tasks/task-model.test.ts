import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAppStateSnapshot } from "@/lib/persistence/snapshot";
import {
  buildCurrentInterventionCardFromTask,
  buildInterventionTasksFromCard,
  buildReminderFromTask,
  buildTaskFromAdminDispatchEvent,
  mapReminderStatusToTaskStatus,
  materializeTasksFromLegacy,
} from "@/lib/tasks/task-model";

test("intervention card materializes into parent and teacher canonical tasks", () => {
  const card = {
    id: "card-c-1-demo",
    title: "Evening Decompression",
    targetChildId: "c-1",
    tonightHomeAction: "Keep a calm bedtime routine.",
    reviewIn48h: "Check whether tomorrow drop-off is calmer.",
    createdAt: "2026-04-10T10:00:00.000Z",
    updatedAt: "2026-04-10T10:00:00.000Z",
  };

  const { parentTask, followUpTask } = buildInterventionTasksFromCard(card, {
    legacyWeeklyTaskId: "task_001",
  });

  assert.equal(parentTask.taskType, "intervention");
  assert.equal(parentTask.ownerRole, "parent");
  assert.equal(parentTask.sourceType, "intervention_card");
  assert.equal(parentTask.legacyRefs?.legacyWeeklyTaskId, "task_001");
  assert.equal(parentTask.dueWindow.kind, "same_day");
  assert.equal(followUpTask.taskType, "follow_up");
  assert.equal(followUpTask.ownerRole, "teacher");
  assert.equal(followUpTask.dueWindow.kind, "within_48h");
  assert.deepEqual(parentTask.relatedTaskIds, [followUpTask.taskId]);
  assert.deepEqual(followUpTask.relatedTaskIds, [parentTask.taskId]);
});

test("task to reminder projection preserves canonical linkage", () => {
  const { parentTask } = buildInterventionTasksFromCard({
    id: "card-c-1-demo",
    title: "Evening Decompression",
    targetChildId: "c-1",
    tonightHomeAction: "Keep a calm bedtime routine.",
    reviewIn48h: "Check whether tomorrow drop-off is calmer.",
    createdAt: "2026-04-10T10:00:00.000Z",
    updatedAt: "2026-04-10T10:00:00.000Z",
  });

  const reminder = buildReminderFromTask({ ...parentTask, status: "in_progress" }, { childName: "Anan" });

  assert.ok(reminder);
  assert.equal(reminder?.reminderType, "family-task");
  assert.equal(reminder?.taskId, parentTask.taskId);
  assert.equal(reminder?.sourceType, "intervention_card");
  assert.equal(reminder?.status, "acknowledged");
});

test("legacy reminders, guardian feedback and check-ins reconcile into canonical task status", () => {
  const card = {
    id: "card-c-1-demo",
    title: "Evening Decompression",
    targetChildId: "c-1",
    tonightHomeAction: "Keep a calm bedtime routine.",
    reviewIn48h: "Check whether tomorrow drop-off is calmer.",
    createdAt: "2026-04-08T10:00:00.000Z",
    updatedAt: "2026-04-08T10:00:00.000Z",
  };
  const tasks = materializeTasksFromLegacy({
    interventionCards: [card],
    reminders: [
      {
        reminderId: "reminder-family",
        reminderType: "family-task",
        targetRole: "parent",
        targetId: "c-1",
        childId: "c-1",
        title: "Tonight Action",
        description: "Keep a calm bedtime routine.",
        scheduledAt: "2026-04-08T18:00:00.000Z",
        status: "acknowledged",
        sourceId: card.id,
      },
    ],
    guardianFeedbacks: [
      {
        id: "feedback-1",
        childId: "c-1",
        date: "2026-04-08T19:00:00.000Z",
        status: "今晚反馈",
        content: "The bedtime routine helped.",
        interventionCardId: card.id,
        executionStatus: "completed",
        createdBy: "Parent",
        createdByRole: "家长",
      },
    ],
    taskCheckIns: [
      {
        id: "checkin-1",
        childId: "c-1",
        taskId: "task_legacy_teacher",
        date: "2026-04-11T10:00:00.000Z",
      },
    ],
    now: "2026-04-11T12:00:00.000Z",
  });

  const parentTask = tasks.find((task) => task.ownerRole === "parent");
  const teacherTask = tasks.find((task) => task.ownerRole === "teacher");

  assert.equal(parentTask?.status, "completed");
  assert.equal(parentTask?.completionSummary, "The bedtime routine helped.");
  assert.equal(teacherTask?.status, "overdue");
});

test("task adapter builds follow-up compatible intervention card context", () => {
  const { parentTask, followUpTask } = buildInterventionTasksFromCard({
    id: "card-c-1-demo",
    title: "Evening Decompression",
    targetChildId: "c-1",
    tonightHomeAction: "Keep a calm bedtime routine.",
    reviewIn48h: "Check whether tomorrow drop-off is calmer.",
    createdAt: "2026-04-10T10:00:00.000Z",
    updatedAt: "2026-04-10T10:00:00.000Z",
  });

  const cardContext = buildCurrentInterventionCardFromTask({
    activeTask: parentTask,
    relatedTasks: [followUpTask],
  });

  assert.equal(cardContext.id, "card-c-1-demo");
  assert.equal(cardContext.tonightHomeAction, "Keep a calm bedtime routine.");
  assert.equal(cardContext.reviewIn48h, "Check whether tomorrow drop-off is calmer.");
});

test("admin dispatch events map into follow-up tasks without persisting overdue", () => {
  const task = buildTaskFromAdminDispatchEvent({
    id: "evt-1",
    institutionId: "inst-1",
    eventType: "admin-focus",
    status: "in_progress",
    title: "Admin Review",
    summary: "Review the case with the head teacher.",
    targetType: "child",
    targetId: "c-1",
    targetName: "Anan",
    priorityLevel: "P1",
    priorityScore: 90,
    recommendedOwnerRole: "admin",
    recommendedAction: "Check the follow-up execution.",
    recommendedDeadline: "2026-04-12T10:00:00.000Z",
    reasonText: "Escalation required",
    evidence: [],
    source: {
      consultationId: "consult-1",
      taskId: "task-c-1",
      sourceType: "consultation",
      sourceId: "consult-1",
      relatedTaskIds: ["task-c-1"],
    },
    createdBy: "admin-1",
    updatedBy: "admin-1",
    createdAt: "2026-04-10T10:00:00.000Z",
    updatedAt: "2026-04-10T11:00:00.000Z",
  });

  assert.equal(task.sourceType, "admin_dispatch");
  assert.equal(task.status, "in_progress");
  assert.equal(task.legacyRefs?.adminDispatchEventId, "evt-1");
});

test("snapshot normalizer backfills canonical tasks when legacy snapshots have no tasks array", () => {
  const snapshot = normalizeAppStateSnapshot({
    children: [
      {
        id: "c-1",
        name: "Anan",
      },
    ],
    attendance: [],
    meals: [],
    growth: [],
    feedback: [],
    health: [],
    taskCheckIns: [],
    interventionCards: [
      {
        id: "card-c-1-demo",
        title: "Evening Decompression",
        riskLevel: "medium",
        targetChildId: "c-1",
        triggerReason: "sleep",
        summary: "Need a calmer evening routine.",
        todayInSchoolAction: "Observe drop-off.",
        tonightHomeAction: "Keep a calm bedtime routine.",
        homeSteps: ["Keep a calm bedtime routine."],
        observationPoints: [],
        tomorrowObservationPoint: "Observe morning drop-off.",
        reviewIn48h: "Check whether tomorrow drop-off is calmer.",
        parentMessageDraft: "Parent draft",
        teacherFollowupDraft: "Teacher draft",
        source: "mock",
        createdAt: "2026-04-10T10:00:00.000Z",
        updatedAt: "2026-04-10T10:00:00.000Z",
      },
    ],
    consultations: [],
    mobileDrafts: [],
    reminders: [],
    updatedAt: "2026-04-10T10:00:00.000Z",
  });

  assert.ok(snapshot);
  assert.equal(snapshot?.tasks.length, 2);
  assert.equal(snapshot?.tasks[0].sourceType, "intervention_card");
});

test("reminder status mapping keeps snoozed tasks pending", () => {
  assert.equal(mapReminderStatusToTaskStatus("pending"), "pending");
  assert.equal(mapReminderStatusToTaskStatus("acknowledged"), "in_progress");
  assert.equal(mapReminderStatusToTaskStatus("done"), "completed");
  assert.equal(mapReminderStatusToTaskStatus("snoozed"), "pending");
});
