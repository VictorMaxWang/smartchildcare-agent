export type TaskStatus = "pending" | "in_progress" | "completed" | "overdue";
export type TaskType = "intervention" | "follow_up";
export type TaskSourceType =
  | "intervention_card"
  | "consultation"
  | "admin_dispatch"
  | "legacy_weekly_task";
export type TaskOwnerRole = "parent" | "teacher" | "admin";
export type TaskEvidenceSubmissionMode =
  | "guardian_feedback"
  | "task_checkin"
  | "dispatch_status_update";

export interface TaskDueWindow {
  kind: "same_day" | "within_48h" | "deadline";
  label: string;
}

export interface TaskLegacyRefs {
  interventionCardId?: string;
  reminderIds?: string[];
  legacyWeeklyTaskId?: string;
  adminDispatchEventId?: string;
  consultationId?: string;
}

export interface BaseTask {
  taskId: string;
  taskType: TaskType;
  childId: string;
  sourceType: TaskSourceType;
  sourceId: string;
  ownerRole: TaskOwnerRole;
  title: string;
  description: string;
  dueWindow: TaskDueWindow;
  dueAt: string;
  status: TaskStatus;
  evidenceSubmissionMode: TaskEvidenceSubmissionMode;
  completionSummary?: string;
  createdAt: string;
  updatedAt: string;
  statusChangedAt?: string;
  completedAt?: string;
  lastEvidenceAt?: string;
  relatedTaskIds?: string[];
  legacyRefs?: TaskLegacyRefs;
}

export interface InterventionTask extends BaseTask {
  taskType: "intervention";
}

export interface FollowUpTask extends BaseTask {
  taskType: "follow_up";
}

export type CanonicalTask = InterventionTask | FollowUpTask;
