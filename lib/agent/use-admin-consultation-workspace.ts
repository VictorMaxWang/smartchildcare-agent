"use client";

import { useCallback, useMemo, useState } from "react";
import type { ConsultationResult } from "@/lib/ai/types";
import {
  buildAdminConsultationPriorityItems,
  type AdminConsultationChildMeta,
  type AdminConsultationPriorityItem,
} from "@/lib/agent/admin-consultation";
import type { AdminDispatchCreatePayload, AdminDispatchEvent } from "@/lib/agent/admin-types";
import {
  useAdminWorkspaceLoader,
  type UseAdminWorkspaceLoaderOptions,
} from "@/lib/agent/use-admin-workspace-loader";
import type {
  AdminConsultationFeedState,
  AdminConsultationFeedStatus,
  UseAdminConsultationFeedOptions,
} from "@/lib/agent/use-admin-consultation-feed";

export interface AdminConsultationFeedBadge {
  label: string;
  variant: "success" | "warning" | "outline";
}

export interface AdminConsultationWorkspaceView {
  priorityItems: AdminConsultationPriorityItem[];
  feedStatus: AdminConsultationFeedStatus;
  feedBadge: AdminConsultationFeedBadge;
}

export interface UseAdminConsultationWorkspaceOptions {
  institutionName: string;
  visibleChildren: AdminConsultationChildMeta[];
  localConsultations?: ConsultationResult[];
  consultationFeedOptions?: Omit<UseAdminConsultationFeedOptions, "enabled">;
}

function createDefaultFeedBadge(): AdminConsultationFeedBadge {
  return {
    label: "loading feed",
    variant: "outline",
  };
}

export function getAdminConsultationFeedBadge(params: {
  feedStatus: AdminConsultationFeedStatus;
  localConsultationCount: number;
}): AdminConsultationFeedBadge {
  if (params.feedStatus === "ready") {
    return {
      label: "backend feed",
      variant: "success",
    };
  }

  if (params.feedStatus === "unavailable" && params.localConsultationCount > 0) {
    return {
      label: "local fallback",
      variant: "outline",
    };
  }

  if (params.feedStatus === "unavailable") {
    return {
      label: "feed unavailable",
      variant: "warning",
    };
  }

  return createDefaultFeedBadge();
}

export function buildAdminConsultationWorkspaceView(params: {
  institutionName: string;
  children: AdminConsultationChildMeta[];
  consultationFeed: AdminConsultationFeedState;
  localConsultations?: ConsultationResult[];
  notificationEvents?: AdminDispatchEvent[];
  limit?: number;
}): AdminConsultationWorkspaceView {
  const localConsultations = params.localConsultations ?? [];

  return {
    priorityItems: buildAdminConsultationPriorityItems({
      institutionName: params.institutionName,
      feedItems:
        params.consultationFeed.status === "ready"
          ? params.consultationFeed.items
          : undefined,
      localConsultations,
      children: params.children,
      notificationEvents: params.notificationEvents,
      limit: params.limit ?? 4,
      useLocalFallback: params.consultationFeed.status === "unavailable",
    }),
    feedStatus: params.consultationFeed.status,
    feedBadge: getAdminConsultationFeedBadge({
      feedStatus: params.consultationFeed.status,
      localConsultationCount: localConsultations.length,
    }),
  };
}

export function useAdminConsultationWorkspace(
  options: UseAdminConsultationWorkspaceOptions
) {
  const { institutionName, visibleChildren, localConsultations = [], consultationFeedOptions } = options;
  const {
    consultationFeed,
    notificationEvents,
    notificationError: loaderNotificationError,
    notificationReady,
    upsertNotificationEvent,
  } = useAdminWorkspaceLoader({
    visibleChildrenCount: visibleChildren.length,
    consultationFeedOptions,
  } satisfies UseAdminWorkspaceLoaderOptions);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [creatingNotificationKey, setCreatingNotificationKey] = useState<string | null>(null);
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);

  const view = useMemo(
    () =>
      buildAdminConsultationWorkspaceView({
        institutionName,
        children: visibleChildren,
        consultationFeed,
        localConsultations,
        notificationEvents,
        limit: consultationFeedOptions?.limit ?? 4,
      }),
    [
      consultationFeed,
      consultationFeedOptions?.limit,
      institutionName,
      localConsultations,
      notificationEvents,
      visibleChildren,
    ]
  );

  const createNotification = useCallback(
    async (
      payload: AdminDispatchCreatePayload,
      requestKey = payload.priorityItemId || payload.targetId
    ) => {
      setCreatingNotificationKey(requestKey);
      setMutationError(null);

      try {
        const response = await fetch("/api/admin/notification-events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const data = (await response.json()) as { item?: AdminDispatchEvent; error?: string };

        if (!response.ok || !data.item) {
          setMutationError(data.error ?? "派单创建失败");
          return null;
        }

        upsertNotificationEvent(data.item);
        return data.item;
      } catch (error) {
        console.error("[ADMIN_WORKSPACE] Failed to create notification event", error);
        setMutationError("派单创建失败");
        return null;
      } finally {
        setCreatingNotificationKey(null);
      }
    },
    [upsertNotificationEvent]
  );

  const createConsultationScopedNotification = useCallback(
    async (item: AdminConsultationPriorityItem) => {
      if (!item.notificationPayload) {
        setMutationError("当前会诊缺少可创建的派单 payload");
        return null;
      }

      return createNotification(item.notificationPayload, item.consultationId);
    },
    [createNotification]
  );

  const updateNotificationStatus = useCallback(
    async (eventId: string, status: AdminDispatchEvent["status"]) => {
      setUpdatingEventId(eventId);
      setMutationError(null);

      try {
        const response = await fetch("/api/admin/notification-events", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: eventId,
            status,
          }),
        });
        const data = (await response.json()) as { item?: AdminDispatchEvent; error?: string };

        if (!response.ok || !data.item) {
          setMutationError(data.error ?? "派单状态更新失败");
          return null;
        }

        upsertNotificationEvent(data.item);
        return data.item;
      } catch (error) {
        console.error("[ADMIN_WORKSPACE] Failed to update notification event", error);
        setMutationError("派单状态更新失败");
        return null;
      } finally {
        setUpdatingEventId(null);
      }
    },
    [upsertNotificationEvent]
  );

  const isCreatingNotification = useCallback(
    (requestKey: string) => creatingNotificationKey === requestKey,
    [creatingNotificationKey]
  );

  return {
    priorityItems: view.priorityItems,
    feedStatus: view.feedStatus,
    feedBadge: view.feedBadge,
    notificationEvents,
    notificationError: mutationError ?? loaderNotificationError,
    notificationReady,
    createNotification,
    createConsultationScopedNotification,
    updateNotificationStatus,
    isCreatingNotification,
    updatingEventId,
  };
}
