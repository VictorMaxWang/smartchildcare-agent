"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, CalendarDays, CheckCircle2, MessageCircleMore, MoonStar, TrendingUp } from "lucide-react";
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
import { buildParentAgentChildContext, buildParentAgentSuggestionResult, buildParentChildSuggestionSnapshot, type ParentAgentResult } from "@/lib/agent/parent-agent";
import { buildFallbackSuggestion } from "@/lib/ai/fallback";
import type { AiSuggestionResponse } from "@/lib/ai/types";
import { buildParentHomeViewModel } from "@/lib/view-models/role-home";
import { formatDisplayDate, getAgeText, useApp } from "@/lib/store";

const TODAY_TEXT = new Date().toLocaleDateString("zh-CN", {
  month: "long",
  day: "numeric",
  weekday: "long",
});

export default function ParentHomePage() {
  const {
    getParentFeed,
    healthCheckRecords,
    mealRecords,
    growthRecords,
    guardianFeedbacks,
    taskCheckInRecords,
    getChildInterventionCard,
    getLatestConsultationForChild,
  } = useApp();
  const feed = getParentFeed()[0];
  const viewModel = buildParentHomeViewModel(feed);
  const [previewResult, setPreviewResult] = useState<ParentAgentResult | null>(null);
  const latestInterventionCard = feed ? getChildInterventionCard(feed.child.id) : undefined;
  const latestConsultation = feed ? getLatestConsultationForChild(feed.child.id) : undefined;

  const previewContext = useMemo(() => {
    if (!feed) return null;

    return buildParentAgentChildContext({
      child: feed.child,
      smartInsights: feed.suggestions,
      healthCheckRecords,
      mealRecords,
      growthRecords,
      guardianFeedbacks,
      taskCheckInRecords,
      weeklyTrend: feed.weeklyTrend,
    });
  }, [feed, guardianFeedbacks, growthRecords, healthCheckRecords, mealRecords, taskCheckInRecords]);

  const snapshot = useMemo(
    () => (previewContext ? buildParentChildSuggestionSnapshot(previewContext) : null),
    [previewContext]
  );

  useEffect(() => {
    if (!previewContext || !snapshot) return;

    let cancelled = false;
    const controller = new AbortController();
    const context = previewContext;
    const snapshotPayload = snapshot;

    async function fetchPreview() {
      try {
        const response = await fetch("/api/ai/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot: snapshotPayload }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("fetch preview failed");
        }

        const data = (await response.json()) as AiSuggestionResponse;
        if (!cancelled) {
          setPreviewResult(buildParentAgentSuggestionResult({ context, suggestion: data }));
        }
      } catch {
        if (!cancelled) {
          const fallback = buildFallbackSuggestion(snapshotPayload.ruleFallback);
          setPreviewResult(buildParentAgentSuggestionResult({ context, suggestion: fallback }));
        }
      }
    }

    void fetchPreview();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [previewContext, snapshot]);

  if (!viewModel || !feed || !previewContext) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <EmptyState
          icon={<BrainCircuit className="h-6 w-6" />}
          title="当前家长账号还没有可展示的孩子数据"
          description="请先使用示例家长账号，或完成普通家长账号的孩子建档。"
        />
      </div>
    );
  }

  const agentHref = `/parent/agent?child=${feed.child.id}`;
  const primaryAgentLabel = previewResult ? "继续追问" : "进入 AI 助手";
  const displayInterventionCard = latestInterventionCard ?? previewResult?.interventionCard;
  const displayTonightTaskTitle = displayInterventionCard?.title ?? viewModel.tonightTask.title;
  const displayTonightTaskDescription = displayInterventionCard?.tonightHomeAction ?? previewResult?.tonightTopAction ?? viewModel.tonightTask.description;
  const displayWhyRecommended = latestConsultation?.summary ?? previewResult?.whyNow ?? "系统综合近 7 天观察、园内风险和家庭反馈，优先给出今晚最值得执行的一件事。";
  const displayReviewIn48h = latestConsultation?.followUp48h?.[0] ?? displayInterventionCard?.reviewIn48h ?? "48 小时内继续观察今晚任务执行后的变化。";

  return (
    <RolePageShell
      badge={`家长首页 · ${TODAY_TEXT}`}
      title={`先看 ${viewModel.child.name} 今天的状态，再决定今晚怎么做`}
      description="首页只保留今天最需要处理的信息：孩子状态、AI 提醒、今晚任务、AI 干预卡预览、待反馈事项和 7 天趋势入口。手机端一屏可达，桌面端补充更完整摘要。"
      actions={
        <>
          <InlineLinkButton href={agentHref} label={primaryAgentLabel} variant="premium" />
          <InlineLinkButton href={`${agentHref}#feedback`} label="今晚完成后去反馈" />
        </>
      }
    >
      <RoleSplitLayout
        main={
          <div className="space-y-6">
            <MetricGrid
              items={viewModel.todaySummary.map((item) => ({
                label: item.label,
                value: item.value,
                tone: item.tone === "warning" ? "amber" : item.tone === "success" ? "emerald" : "sky",
              }))}
            />

            <SectionCard
              title="孩子今日情况摘要"
              description="先把家长最关心的几件事压缩到首屏。"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{viewModel.child.name}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {viewModel.child.className} · {getAgeText(viewModel.child.birthDate)} · 出生于 {formatDisplayDate(viewModel.child.birthDate)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {viewModel.child.allergies.length > 0 ? (
                      viewModel.child.allergies.map((item) => (
                        <Badge key={item} variant="warning">
                          过敏：{item}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="success">暂无过敏风险提示</Badge>
                    )}
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-100 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">今晚闭环重点</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                    <li>先看 AI 干预卡，再决定今晚只做哪一件事。</li>
                    <li>做完后直接在家长 Agent 页提交反馈，明天老师会继续接着看。</li>
                    <li>如果今晚有明显变化，直接进入 AI 助手继续追问。</li>
                  </ul>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="AI 今日提醒"
              description="优先看当前最值得家长马上处理的一条提示。"
              actions={<Badge variant={viewModel.aiReminder.level === "warning" ? "warning" : "info"}>{viewModel.aiReminder.level === "warning" ? "需关注" : "今日建议"}</Badge>}
            >
              <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-5">
                <p className="text-base font-semibold text-slate-900">{previewResult?.title ?? viewModel.aiReminder.title}</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">{previewResult?.whyNow ?? viewModel.aiReminder.description}</p>
              </div>
            </SectionCard>

            <div className="grid gap-6 xl:grid-cols-2">
              <SectionCard
                title="今晚家庭任务"
                description="今晚先做一件最适合当前状态的动作。"
                actions={<Badge variant={latestConsultation ? "warning" : "info"}>{latestConsultation ? "会诊闭环任务" : viewModel.tonightTask.tag}</Badge>}
              >
                <div className="rounded-3xl bg-sky-50 p-5">
                  <div className="flex items-start gap-3">
                    <MoonStar className="mt-0.5 h-5 w-5 text-sky-600" />
                    <div>
                      <p className="text-base font-semibold text-slate-900">{displayTonightTaskTitle}</p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{displayTonightTaskDescription}</p>
                      <p className="mt-3 text-sm font-medium text-sky-700">建议时长：{viewModel.tonightTask.durationText}</p>
                      <p className="mt-3 text-sm leading-6 text-slate-600">为什么推荐：{displayWhyRecommended}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">48 小时内复查：{displayReviewIn48h}</p>
                      <Link href={`${agentHref}#intervention`} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-sky-700">
                        查看完整干预卡
                        <TrendingUp className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="待反馈事项"
                description="让家长知道今晚是否还需要补一条反馈。"
                actions={<Badge variant={viewModel.pendingFeedback.status === "pending" ? "warning" : "success"}>{viewModel.pendingFeedback.status === "pending" ? "待提交" : "已同步"}</Badge>}
              >
                <div className="rounded-3xl bg-amber-50 p-5">
                  <div className="flex items-start gap-3">
                    <MessageCircleMore className="mt-0.5 h-5 w-5 text-amber-600" />
                    <div>
                      <p className="text-base font-semibold text-slate-900">{viewModel.pendingFeedback.title}</p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{previewResult?.feedbackPrompt ?? viewModel.pendingFeedback.description}</p>
                      <Link href={`${agentHref}#feedback`} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-amber-700">
                        去 AI 助手提交反馈
                        <TrendingUp className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            <SectionCard
              title="最近 7 天趋势入口"
              description="给家长一个足够轻量的趋势摘要，避免首页变成报表页。"
              actions={<InlineLinkButton href={agentHref} label="进入趋势与追问" />}
            >
              <div className="grid gap-3 sm:grid-cols-3">
                {viewModel.weeklyTrend.map((item) => (
                  <div key={item.label} className="rounded-3xl border border-slate-100 bg-white p-4">
                    <p className="text-xs text-slate-400">{item.label}</p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        }
        aside={
          <div className="space-y-6">
            <AssistantEntryCard
              title="进入 AI 助手 / 继续追问"
              description="当你想知道今晚怎么陪伴、为什么最近状态有变化、做完后怎么反馈，直接从这里进入。"
              href={agentHref}
              buttonLabel={primaryAgentLabel}
            >
              <ul className="space-y-3 text-sm leading-6 text-slate-600">
                <li>当前服务对象：{viewModel.child.name}</li>
                <li>当前任务：今晚家庭动作 + 明早反馈</li>
                <li>推荐路径：先看干预卡，再继续追问</li>
              </ul>
            </AssistantEntryCard>

            <SectionCard
              title="最近一张 AI 干预卡预览"
              description="首页先露出一张真实干预卡，让家长清楚今晚怎么做。"
            >
              <Link href={`${agentHref}#intervention`} className="block rounded-3xl border border-slate-100 bg-white p-5 transition hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <p className="text-sm font-semibold text-slate-900">{displayInterventionCard?.title ?? viewModel.interventionPreview.title}</p>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{displayInterventionCard?.summary ?? viewModel.interventionPreview.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(displayInterventionCard?.observationPoints ?? []).slice(0, 2).map((item) => (
                    <Badge key={item} variant="secondary">{item}</Badge>
                  ))}
                </div>
              </Link>
            </SectionCard>

            <SectionCard title="今日查看顺序" description="更适合移动端首页操作顺序。">
              <ol className="space-y-3 text-sm text-slate-600">
                <li className="flex items-center gap-3"><CalendarDays className="h-4 w-4 text-indigo-500" />先看今日情况摘要</li>
                <li className="flex items-center gap-3"><BrainCircuit className="h-4 w-4 text-indigo-500" />再看 AI 干预卡预览</li>
                <li className="flex items-center gap-3"><MoonStar className="h-4 w-4 text-indigo-500" />今晚按家庭动作执行并反馈</li>
              </ol>
            </SectionCard>
          </div>
        }
      />
    </RolePageShell>
  );
}
