"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrainCircuit, ClipboardList, FileText, Sparkles } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import {
  AgentWorkspaceCard,
  InlineLinkButton,
  RolePageShell,
  RoleSplitLayout,
  SectionCard,
} from "@/components/role-shell/RoleScaffold";
import { Button } from "@/components/ui/button";
import { buildAdminAgentContext, buildAdminAgentReply, buildAdminHomeViewModel, type AgentReply } from "@/lib/view-models/role-home";
import { INSTITUTION_NAME, useApp } from "@/lib/store";

type AdminAction = "weekly-report" | "risk-list" | "rectification";

const ACTION_LABELS: Record<AdminAction, string> = {
  "weekly-report": "生成本周运营周报",
  "risk-list": "汇总重点儿童名单",
  rectification: "提取待整改事项",
};

type HistoryItem = {
  id: string;
  action: AdminAction;
  reply: AgentReply;
};

export default function AdminAgentPage() {
  const searchParams = useSearchParams();
  const {
    visibleChildren,
    attendanceRecords,
    healthCheckRecords,
    growthRecords,
    guardianFeedbacks,
    getAdminBoardData,
    getWeeklyDietTrend,
    getSmartInsights,
  } = useApp();
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const home = useMemo(
    () =>
      buildAdminHomeViewModel({
        institutionName: INSTITUTION_NAME,
        visibleChildren,
        attendanceRecords,
        healthCheckRecords,
        growthRecords,
        guardianFeedbacks,
        adminBoardData: getAdminBoardData(),
        weeklyTrend: getWeeklyDietTrend(),
        smartInsights: getSmartInsights(),
      }),
    [attendanceRecords, getAdminBoardData, getSmartInsights, getWeeklyDietTrend, growthRecords, guardianFeedbacks, healthCheckRecords, visibleChildren]
  );
  const context = useMemo(() => buildAdminAgentContext({ institutionName: INSTITUTION_NAME, home }), [home]);
  const preloadAction = searchParams.get("action");
  const seededHistory = useMemo<HistoryItem[]>(() => {
    if (preloadAction !== "weekly-report" && preloadAction !== "risk-list" && preloadAction !== "rectification") {
      return [];
    }

    return [
      {
        id: `seed-${preloadAction}`,
        action: preloadAction,
        reply: buildAdminAgentReply(context, preloadAction),
      },
    ];
  }, [context, preloadAction]);
  const visibleHistory = history.length > 0 ? history : seededHistory;
  const latestReply = visibleHistory.at(-1)?.reply ?? null;

  function runAction(action: AdminAction) {
    const reply = buildAdminAgentReply(context, action);
    setHistory((prev) => {
      const base = prev.length > 0 ? prev : seededHistory;
      return [...base, { id: `${action}-${base.length}`, action, reply }];
    });
  }

  if (visibleChildren.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <EmptyState
          icon={<BrainCircuit className="h-6 w-6" />}
          title="当前没有可用于园所 Agent 的机构数据"
          description="请先从园长首页确认机构数据是否已加载。"
        />
      </div>
    );
  }

  return (
    <RolePageShell
      badge={`园所运营 AI 助手 · ${INSTITUTION_NAME}`}
      title="把机构风险、周报和整改动作汇总到一个可演示的运营入口"
      description="这一版先固定园长 Agent 的使用方式：看机构上下文、点快捷操作、查看回复和历史。下一轮可以直接接入完整运营工作流。"
      actions={
        <>
          <InlineLinkButton href="/admin" label="返回园长首页" />
          <InlineLinkButton href="/admin/agent" label="进入园所运营 AI 助手" variant="premium" />
        </>
      }
    >
      <RoleSplitLayout
        main={
          <div className="space-y-6">
            <SectionCard title="机构风险摘要" description="先展示园长进入 Agent 时最需要知道的上下文。">
              <div className="space-y-3">
                {context.riskSummary.map((item) => (
                  <div key={item} className="rounded-3xl border border-slate-100 bg-white p-4 text-sm text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="反馈完成率" description="把家园协同效率直接放进 Agent 上下文。">
              <div className="rounded-3xl bg-emerald-50 p-5">
                <p className="text-sm text-emerald-700">当前家长反馈完成率</p>
                <p className="mt-3 text-4xl font-bold text-slate-900">{context.feedbackCompletionRate}%</p>
              </div>
            </SectionCard>

            <AgentWorkspaceCard
              title="快捷操作"
              description="周报、风险名单和整改事项先用本地回复壳跑通。"
              promptButtons={
                <>
                  {(Object.keys(ACTION_LABELS) as AdminAction[]).map((action) => (
                    <Button key={action} variant="outline" className="rounded-full" onClick={() => runAction(action)}>
                      {ACTION_LABELS[action]}
                    </Button>
                  ))}
                </>
              }
            >
              <div className="rounded-3xl border border-indigo-100 bg-indigo-50/50 p-5">
                {latestReply ? (
                  <div className="space-y-4">
                    <p className="text-sm leading-7 text-slate-700">{latestReply.answer}</p>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-sm font-semibold text-slate-900">关键点</p>
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                          {latestReply.keyPoints.map((item) => <li key={item}>• {item}</li>)}
                        </ul>
                      </div>
                      <div className="rounded-2xl bg-white p-4">
                        <p className="text-sm font-semibold text-slate-900">下一步</p>
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                          {latestReply.nextSteps.map((item) => <li key={item}>• {item}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">点击上方任一快捷操作，园所运营 Agent 会生成一版可演示的运营建议。</p>
                )}
              </div>
            </AgentWorkspaceCard>

            <SectionCard title="历史记录" description="保留本次演示已经生成过的回复。">
              <div className="space-y-3">
                {visibleHistory.length > 0 ? (
                  visibleHistory.map((item) => (
                    <div key={item.id} className="rounded-3xl border border-slate-100 bg-white p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Sparkles className="h-4 w-4 text-indigo-500" />
                        {ACTION_LABELS[item.action]}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.reply.answer}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">还没有历史记录，先点一个快捷操作。</p>
                )}
              </div>
            </SectionCard>
          </div>
        }
        aside={
          <div className="space-y-6">
            <SectionCard title="当前服务对象" description="固定展示园长 Agent 当前服务的机构上下文。">
              <ul className="space-y-3 text-sm text-slate-600">
                <li>机构：{context.institutionName}</li>
                <li>重点风险摘要：{context.riskSummary.length} 条</li>
                <li>待整改事项：{context.pendingItems.length} 条</li>
              </ul>
            </SectionCard>

            <SectionCard title="待整改事项" description="给桌面端一个稳定的辅助信息区。">
              <div className="space-y-3">
                {context.pendingItems.length > 0 ? (
                  context.pendingItems.map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-600">
                      {item}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">当前暂无待整改事项。</p>
                )}
              </div>
            </SectionCard>

            <SectionCard title="周报与名单入口" description="园长演示时最常用的两个操作。">
              <div className="space-y-3">
                <button type="button" onClick={() => runAction("weekly-report")} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50">
                  <FileText className="h-4 w-4 text-indigo-500" />
                  生成本周运营周报
                </button>
                <button type="button" onClick={() => runAction("risk-list")} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50">
                  <ClipboardList className="h-4 w-4 text-amber-500" />
                  汇总重点儿童名单
                </button>
              </div>
            </SectionCard>
          </div>
        }
      />
    </RolePageShell>
  );
}
