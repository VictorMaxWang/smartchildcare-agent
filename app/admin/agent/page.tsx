"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  BrainCircuit,
  ClipboardList,
  FileText,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import RiskPriorityBoard from "@/components/admin/RiskPriorityBoard";
import EmptyState from "@/components/EmptyState";
import {
  AgentWorkspaceCard,
  InlineLinkButton,
  MetricGrid,
  RolePageShell,
  RoleSplitLayout,
  SectionCard,
} from "@/components/role-shell/RoleScaffold";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ADMIN_AGENT_QUICK_QUESTIONS,
  attachNotificationEventToResult,
  attachNotificationEventsToResult,
} from "@/lib/agent/admin-agent";
import type { AdminConsultationPriorityItem } from "@/lib/agent/admin-consultation";
import { useAdminConsultationWorkspace } from "@/lib/agent/use-admin-consultation-workspace";
import type {
  AdminAgentRequestPayload,
  AdminAgentResult,
  AdminDispatchEvent,
  AdminAgentActionItem,
  InstitutionPriorityItem,
} from "@/lib/agent/admin-types";
import type { AiFollowUpMessage } from "@/lib/ai/types";
import { INSTITUTION_NAME, useApp } from "@/lib/store";

type HistoryEntry = {
  id: string;
  workflow: AdminAgentRequestPayload["workflow"];
  label: string;
  prompt?: string;
  result: AdminAgentResult;
};

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

function buildHistoryMessages(history: HistoryEntry[]) {
  const messages: AiFollowUpMessage[] = [];

  history.forEach((entry) => {
    if (entry.prompt) {
      messages.push({ role: "user", content: entry.prompt });
    }

    messages.push({ role: "assistant", content: entry.result.assistantAnswer });
  });

  return messages.slice(-8);
}

export default function AdminAgentPage() {
  const searchParams = useSearchParams();
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
  const {
    priorityItems: consultationPriorityItems,
    feedStatus,
    feedBadge,
    notificationEvents,
    notificationError,
    notificationReady,
    createNotification,
    createConsultationScopedNotification,
    updateNotificationStatus,
    isCreatingNotification,
    updatingEventId,
  } = useAdminConsultationWorkspace({
    institutionName: INSTITUTION_NAME,
    visibleChildren,
    localConsultations: getLatestConsultations(),
    consultationFeedOptions: {
      limit: 4,
      escalatedOnly: true,
    },
  });
  const [result, setResult] = useState<AdminAgentResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  const payload = useMemo<AdminAgentRequestPayload>(
    () => ({
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

  const runWorkflow = useCallback(async (
    workflow: AdminAgentRequestPayload["workflow"],
    options?: { question?: string; label?: string }
  ) => {
    setLoading(true);
    setRequestError(null);

    try {
      const requestPayload: AdminAgentRequestPayload = {
        ...payload,
        workflow,
        question: options?.question,
        history: workflow === "question-follow-up" ? buildHistoryMessages(history) : undefined,
      };
      const response = await fetch("/api/ai/admin-agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });
      const data = (await response.json()) as AdminAgentResult & { error?: string };

      if (!response.ok) {
        setRequestError(data.error ?? "园长 Agent 请求失败");
        return;
      }

      const nextResult = attachNotificationEventsToResult(data, notificationEvents);
      setResult(nextResult);
      setHistory((prev) => [
        ...prev,
        {
          id: `${workflow}-${Date.now()}`,
          workflow,
          label:
            options?.label ??
            (workflow === "daily-priority"
              ? "今日机构优先事项"
              : workflow === "weekly-ops-report"
                ? "本周运营周报"
                : options?.question ?? "继续追问"),
          prompt: workflow === "question-follow-up" ? options?.question : undefined,
          result: nextResult,
        },
      ]);
    } catch (error) {
      console.error("[ADMIN_AGENT] Failed to run workflow", error);
      setRequestError("园长 Agent 请求失败");
    } finally {
      setLoading(false);
    }
  }, [history, notificationEvents, payload]);

  const syncEventIntoAgentState = useCallback((event: AdminDispatchEvent) => {
    setResult((previous) =>
      previous ? attachNotificationEventToResult(previous, event) : previous
    );
    setHistory((previous) =>
      previous.map((entry) => ({
        ...entry,
        result: attachNotificationEventToResult(entry.result, event),
      }))
    );
  }, []);

  useEffect(() => {
    if (visibleChildren.length === 0 || initializedRef.current) return;

    initializedRef.current = true;
    const preloadAction = searchParams.get("action");
    const workflow = preloadAction === "weekly-report" ? "weekly-ops-report" : "daily-priority";
    const label = preloadAction === "weekly-report" ? "本周运营周报" : "今日机构优先事项";

    void runWorkflow(workflow, { label });
  }, [runWorkflow, searchParams, visibleChildren.length]);

  useEffect(() => {
    if (!notificationReady) return;

    if (notificationEvents.length === 0) {
      return;
    }

    setResult((previous) =>
      previous ? attachNotificationEventsToResult(previous, notificationEvents) : previous
    );
    setHistory((previous) =>
      previous.map((entry) => ({
        ...entry,
        result: attachNotificationEventsToResult(entry.result, notificationEvents),
      }))
    );
  }, [notificationEvents, notificationReady]);

  async function handleCreateDispatch(actionItem: AdminAgentActionItem) {
    setRequestError(null);

    const nextEvent = await createNotification(actionItem.dispatchPayload, actionItem.id);
    if (!nextEvent) {
      setRequestError("派单创建失败");
      return;
    }

    syncEventIntoAgentState(nextEvent);
  }

  async function handleUpdateEventStatus(eventId: string, status: AdminDispatchEvent["status"]) {
    setRequestError(null);

    const nextEvent = await updateNotificationStatus(eventId, status);
    if (!nextEvent) {
      setRequestError("派单状态更新失败");
      return;
    }

    syncEventIntoAgentState(nextEvent);
  }

  async function handleCreateConsultationNotification(item: AdminConsultationPriorityItem) {
    setRequestError(null);

    const nextEvent = await createConsultationScopedNotification(item);
    if (!nextEvent) {
      setRequestError("会诊派单创建失败");
      return;
    }

    syncEventIntoAgentState(nextEvent);
  }

  if (visibleChildren.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <EmptyState
          icon={<BrainCircuit className="h-6 w-6" />}
          title="当前没有可用于园长 Agent 的机构数据"
          description="请先从园长首页确认机构数据是否已经加载。"
        />
      </div>
    );
  }

  const quickQuestions = result?.quickQuestions ?? [...ADMIN_AGENT_QUICK_QUESTIONS];
  const scope = result?.institutionScope;

  return (
    <RolePageShell
      badge={`机构运营 AI 助手 · ${INSTITUTION_NAME}`}
      title="从识别问题，到生成动作，再到派单闭环"
      description="园长 Agent 会基于全园近 7 天数据判断优先级、给出责任人和时限，并把动作沉淀成可持续追踪的通知事件。"
      actions={
        <>
          <InlineLinkButton href="/admin" label="返回园长首页" />
          <InlineLinkButton href="/admin/agent?action=weekly-report" label="打开周报模式" variant="premium" />
        </>
      }
    >
      <RoleSplitLayout
        main={
          <div className="space-y-6">
            {scope ? (
              <MetricGrid
                items={[
                  { label: "可见儿童", value: `${scope.visibleChildren}`, tone: "sky" },
                  { label: "重点风险儿童", value: `${scope.riskChildrenCount}`, tone: "amber" },
                  { label: "反馈完成率", value: `${scope.feedbackCompletionRate}%`, tone: "emerald" },
                  { label: "待推进派单", value: `${scope.pendingDispatchCount}`, tone: "indigo" },
                ]}
              />
            ) : null}

            <SectionCard
              title="机构上下文"
              description="这里固定展示 Agent 判断优先级时使用的机构级上下文。"
            >
              {scope ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-slate-100 bg-white p-5">
                    <p className="text-sm font-semibold text-slate-900">近 7 天机构概览</p>
                    <div className="mt-4 space-y-2 text-sm text-slate-600">
                      <p>出勤率 {scope.attendanceRate}%</p>
                      <p>晨检异常 {scope.healthAbnormalCount} 条</p>
                      <p>成长关注 {scope.growthAttentionCount} 条</p>
                      <p>待复查 {scope.pendingReviewCount} 条</p>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-100 bg-white p-5">
                    <p className="text-sm font-semibold text-slate-900">当前运营链路</p>
                    <div className="mt-4 space-y-2 text-sm text-slate-600">
                      <p>重点班级 {scope.riskClassCount} 个</p>
                      <p>家长反馈 {scope.feedbackCount} 条</p>
                      <p>待推进派单 {scope.pendingDispatchCount} 条</p>
                      <p>机构 {scope.institutionName}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">正在生成机构上下文。</p>
              )}
            </SectionCard>

            <SectionCard
              title="今日重点会诊 / 高风险优先事项"
              description="把高风险会诊直接抬到园长 Agent 顶部，先看谁最值得今天推进，再继续追问和派单。"
              actions={<Badge variant="warning">会诊驱动</Badge>}
            >
              <RiskPriorityBoard
                items={consultationPriorityItems}
                isLoading={feedStatus === "loading"}
                sourceBadgeLabel={feedBadge.label}
                sourceBadgeVariant={feedBadge.variant}
                onCreateConsultationNotification={handleCreateConsultationNotification}
                isCreatingConsultationNotification={isCreatingNotification}
                notificationError={notificationError}
                emptyTitle={
                  feedStatus === "unavailable"
                    ? "高风险会诊 feed 暂时不可用"
                    : feedStatus === "ready"
                      ? "当前 backend feed 暂无升级到园长侧的重点会诊"
                      : undefined
                }
                emptyDescription={
                  feedStatus === "unavailable"
                    ? "页面会在 transport 失败时回退到本地 consultation；如果这里仍为空，说明本地也没有可展示的高风险会诊。"
                    : feedStatus === "ready"
                      ? "backend feed 已接管园长 Agent 顶部会诊区；当教师端产生新的高风险会诊后，这里会稳定显示风险等级、决策卡和 explainability 摘要。"
                      : undefined
                }
              />
            </SectionCard>

            <SectionCard
              title="当前优先事项"
              description="结构化展示当前最重要的机构级问题。"
              actions={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void runWorkflow("daily-priority", { label: "今日机构优先事项" })}
                  disabled={loading}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  重新生成
                </Button>
              }
            >
              {result ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    {result.priorityTopItems.map((item) => (
                      <div key={item.id} className="rounded-3xl border border-amber-100 bg-amber-50/70 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <PriorityLevelBadge level={item.priorityLevel} />
                          <span className="text-xs font-medium text-slate-500">分值 {item.priorityScore}</span>
                        </div>
                        <p className="mt-4 text-lg font-semibold text-slate-900">{item.targetName}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                        <div className="mt-4 space-y-2 text-sm text-slate-600">
                          <p>负责人：{item.recommendedOwner.label}</p>
                          <p>时限：{item.recommendedDeadline}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-3xl border border-slate-100 bg-white p-5">
                      <p className="text-sm font-semibold text-slate-900">重点风险儿童</p>
                      <div className="mt-4 space-y-3">
                        {result.riskChildren.slice(0, 4).map((item) => (
                          <div key={item.childId} className="rounded-2xl bg-slate-50 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-slate-900">
                                  {item.childName} · {item.className}
                                </p>
                                <p className="mt-1 text-sm text-slate-600">{item.reason}</p>
                              </div>
                              <PriorityLevelBadge level={item.priorityLevel} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-3xl border border-slate-100 bg-white p-5">
                      <p className="text-sm font-semibold text-slate-900">高压力班级</p>
                      <div className="mt-4 space-y-3">
                        {result.riskClasses.slice(0, 4).map((item) => (
                          <div key={item.className} className="rounded-2xl bg-slate-50 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-slate-900">{item.className}</p>
                                <p className="mt-1 text-sm text-slate-600">{item.reason}</p>
                              </div>
                              <PriorityLevelBadge level={item.priorityLevel} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">等待生成今日机构优先事项。</p>
              )}
            </SectionCard>

            <AgentWorkspaceCard
              title="快捷问题"
              description="用园长常见问题直接驱动 follow-up，输出仍保持结构化结果。"
              promptButtons={
                <>
                  {quickQuestions.map((question) => (
                    <Button
                      key={question}
                      variant="outline"
                      className="rounded-full"
                      onClick={() =>
                        void runWorkflow("question-follow-up", {
                          question,
                          label: question,
                        })
                      }
                      disabled={loading}
                    >
                      {question}
                    </Button>
                  ))}
                  <Button
                    variant="secondary"
                    className="rounded-full"
                    onClick={() => void runWorkflow("weekly-ops-report", { label: "本周运营周报" })}
                    disabled={loading}
                  >
                    生成本周运营周报
                  </Button>
                </>
              }
            >
              <div className="rounded-3xl border border-indigo-100 bg-indigo-50/50 p-5">
                {loading ? (
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" />
                    正在生成机构级判断结果…
                  </div>
                ) : result ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="info">{result.title}</Badge>
                      <Badge variant="outline">{result.source}</Badge>
                      {result.model ? <Badge variant="outline">{result.model}</Badge> : null}
                    </div>
                    <p className="text-base leading-7 text-slate-800">{result.assistantAnswer}</p>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-sm font-semibold text-slate-900">当前摘要</p>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{result.summary}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-sm font-semibold text-slate-900">关键提示</p>
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                          {result.highlights.map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">等待 Agent 返回结构化结果。</p>
                )}
              </div>
            </AgentWorkspaceCard>

            <SectionCard
              title="结构化行动建议"
              description="每条建议都带责任人、截止时间和派单入口。"
              actions={
                notificationError ? (
                  <Badge variant="outline">{notificationError}</Badge>
                ) : (
                  <Badge variant="success">支持派单</Badge>
                )
              }
            >
              {result ? (
                <div className="space-y-4">
                  {result.actionItems.map((item) => (
                    <div key={item.id} className="rounded-3xl border border-slate-100 bg-white p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <PriorityLevelBadge level={item.priorityLevel} />
                            <EventStatusBadge
                              status={
                                item.status === "completed"
                                  ? "completed"
                                  : item.status === "in_progress"
                                    ? "in_progress"
                                    : "pending"
                              }
                            />
                          </div>
                          <p className="text-base font-semibold text-slate-900">{item.title}</p>
                          <p className="text-sm leading-6 text-slate-600">{item.summary}</p>
                          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                            <span>负责人：{item.ownerLabel}</span>
                            <span>时限：{item.deadline}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="premium"
                            onClick={() => void handleCreateDispatch(item)}
                            disabled={
                              Boolean(notificationError) ||
                              isCreatingNotification(item.id) ||
                              Boolean(item.relatedEventId)
                            }
                          >
                            {isCreatingNotification(item.id)
                              ? "创建中…"
                              : item.relatedEventId
                                ? "已创建派单"
                                : "生成派单"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">等待 Agent 生成行动建议。</p>
              )}
            </SectionCard>

            <SectionCard title="历史记录" description="保留本次演示过程中已经生成过的机构级回答。">
              <div className="space-y-3">
                {history.length > 0 ? (
                  history.map((entry) => (
                    <div key={entry.id} className="rounded-3xl border border-slate-100 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{entry.label}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{entry.result.summary}</p>
                        </div>
                        <Badge variant="outline">{entry.result.source}</Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">还没有历史记录。</p>
                )}
              </div>
            </SectionCard>
          </div>
        }
        aside={
          <div className="space-y-6">
            <SectionCard title="当前状态" description="园长 Agent 当前聚焦的机构级结果摘要。">
              {result ? (
                <div className="space-y-3 text-sm text-slate-600">
                  <p>当前标题：{result.title}</p>
                  <p>重点事项：{result.priorityTopItems.length} 条</p>
                  <p>风险儿童：{result.riskChildren.length} 名</p>
                  <p>高压力班级：{result.riskClasses.length} 个</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">等待首轮结果。</p>
              )}
            </SectionCard>

            <SectionCard title="家长协同薄弱点" description="方便园长快速追问家园协同链路。">
              {result && result.feedbackRiskItems.length > 0 ? (
                <div className="space-y-3">
                  {result.feedbackRiskItems.slice(0, 4).map((item) => (
                    <div key={item.childId} className="rounded-2xl border border-slate-100 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {item.childName} · {item.className}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">{item.reason}</p>
                        </div>
                        <Badge variant="outline">{item.priorityLevel}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">当前没有明显的家长协同薄弱点。</p>
              )}
            </SectionCard>

            <SectionCard title="通知派单" description="这里显示已沉淀的通知事件，并支持更新处理状态。">
              {notificationError ? (
                <div className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{notificationError}</p>
                </div>
              ) : notificationEvents.length > 0 ? (
                <div className="space-y-3">
                  {notificationEvents.slice(0, 6).map((event) => (
                    <div key={event.id} className="rounded-3xl border border-slate-100 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{event.summary}</p>
                        </div>
                        <EventStatusBadge status={event.status} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleUpdateEventStatus(event.id, "in_progress")}
                          disabled={updatingEventId === event.id || event.status === "in_progress"}
                        >
                          {updatingEventId === event.id ? "更新中…" : "标记处理中"}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void handleUpdateEventStatus(event.id, "completed")}
                          disabled={updatingEventId === event.id || event.status === "completed"}
                        >
                          标记完成
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                  还没有已创建的派单。
                </div>
              )}
            </SectionCard>

            {requestError ? (
              <SectionCard title="运行状态" description="请求失败时保留错误提示，便于演示时说明 fallback。">
                <div className="flex items-start gap-3 rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{requestError}</p>
                </div>
              </SectionCard>
            ) : (
              <SectionCard title="推荐入口" description="常用机构级工作流入口。">
                <div className="space-y-3">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    onClick={() => void runWorkflow("weekly-ops-report", { label: "本周运营周报" })}
                  >
                    <FileText className="h-4 w-4 text-indigo-500" />
                    生成本周运营周报
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    onClick={() =>
                      void runWorkflow("question-follow-up", {
                        question: "今天最该优先处理的 3 件事是什么？",
                        label: "今天最该优先处理的 3 件事是什么？",
                      })
                    }
                  >
                    <ClipboardList className="h-4 w-4 text-amber-500" />
                    查看机构优先级 TOP 3
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    onClick={() =>
                      void runWorkflow("question-follow-up", {
                        question: "哪些家长反馈长期缺失？",
                        label: "哪些家长反馈长期缺失？",
                      })
                    }
                  >
                    <Sparkles className="h-4 w-4 text-emerald-500" />
                    看家长协同薄弱点
                  </button>
                </div>
              </SectionCard>
            )}
          </div>
        }
      />
    </RolePageShell>
  );
}
