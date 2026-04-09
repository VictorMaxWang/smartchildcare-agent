import type { AdminConsultationPriorityItem } from "@/lib/agent/admin-consultation";
import type { AdminDispatchEvent, AdminHomeViewModel } from "@/lib/agent/admin-types";

function containsFeaturedChildName(text: string, childNames: Set<string>) {
  for (const childName of childNames) {
    if (childName && text.includes(childName)) {
      return true;
    }
  }

  return false;
}

function isConsultationScopedEvent(
  event: AdminDispatchEvent,
  consultationIds: Set<string>,
  childIds: Set<string>
) {
  if (event.priorityItemId && consultationIds.has(event.priorityItemId)) {
    return true;
  }

  if (event.targetType === "child" && childIds.has(event.targetId)) {
    return Boolean(
      event.source?.consultationId || (event.source?.relatedConsultationIds?.length ?? 0) > 0
    );
  }

  if (event.source?.consultationId && consultationIds.has(event.source.consultationId)) {
    return true;
  }

  return Boolean(event.source?.relatedConsultationIds?.some((id) => consultationIds.has(id)));
}

function compactConsultationDispatchSummary(event: AdminDispatchEvent) {
  const nextSummary =
    event.status === "completed"
      ? "重点会诊事项已完成闭环。"
      : event.status === "in_progress"
        ? "重点会诊事项正在跟进中。"
        : "重点会诊事项待派发跟进。";

  return {
    ...event,
    summary: nextSummary,
  } satisfies AdminDispatchEvent;
}

export function dedupeAdminHomeExposure(
  home: AdminHomeViewModel,
  consultationPriorityItems: AdminConsultationPriorityItem[]
) {
  if (consultationPriorityItems.length === 0) {
    return home;
  }

  const featuredChildIds = new Set(consultationPriorityItems.map((item) => item.childId));
  const featuredChildNames = new Set(
    consultationPriorityItems.map((item) => item.decision.childName)
  );
  const featuredConsultationIds = new Set(
    consultationPriorityItems.map((item) => item.consultationId)
  );

  const priorityTopItems = home.priorityTopItems
    .filter((item) => !(item.targetType === "child" && featuredChildIds.has(item.targetId)))
    .slice(0, 3);

  const riskChildren = home.riskChildren
    .filter((item) => !featuredChildIds.has(item.childId))
    .slice(0, 4);

  const weeklyHighlights = home.weeklyHighlights
    .filter((item) => !containsFeaturedChildName(item, featuredChildNames))
    .slice(0, 4);

  const pendingDispatches = home.pendingDispatches
    .map((event) =>
      isConsultationScopedEvent(event, featuredConsultationIds, featuredChildIds)
        ? compactConsultationDispatchSummary(event)
        : event
    )
    .slice(0, 4);

  return {
    ...home,
    priorityTopItems,
    riskChildren,
    weeklyHighlights:
      weeklyHighlights.length > 0 ? weeklyHighlights : home.weeklyHighlights.slice(0, 4),
    pendingDispatches,
  } satisfies AdminHomeViewModel;
}
