"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrainCircuit, Sparkles } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import {
  AgentWorkspaceCard,
  InlineLinkButton,
  RolePageShell,
  RoleSplitLayout,
  SectionCard,
} from "@/components/role-shell/RoleScaffold";
import { Button } from "@/components/ui/button";
import { buildTeacherAgentContext, buildTeacherAgentReply, buildTeacherHomeViewModel, type AgentReply } from "@/lib/view-models/role-home";
import { useApp } from "@/lib/store";

type TeacherAction = "communication" | "follow-up" | "weekly-summary";

const ACTION_LABELS: Record<TeacherAction, string> = {
  communication: "生成家长沟通建议",
  "follow-up": "生成今日跟进行动",
  "weekly-summary": "总结本周观察",
};

type HistoryItem = {
  id: string;
  action: TeacherAction;
  reply: AgentReply;
};

export default function TeacherAgentPage() {
  const searchParams = useSearchParams();
  const { currentUser, visibleChildren, presentChildren, healthCheckRecords, growthRecords, guardianFeedbacks } = useApp();
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const home = useMemo(
    () =>
      buildTeacherHomeViewModel({
        visibleChildren,
        presentChildren,
        healthCheckRecords,
        growthRecords,
        guardianFeedbacks,
      }),
    [guardianFeedbacks, growthRecords, healthCheckRecords, presentChildren, visibleChildren]
  );
  const context = useMemo(() => buildTeacherAgentContext({ currentUser, home }), [currentUser, home]);
  const preloadAction = searchParams.get("action");
  const seededHistory = useMemo<HistoryItem[]>(() => {
    if (preloadAction !== "communication" && preloadAction !== "follow-up" && preloadAction !== "weekly-summary") {
      return [];
    }

    return [
      {
        id: `seed-${preloadAction}`,
        action: preloadAction,
        reply: buildTeacherAgentReply(context, preloadAction),
      },
    ];
  }, [context, preloadAction]);
  const visibleHistory = history.length > 0 ? history : seededHistory;
  const latestReply = visibleHistory.at(-1)?.reply ?? null;

  function runAction(action: TeacherAction) {
    const reply = buildTeacherAgentReply(context, action);
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
          title="当前没有可用于教师 AI 助手的班级数据"
          description="请先从教师首页确认当前班级是否已加载。"
        />
      </div>
    );
  }

  return (
    <RolePageShell
      badge={`教师 AI 助手 · ${currentUser.className ?? "当前班级"}`}
      title="先把班级上下文摆清楚，再用 AI 快速生成沟通和跟进建议"
      description="这一版先把教师 Agent 的入口和使用方式定型：班级上下文、快捷操作、回复区和历史记录齐全，后续可以直接替换为完整工作流。"
      actions={
        <>
          <InlineLinkButton href="/teacher" label="返回教师首页" />
          <InlineLinkButton href="/teacher/agent" label="进入教师 AI 助手" variant="premium" />
        </>
      }
    >
      <RoleSplitLayout
        main={
          <div className="space-y-6">
            <SectionCard title="当前儿童 / 班级上下文" description="让老师先确认 Agent 当前服务的是哪组对象。">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-100">
                  <p className="text-sm font-semibold text-slate-900">当前班级</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{context.className}</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">当前任务对象</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{visibleChildren.length} 名儿童</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="今日异常摘要" description="Agent 先展示老师最关心的当天上下文。">
              <div className="space-y-3">
                {context.abnormalSummary.length > 0 ? (
                  context.abnormalSummary.map((item) => (
                    <div key={item} className="rounded-3xl border border-rose-100 bg-rose-50/60 p-4 text-sm text-slate-700">
                      {item}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">今日暂无异常摘要，适合直接生成班级周观察总结。</p>
                )}
              </div>
            </SectionCard>

            <AgentWorkspaceCard
              title="快捷操作"
              description="先让老师一键得到可执行结果，再决定是否进入下一轮追问。"
              promptButtons={
                <>
                  {(Object.keys(ACTION_LABELS) as TeacherAction[]).map((action) => (
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
                  <p className="text-sm text-slate-500">点击上方任一快捷操作，教师 Agent 会基于班级上下文生成建议。</p>
                )}
              </div>
            </AgentWorkspaceCard>

            <SectionCard title="历史记录" description="保留本次演示中已经生成过的 AI 回复。">
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
            <SectionCard title="当前服务对象" description="固定展示教师 Agent 的上下文。">
              <ul className="space-y-3 text-sm text-slate-600">
                <li>当前班级：{context.className}</li>
                <li>待复查：{context.pendingReviewSummary.length} 人</li>
                <li>待沟通家长：{context.parentCommunicationSummary.length} 人</li>
              </ul>
            </SectionCard>

            <SectionCard title="待复查摘要" description="作为侧边辅助信息区。">
              <div className="space-y-3">
                {context.pendingReviewSummary.length > 0 ? (
                  context.pendingReviewSummary.map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-600">
                      {item}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">当前没有待复查摘要。</p>
                )}
              </div>
            </SectionCard>

            <SectionCard title="待沟通家长摘要" description="帮助老师在桌面端快速扫一眼。">
              <div className="space-y-3">
                {context.parentCommunicationSummary.length > 0 ? (
                  context.parentCommunicationSummary.map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-600">
                      {item}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">当前没有待沟通摘要。</p>
                )}
              </div>
            </SectionCard>
          </div>
        }
      />
    </RolePageShell>
  );
}
