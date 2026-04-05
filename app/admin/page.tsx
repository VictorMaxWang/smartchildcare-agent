"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ClipboardCheck, ShieldAlert, TrendingUp, Workflow } from "lucide-react";
import RiskPriorityBoard from "@/components/admin/RiskPriorityBoard";
import EmptyState from "@/components/EmptyState";
import {
  AssistantEntryCard,
  InlineLinkButton,
  MetricGrid,
  RolePageShell,
  RoleSplitLayout,
  SectionCard,
} from "@/components/role-shell/RoleScaffold";
import { Badge } from "@/components/ui/badge";
import { buildAdminConsultationPriorityItems } from "@/lib/agent/admin-consultation";
import { buildAdminHomeViewModel } from "@/lib/agent/admin-agent";
import type { AdminDispatchEvent, InstitutionPriorityItem } from "@/lib/agent/admin-types";
import { INSTITUTION_NAME, useApp } from "@/lib/store";

const TODAY_TEXT = new Date().toLocaleDateString("zh-CN", {
  month: "long",
  day: "numeric",
  weekday: "long",
});

function PriorityLevelBadge({ level }: { level: InstitutionPriorityItem["priorityLevel"] }) {
  if (level === "P1") return <Badge variant="warning">P1</Badge>;
  if (level === "P2") return <Badge variant="info">P2</Badge>;
  return <Badge variant="secondary">P3</Badge>;
}

function EventStatusBadge({ status }: { status: AdminDispatchEvent["status"] }) {
  if (status === "completed") return <Badge variant="success">已完成</Badge>;
  if (status === "in_progress") return <Badge variant="info">处理中</Badge>;
  return <Badge variant="outline">待派发</Badge>;
}

export default function AdminHomePage() {
  const {
    currentUser,
    visibleChildren,
    attendanceRecords,
    healthCheckRecords,
    growthRecords,
    guardianFeedbacks,
    mealRecords,
    getAdminBoardData,
    getWeeklyDietTrend,
    getSmartInsights,
    getLatestConsultations,
  } = useApp();
  const [notificationEvents, setNotificationEvents] = useState<AdminDispatchEvent[]>([]);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const latestConsultations = getLatestConsultations();

  useEffect(() => {
    let cancelled = false;

    async function loadNotificationEvents() {
      try {
        const response = await fetch("/api/admin/notification-events", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        const result = (await response.json()) as {
          items?: AdminDispatchEvent[];
          error?: string;
        };

        if (cancelled) return;

        if (!response.ok) {
          setNotificationEvents([]);
          setNotificationError(result.error ?? "通知事件加载失败");
          return;
        }

        setNotificationEvents(result.items ?? []);
        setNotificationError(null);
      } catch (error) {
        if (cancelled) return;
        console.error("[ADMIN_HOME] Failed to load notification events", error);
        setNotificationEvents([]);
        setNotificationError("通知事件加载失败");
      }
    }

    void loadNotificationEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  const home = useMemo(
    () =>
      buildAdminHomeViewModel({
        workflow: "daily-priority",
        currentUser: {
          name: currentUser.name,
          institutionName: INSTITUTION_NAME,
          institutionId: currentUser.institutionId,
          role: currentUser.role,
        },
        visibleChildren,
        attendanceRecords,
        healthCheckRecords,
        growthRecords,
        guardianFeedbacks,
        mealRecords,
        adminBoardData: getAdminBoardData(),
        weeklyTrend: getWeeklyDietTrend(),
        smartInsights: getSmartInsights(),
        notificationEvents,
      }),
    [
      attendanceRecords,
      currentUser.institutionId,
      currentUser.name,
      currentUser.role,
      getAdminBoardData,
      getSmartInsights,
      getWeeklyDietTrend,
      growthRecords,
      guardianFeedbacks,
      healthCheckRecords,
      mealRecords,
      notificationEvents,
      visibleChildren,
    ]
  );
  const consultationPriorityItems = useMemo(
    () =>
      buildAdminConsultationPriorityItems({
        consultations: latestConsultations,
        children: visibleChildren.map((child) => ({
          id: child.id,
          name: child.name,
          className: child.className,
        })),
        notificationEvents,
        limit: 4,
      }),
    [latestConsultations, notificationEvents, visibleChildren]
  );

  if (visibleChildren.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <EmptyState
          icon={<ShieldAlert className="h-6 w-6" />}
          title="当前园长账号还没有可展示的机构数据"
          description="请先使用示例园长账号，或为机构管理员账号初始化机构级数据。"
        />
      </div>
    );
  }

  return (
    <RolePageShell
      badge={`园长首页 · ${INSTITUTION_NAME} · ${TODAY_TEXT}`}
      title="先看机构级优先级，再决定今天最该推动什么"
      description="首页不再只是看统计，而是把今日机构优先事项、重点风险儿童、班级闭环问题和待处理派单直接放到首屏。"
      actions={
        <>
          <InlineLinkButton href="/admin/agent" label="进入园长 Agent" variant="premium" />
          <InlineLinkButton href="/admin/agent?action=weekly-report" label="生成本周运营周报" />
        </>
      }
    >
      <RoleSplitLayout
        main={
          <div className="space-y-6">
            <MetricGrid
              items={home.heroStats.map((item, index) => ({
                ...item,
                tone: index === 0 ? "amber" : index === 1 ? "sky" : index === 2 ? "emerald" : "indigo",
              }))}
            />

            <SectionCard
              title="今日重点会诊 / 高风险优先事项"
              description="把教师发起的一键会诊直接升级成园长今天最该盯的决策区，适合移动端录屏和答辩展示。"
              actions={<Badge variant="warning">AI 园长办公会</Badge>}
            >
              <RiskPriorityBoard items={consultationPriorityItems} />
            </SectionCard>

            <SectionCard
              title="今日机构优先级 TOP 3"
              description="先展示最该盯的三件事，移动端首屏优先显示这里。"
              actions={<Badge variant="warning">机构级排序</Badge>}
            >
              <div className="grid gap-4 md:grid-cols-3">
                {home.priorityTopItems.map((item) => (
                  <div key={item.id} className="rounded-3xl border border-amber-100 bg-amber-50/70 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <PriorityLevelBadge level={item.priorityLevel} />
                      <span className="text-xs font-medium text-slate-500">分值 {item.priorityScore}</span>
                    </div>
                    <p className="mt-4 text-lg font-semibold text-slate-900">{item.targetName}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                    <div className="mt-4 space-y-2 text-sm text-slate-600">
                      <p>建议负责人：{item.recommendedOwner.label}</p>
                      <p>建议时限：{item.recommendedDeadline}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <div className="grid gap-6 xl:grid-cols-2">
              <SectionCard
                title="重点风险儿童"
                description="优先展示当前需要园长过目的重点儿童名单。"
              >
                <div className="space-y-3">
                  {home.riskChildren.length > 0 ? (
                    home.riskChildren.map((item) => (
                      <div key={item.childId} className="rounded-3xl border border-slate-100 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {item.childName} · {item.className}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                          </div>
                          <PriorityLevelBadge level={item.priorityLevel} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">当前没有进入高优先级列表的儿童。</p>
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="问题最集中的班级"
                description="用班级维度看闭环压力和整改优先级。"
              >
                <div className="space-y-3">
                  {home.riskClasses.length > 0 ? (
                    home.riskClasses.map((item) => (
                      <div key={item.className} className="rounded-3xl border border-slate-100 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{item.className}</p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                          </div>
                          <PriorityLevelBadge level={item.priorityLevel} />
                        </div>
                        <div className="mt-3 text-xs text-slate-500">
                          关联问题 {item.issueCount} 项 · 负责人 {item.ownerLabel}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">当前没有进入高优先级列表的班级问题。</p>
                  )}
                </div>
              </SectionCard>
            </div>

            <SectionCard
              title="待处理事项与派单"
              description="整改建议与通知派单汇总在一起，方便后续直接进入 Agent 推动作业闭环。"
              actions={
                notificationError ? (
                  <Badge variant="outline">{notificationError}</Badge>
                ) : (
                  <Badge variant="success">支持派单沉淀</Badge>
                )
              }
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-3">
                  {home.pendingItems.map((item) => (
                    <div key={item} className="rounded-3xl border border-slate-100 bg-white p-4 text-sm leading-6 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  {home.pendingDispatches.length > 0 ? (
                    home.pendingDispatches.map((event) => (
                      <div key={event.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                          <EventStatusBadge status={event.status} />
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          截止 {event.recommendedDeadline}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                      当前还没有已创建的派单，建议从园长 Agent 中直接生成。
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>
          </div>
        }
        aside={
          <div className="space-y-6">
            <AssistantEntryCard
              title="进入园长 Agent"
              description="把机构上下文、优先级排序、快捷追问和派单动作合并到一个操作入口。"
              href="/admin/agent"
              buttonLabel="进入机构运营 AI 助手"
            >
              <ul className="space-y-3 text-sm leading-6 text-slate-600">
                <li>{home.actionEntrySummary}</li>
                <li>当前服务对象：{INSTITUTION_NAME}</li>
                <li>建议流程：先问优先级，再派单，再看周报。</li>
              </ul>
            </AssistantEntryCard>

            <SectionCard title="本周运营亮点" description="用于周报和大屏复用的高层摘要。">
              <div className="space-y-3">
                {home.weeklyHighlights.map((item) => (
                  <div key={item} className="rounded-3xl border border-slate-100 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <TrendingUp className="mt-0.5 h-4 w-4 text-indigo-500" />
                      <p className="text-sm leading-6 text-slate-700">{item}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="园长今日顺序" description="比赛 demo 中适合直接讲清楚的处理顺序。">
              <ol className="space-y-3 text-sm text-slate-600">
                <li className="flex items-center gap-3">
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                  先看机构优先级 TOP 3。
                </li>
                <li className="flex items-center gap-3">
                  <ClipboardCheck className="h-4 w-4 text-emerald-500" />
                  再确认重点儿童、班级和家长协同薄弱点。
                </li>
                <li className="flex items-center gap-3">
                  <Workflow className="h-4 w-4 text-indigo-500" />
                  最后进入 Agent 生成动作建议并沉淀派单。
                </li>
              </ol>
            </SectionCard>

            {notificationError ? (
              <SectionCard title="派单状态" description="通知事件仓储未配置时，首页仍可展示优先级结果。">
                <div className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{notificationError}</p>
                </div>
              </SectionCard>
            ) : (
              <SectionCard title="派单状态" description="待推进动作会在这里同步展示。">
                <div className="space-y-3">
                  {notificationEvents.slice(0, 4).map((event) => (
                    <div key={event.id} className="rounded-3xl border border-slate-100 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                        <EventStatusBadge status={event.status} />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{event.summary}</p>
                    </div>
                  ))}
                  {notificationEvents.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                      还没有沉淀的通知事件。
                    </div>
                  ) : null}
                </div>
              </SectionCard>
            )}
          </div>
        }
      />
    </RolePageShell>
  );
}
