"use client";

import { useCallback, useEffect, useState } from "react";
import type { AdminDispatchEvent } from "@/lib/agent/admin-types";
import {
  useAdminConsultationFeed,
  type UseAdminConsultationFeedOptions,
} from "@/lib/agent/use-admin-consultation-feed";

const INITIAL_NOTIFICATION_EVENTS: AdminDispatchEvent[] = [];

const STATUS_RANK: Record<AdminDispatchEvent["status"], number> = {
  pending: 0,
  in_progress: 1,
  completed: 2,
};

export interface UseAdminWorkspaceLoaderOptions {
  visibleChildrenCount: number;
  consultationFeedOptions?: Omit<UseAdminConsultationFeedOptions, "enabled">;
}

export function shouldEnableAdminConsultationFeed(params: {
  visibleChildrenCount: number;
  notificationReady?: boolean;
}) {
  return params.visibleChildrenCount > 0;
}

export function sortAdminNotificationEvents(events: AdminDispatchEvent[]) {
  return [...events].sort((left, right) => {
    const statusDiff = STATUS_RANK[left.status] - STATUS_RANK[right.status];
    if (statusDiff !== 0) return statusDiff;
    if (right.priorityScore !== left.priorityScore) {
      return right.priorityScore - left.priorityScore;
    }
    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

export function upsertAdminNotificationEvent(
  events: AdminDispatchEvent[],
  nextEvent: AdminDispatchEvent
) {
  return sortAdminNotificationEvents([
    nextEvent,
    ...events.filter((event) => event.id !== nextEvent.id),
  ]);
}

function mergeAdminNotificationEvents(
  currentEvents: AdminDispatchEvent[],
  incomingEvents: AdminDispatchEvent[]
) {
  return incomingEvents.reduce(
    (result, event) => upsertAdminNotificationEvent(result, event),
    currentEvents
  );
}

export function useAdminWorkspaceLoader(
  options: UseAdminWorkspaceLoaderOptions
) {
  const { visibleChildrenCount, consultationFeedOptions } = options;
  const consultationFeed = useAdminConsultationFeed({
    ...consultationFeedOptions,
    enabled: shouldEnableAdminConsultationFeed({
      visibleChildrenCount,
      notificationReady: false,
    }),
  });
  const [notificationEvents, setNotificationEvents] =
    useState<AdminDispatchEvent[]>(INITIAL_NOTIFICATION_EVENTS);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [notificationReady, setNotificationReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadNotificationEvents() {
      try {
        const response = await fetch("/api/admin/notification-events", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          items?: AdminDispatchEvent[];
          error?: string;
        };

        if (cancelled) return;

        if (!response.ok) {
          setNotificationError(payload.error ?? "通知事件加载失败");
          setNotificationReady(true);
          return;
        }

        setNotificationEvents((previous) =>
          mergeAdminNotificationEvents(previous, payload.items ?? [])
        );
        setNotificationError(null);
        setNotificationReady(true);
      } catch (error) {
        if (cancelled) return;
        console.error("[ADMIN_WORKSPACE] Failed to load notification events", error);
        setNotificationError("通知事件加载失败");
        setNotificationReady(true);
      }
    }

    void loadNotificationEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  const upsertNotificationEvent = useCallback((nextEvent: AdminDispatchEvent) => {
    setNotificationEvents((previous) =>
      upsertAdminNotificationEvent(previous, nextEvent)
    );
    setNotificationError(null);
    setNotificationReady(true);
  }, []);

  return {
    consultationFeed,
    notificationEvents,
    notificationError,
    notificationReady,
    upsertNotificationEvent,
  };
}
