import type { ConsultationResult, ReminderItem } from "@/lib/ai/types";
import type { InterventionCard } from "@/lib/agent/intervention-card";

function createReminderId(prefix: string, targetId: string) {
  return `${prefix}-${targetId}-${Date.now()}`;
}

export function buildReminderItems(params: {
  childId: string;
  targetRole: ReminderItem["targetRole"];
  targetId: string;
  childName: string;
  interventionCard?: InterventionCard | null;
  consultation?: ConsultationResult | null;
}): ReminderItem[] {
  const scheduledAt = new Date().toISOString();
  const items: ReminderItem[] = [];

  if (params.interventionCard) {
    items.push({
      reminderId: createReminderId("task", params.targetId),
      reminderType: "family-task",
      targetRole: params.targetRole,
      targetId: params.targetId,
      childId: params.childId,
      title: `${params.childName} 今晚任务提醒`,
      description: params.interventionCard.tonightHomeAction,
      scheduledAt,
      status: "pending",
      sourceId: params.interventionCard.id,
    });

    items.push({
      reminderId: createReminderId("review", params.targetId),
      reminderType: "review-48h",
      targetRole: params.targetRole,
      targetId: params.targetId,
      childId: params.childId,
      title: `${params.childName} 48 小时复查提醒`,
      description: params.interventionCard.reviewIn48h,
      scheduledAt,
      status: "pending",
      sourceId: params.interventionCard.id,
    });
  }

  if (params.consultation?.shouldEscalateToAdmin) {
    items.push({
      reminderId: createReminderId("admin", params.targetId),
      reminderType: "admin-focus",
      targetRole: "admin",
      targetId: params.childId,
      childId: params.childId,
      title: `${params.childName} 需升级关注`,
      description: params.consultation.coordinatorSummary.finalConclusion,
      scheduledAt,
      status: "pending",
      sourceId: params.consultation.consultationId,
    });
  }

  return items;
}

export function getReminderStatusLabel(status: ReminderItem["status"]) {
  if (status === "done") return "已完成";
  if (status === "snoozed") return "稍后提醒";
  if (status === "acknowledged") return "已确认";
  return "待提醒";
}
