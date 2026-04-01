"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { BrainCircuit, Clock3, Send, Sparkles } from "lucide-react";
import { buildFallbackSuggestion } from "@/lib/ai/fallback";
import type { AiFollowUpResponse, AiSuggestionResponse, ChildSuggestionSnapshot } from "@/lib/ai/types";
import {
  AgentWorkspaceCard,
  InlineLinkButton,
  RolePageShell,
  RoleSplitLayout,
  SectionCard,
} from "@/components/role-shell/RoleScaffold";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import EmptyState from "@/components/EmptyState";
import { getLocalToday, isDateWithinLastDays } from "@/lib/date";
import { getWeeklyTaskForChild } from "@/lib/mock/coparenting";
import { formatDisplayDate, getAgeBandFromBirthDate, getAgeText, useApp } from "@/lib/store";

const QUICK_QUESTIONS = [
  "为什么最近不愿意去园？",
  "今晚我应该怎么陪伴？",
  "这几天饮水少怎么办？",
];

type FollowUpTurn = {
  id: string;
  question: string;
  response: AiFollowUpResponse;
};

export default function ParentAgentPage() {
  const { getParentFeed, healthCheckRecords, mealRecords, growthRecords, guardianFeedbacks } = useApp();
  const parentFeed = getParentFeed();
  const [selectedChildId, setSelectedChildId] = useState(parentFeed[0]?.child.id ?? "");
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestionResponse | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<FollowUpTurn[]>([]);

  const selectedFeed = useMemo(
    () => parentFeed.find((item) => item.child.id === selectedChildId) ?? parentFeed[0],
    [parentFeed, selectedChildId]
  );

  const snapshot = useMemo(() => {
    if (!selectedFeed) return null;

    const today = getLocalToday();
    const withinSevenDays = (value: string) => isDateWithinLastDays(value.split(" ")[0], 7, today);
    const childId = selectedFeed.child.id;

    const childHealth = healthCheckRecords.filter((item) => item.childId === childId && isDateWithinLastDays(item.date, 7, today));
    const childMeals = mealRecords.filter((item) => item.childId === childId && isDateWithinLastDays(item.date, 7, today));
    const childGrowth = growthRecords.filter((item) => item.childId === childId && withinSevenDays(item.createdAt));
    const childFeedback = guardianFeedbacks.filter((item) => item.childId === childId && isDateWithinLastDays(item.date, 7, today));
    const categoryCounter = new Map<string, number>();
    childGrowth.forEach((item) => categoryCounter.set(item.category, (categoryCounter.get(item.category) ?? 0) + 1));

    const statusCounts = childFeedback.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      child: {
        id: selectedFeed.child.id,
        name: selectedFeed.child.name,
        ageBand: getAgeBandFromBirthDate(selectedFeed.child.birthDate),
        className: selectedFeed.child.className,
        allergies: selectedFeed.child.allergies,
        specialNotes: selectedFeed.child.specialNotes,
      },
      summary: {
        health: {
          abnormalCount: childHealth.filter((item) => item.isAbnormal).length,
          handMouthEyeAbnormalCount: childHealth.filter((item) => item.handMouthEye === "异常").length,
          avgTemperature:
            childHealth.length > 0
              ? Math.round((childHealth.reduce((sum, item) => sum + item.temperature, 0) / childHealth.length) * 10) / 10
              : undefined,
          moodKeywords: Array.from(new Set(childHealth.map((item) => item.mood))).slice(0, 5),
        },
        meals: {
          recordCount: childMeals.length,
          hydrationAvg: selectedFeed.weeklyTrend.hydrationAvg,
          balancedRate: selectedFeed.weeklyTrend.balancedRate,
          monotonyDays: selectedFeed.weeklyTrend.monotonyDays,
          allergyRiskCount: childMeals.filter((item) => Boolean(item.allergyReaction)).length,
        },
        growth: {
          recordCount: childGrowth.length,
          attentionCount: childGrowth.filter((item) => item.needsAttention).length,
          pendingReviewCount: childGrowth.filter((item) => item.reviewStatus === "待复查").length,
          topCategories: Array.from(categoryCounter.entries())
            .map(([category, count]) => ({ category, count }))
            .sort((left, right) => right.count - left.count)
            .slice(0, 3),
        },
        feedback: {
          count: childFeedback.length,
          statusCounts,
          keywords: childFeedback.map((item) => item.content).slice(0, 5),
        },
      },
      recentDetails: {
        health: childHealth.slice(0, 4).map((item) => ({
          date: item.date,
          temperature: item.temperature,
          mood: item.mood,
          handMouthEye: item.handMouthEye,
          isAbnormal: item.isAbnormal,
          remark: item.remark,
        })),
        meals: childMeals.slice(0, 5).map((item) => ({
          date: item.date,
          meal: item.meal,
          foods: item.foods.map((food) => `${food.name}(${food.amount})`),
          waterMl: item.waterMl,
          preference: item.preference,
          allergyReaction: item.allergyReaction,
        })),
        growth: childGrowth.slice(0, 5).map((item) => ({
          createdAt: item.createdAt,
          category: item.category,
          description: item.description,
          needsAttention: item.needsAttention,
          followUpAction: item.followUpAction,
          reviewStatus: item.reviewStatus,
        })),
        feedback: childFeedback.slice(0, 4).map((item) => ({
          date: item.date,
          status: item.status,
          content: item.content,
        })),
      },
      ruleFallback: selectedFeed.suggestions.map((item) => ({
        title: item.title,
        description: item.description,
        level: item.level,
        tags: item.tags,
      })),
    } satisfies ChildSuggestionSnapshot;
  }, [guardianFeedbacks, growthRecords, healthCheckRecords, mealRecords, selectedFeed]);

  const suggestionCards = useMemo(() => {
    const fallback = selectedFeed
      ? selectedFeed.suggestions.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
        }))
      : [];

    if (!aiSuggestion) return fallback;

    const cards = [
      ...aiSuggestion.concerns.map((item, index) => ({
        id: `concern-${index}`,
        title: item,
        description: aiSuggestion.actions[index] ?? aiSuggestion.disclaimer,
      })),
      ...aiSuggestion.highlights.map((item, index) => ({
        id: `highlight-${index}`,
        title: item,
        description: aiSuggestion.actions[index + aiSuggestion.concerns.length] ?? aiSuggestion.summary,
      })),
    ];

    return cards.length > 0 ? cards.slice(0, 4) : fallback;
  }, [aiSuggestion, selectedFeed]);

  useEffect(() => {
    setHistory([]);
  }, [selectedChildId]);

  useEffect(() => {
    if (!snapshot) return;

    let cancelled = false;
    const controller = new AbortController();
    const fallbackSuggestion = buildFallbackSuggestion(snapshot.ruleFallback);

    async function fetchSuggestion() {
      setSuggestionLoading(true);
      setAiSuggestion(null);

      try {
        const response = await fetch("/api/ai/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("fetch suggestion failed");
        }

        const data = (await response.json()) as AiSuggestionResponse;
        if (!cancelled) {
          setAiSuggestion(data);
        }
      } catch {
        if (!cancelled) {
          setAiSuggestion(fallbackSuggestion);
        }
      } finally {
        if (!cancelled) {
          setSuggestionLoading(false);
        }
      }
    }

    void fetchSuggestion();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [snapshot]);

  async function submitFollowUp(prefilledQuestion?: string) {
    if (!snapshot) return;
    const nextQuestion = (prefilledQuestion ?? question).trim();
    if (!nextQuestion) return;

    setFollowUpLoading(true);
    try {
      const response = await fetch("/api/ai/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshot,
          suggestionTitle: suggestionCards[0]?.title ?? "今日建议",
          suggestionDescription: suggestionCards[0]?.description ?? aiSuggestion?.summary,
          question: nextQuestion,
          history: history.flatMap((item) => [
            { role: "user" as const, content: item.question },
            { role: "assistant" as const, content: item.response.answer },
          ]),
        }),
      });

      if (!response.ok) {
        throw new Error("follow up failed");
      }

      const data = (await response.json()) as AiFollowUpResponse;
      setHistory((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, question: nextQuestion, response: data }]);
      setQuestion("");
    } finally {
      setFollowUpLoading(false);
    }
  }

  if (!selectedFeed || !snapshot) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <EmptyState
          icon={<BrainCircuit className="h-6 w-6" />}
          title="当前没有可用于 AI 助手的儿童数据"
          description="请先从家长首页确认当前孩子档案是否可见。"
        />
      </div>
    );
  }

  const task = getWeeklyTaskForChild(selectedFeed.child.id, getAgeBandFromBirthDate(selectedFeed.child.birthDate));
  const latestReply = history.at(-1)?.response;

  return (
    <RolePageShell
      badge={`家长 AI 助手 · 当前儿童 ${selectedFeed.child.name}`}
      title="把当前儿童、最近风险和今晚任务放进同一个对话入口"
      description="这一版先完成家长 Agent 的产品壳：先看上下文，再点快捷问题，最后继续追问。下一轮只需要把这里替换成完整 Agent 工作流。"
      actions={
        <>
          <InlineLinkButton href="/parent" label="返回家长首页" />
          <InlineLinkButton href="/parent/agent" label="刷新当前建议" variant="premium" />
        </>
      }
    >
      <RoleSplitLayout
        main={
          <div className="space-y-6">
            <SectionCard title="当前儿童信息卡" description="先锁定当前服务对象，再继续追问。">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-100 bg-white p-4">
                  <p className="text-base font-semibold text-slate-900">{selectedFeed.child.name}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {selectedFeed.child.className} · {getAgeText(selectedFeed.child.birthDate)} · {formatDisplayDate(selectedFeed.child.birthDate)}
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">当前任务</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{task.title} · {task.durationText}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="最近风险摘要" description="把最近 7 天最值得追问的信号先露出来。">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl bg-amber-50 p-4">
                  <p className="text-xs text-amber-700">健康异常</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{snapshot.summary.health.abnormalCount}</p>
                </div>
                <div className="rounded-3xl bg-sky-50 p-4" id="trend">
                  <p className="text-xs text-sky-700">平均饮水</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{snapshot.summary.meals.hydrationAvg} ml</p>
                </div>
              </div>
            </SectionCard>

            <AgentWorkspaceCard
              title="今日建议"
              description="先看当前 AI 建议，再决定是否继续追问。"
              promptButtons={
                <>
                  {QUICK_QUESTIONS.map((item) => (
                    <Button
                      key={item}
                      variant="outline"
                      className="rounded-full"
                      onClick={() => {
                        setQuestion(item);
                        void submitFollowUp(item);
                      }}
                    >
                      {item}
                    </Button>
                  ))}
                </>
              }
            >
              {suggestionLoading ? (
                <div className="rounded-3xl border border-slate-100 bg-white p-5 text-sm text-slate-500">正在生成 AI 建议…</div>
              ) : (
                <div className="grid gap-3">
                  {(aiSuggestion ? suggestionCards : selectedFeed.suggestions.slice(0, 4).map((item) => ({
                    id: item.id,
                    title: item.title,
                    description: item.description,
                  }))).map((item) => (
                    <div key={item.id} className="rounded-3xl border border-slate-100 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </AgentWorkspaceCard>

            <SectionCard title="AI 回复区" description="支持快捷问题和继续追问。">
              <div className="space-y-4">
                <Textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="继续追问，例如：今晚具体怎么陪伴？明天入园我该观察什么？"
                  className="min-h-28 bg-white"
                />
                <div className="flex justify-end">
                  <Button className="gap-2 rounded-xl" onClick={() => void submitFollowUp()} disabled={followUpLoading || !question.trim()}>
                    <Send className="h-4 w-4" />
                    {followUpLoading ? "追问中…" : "发送追问"}
                  </Button>
                </div>
                <div className="rounded-3xl border border-indigo-100 bg-indigo-50/50 p-5">
                  {latestReply ? (
                    <div className="prose prose-sm max-w-none text-slate-700">
                      <ReactMarkdown>{latestReply.answer}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">选择一个快捷问题，或直接输入你的追问。</p>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="历史追问区" description="保留最近几轮追问，便于连续演示。">
              <div className="space-y-3">
                {history.length > 0 ? (
                  history.map((item) => (
                    <div key={item.id} className="rounded-3xl border border-slate-100 bg-white p-4">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Clock3 className="h-3.5 w-3.5" />
                        追问记录
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{item.question}</p>
                      <div className="prose prose-sm mt-3 max-w-none text-slate-600">
                        <ReactMarkdown>{item.response.answer}</ReactMarkdown>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">还没有追问记录，先点击上方快捷问题。</p>
                )}
              </div>
            </SectionCard>
          </div>
        }
        aside={
          <div className="space-y-6">
            <SectionCard title="当前服务对象" description="作为 Agent 上下文固定展示。">
              <ul className="space-y-3 text-sm text-slate-600">
                <li>当前儿童：{selectedFeed.child.name}</li>
                <li>当前班级：{selectedFeed.child.className}</li>
                <li>当前任务：{task.title}</li>
              </ul>
            </SectionCard>

            <SectionCard title="切换儿童" description="示例账号下如有多个儿童，可从这里切换。">
              <div className="space-y-2">
                {parentFeed.map((item) => (
                  <button
                    key={item.child.id}
                    type="button"
                    onClick={() => setSelectedChildId(item.child.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      item.child.id === selectedFeed.child.id
                        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {item.child.name}
                  </button>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="快捷问题建议" description="适合移动端一键点问。">
              <div className="space-y-3">
                {QUICK_QUESTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setQuestion(item);
                      void submitFollowUp(item);
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <div className="flex items-start gap-3">
                      <Sparkles className="mt-0.5 h-4 w-4 text-indigo-500" />
                      <span>{item}</span>
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>
          </div>
        }
      />
    </RolePageShell>
  );
}
