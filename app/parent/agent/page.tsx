"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { BrainCircuit, CheckCircle2, Clock3, Mic, ScanSearch, Send, Sparkles } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import InterventionCardPanel from "@/components/agent/InterventionCardPanel";
import ParentTrendQaPanel from "@/components/parent/ParentTrendQaPanel";
import ParentTrendResponseCard from "@/components/parent/ParentTrendResponseCard";
import {
  AgentWorkspaceCard,
  InlineLinkButton,
  RolePageShell,
  RoleSplitLayout,
  SectionCard,
} from "@/components/role-shell/RoleScaffold";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  buildParentAgentChildContext,
  buildParentAgentFollowUpPayload,
  buildParentAgentFollowUpResult,
  buildParentAgentSuggestionResult,
  buildParentChildSuggestionSnapshot,
  PARENT_AGENT_QUICK_QUESTIONS,
  type ParentAgentChildContext,
  type ParentAgentResult,
} from "@/lib/agent/parent-agent";
import {
  buildParentMessageReflexionPayload,
  mergeParentMessageReflexionResult,
} from "@/lib/agent/parent-message-reflexion";
import {
  buildParentTrendDebugState,
  buildParentTrendQueryPayload,
  isLikelyTrendQuestion,
  PARENT_TREND_QUICK_QUESTIONS,
  resolveParentTrendDebugCase,
} from "@/lib/agent/parent-trend";
import { buildFallbackSuggestion } from "@/lib/ai/fallback";
import type {
  AiFollowUpResponse,
  AiSuggestionResponse,
  ChildSuggestionSnapshot,
  ParentMessageReflexionResponse,
  ParentTrendQueryResponse,
} from "@/lib/ai/types";
import { getLocalToday } from "@/lib/date";
import { getDraftSyncStatusLabel } from "@/lib/mobile/local-draft-cache";
import { buildReminderItems } from "@/lib/mobile/reminders";
import { buildMockOcrDraft } from "@/lib/mobile/ocr-input";
import { buildMockVoiceDraft } from "@/lib/mobile/voice-input";
import { formatDisplayDate, getAgeText, useApp } from "@/lib/store";

type HistoryItem = {
  id: string;
  question: string;
  result: ParentAgentResult;
};

function buildFeedbackContent(input: {
  executionStatus: "completed" | "partial" | "not_started" | null;
  childReaction: string;
  improved: boolean | "unknown";
  freeNote: string;
}) {
  const executionText =
    input.executionStatus === "completed"
      ? "今晚家庭任务已完整执行"
      : input.executionStatus === "partial"
        ? "今晚家庭任务已部分执行"
        : input.executionStatus === "not_started"
          ? "今晚家庭任务尚未执行"
          : "执行状态待确认";
  const parts = [
    executionText,
    input.childReaction.trim() ? `孩子反应：${input.childReaction.trim()}` : "",
    input.improved === true ? "观察到改善" : input.improved === false ? "暂未看到改善" : "改善情况待观察",
    input.freeNote.trim() ? `补充：${input.freeNote.trim()}` : "",
  ].filter(Boolean);

  return parts.join("；");
}

export default function ParentAgentPage() {
  const searchParams = useSearchParams();
  const childFromQuery = searchParams.get("child");
  const trendDebugEnabled = searchParams.get("trace") === "debug";
  const trendDebugCase = trendDebugEnabled
    ? resolveParentTrendDebugCase(searchParams.get("trendCase"))
    : null;
  const {
    children,
    attendanceRecords,
    getParentFeed,
    healthCheckRecords,
    mealRecords,
    growthRecords,
    guardianFeedbacks,
    taskCheckInRecords,
    addGuardianFeedback,
    checkInTask,
    interventionCards,
    consultations,
    reminders,
    mobileDrafts,
    saveMobileDraft,
    markMobileDraftSyncStatus,
    upsertReminder,
    updateReminderStatus,
    getChildInterventionCard,
    getLatestConsultationForChild,
  } = useApp();

  const parentFeed = getParentFeed();
  const defaultChildId = childFromQuery || parentFeed[0]?.child.id || "";
  const [selectedChildId, setSelectedChildId] = useState(defaultChildId);
  const [question, setQuestion] = useState("");
  const [currentResult, setCurrentResult] = useState<ParentAgentResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [latestTrendQuery, setLatestTrendQuery] = useState<string | null>(null);
  const [latestTrendResult, setLatestTrendResult] = useState<ParentTrendQueryResponse | null>(null);
  const [reflexionLoading, setReflexionLoading] = useState(false);
  const [parentMessageStatus, setParentMessageStatus] = useState<string | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);
  const [feedbackExecutionStatus, setFeedbackExecutionStatus] = useState<"completed" | "partial" | "not_started" | null>(null);
  const [feedbackImproved, setFeedbackImproved] = useState<boolean | "unknown">("unknown");
  const [childReaction, setChildReaction] = useState("");
  const [freeNote, setFreeNote] = useState("");
  const reflexionRequestRef = useRef(0);
  const reflexionAbortRef = useRef<AbortController | null>(null);
  const selectedChildIdRef = useRef(selectedChildId);

  const selectedFeed = useMemo(
    () => parentFeed.find((item) => item.child.id === selectedChildId) ?? parentFeed[0],
    [parentFeed, selectedChildId]
  );
  const trendDebugState = useMemo(
    () =>
      selectedFeed && trendDebugCase
        ? buildParentTrendDebugState({
            trendCase: trendDebugCase,
            child: selectedFeed.child,
          })
        : null,
    [selectedFeed, trendDebugCase]
  );
  const displayedTrendQuestion = trendDebugState?.question ?? latestTrendQuery;
  const displayedTrendResult = trendDebugState?.result ?? latestTrendResult;
  const displayedTrendError = trendDebugState?.error ?? trendError;
  const displayedTrendLoading = trendDebugState?.loading ?? trendLoading;
  const hasVisibleTrendCard = Boolean(
    displayedTrendQuestion || displayedTrendLoading || displayedTrendError || displayedTrendResult
  );

  const baseContext = useMemo(() => {
    if (!selectedFeed) return null;

    return buildParentAgentChildContext({
      child: selectedFeed.child,
      smartInsights: selectedFeed.suggestions,
      healthCheckRecords,
      mealRecords,
      growthRecords,
      guardianFeedbacks,
      taskCheckInRecords,
      weeklyTrend: selectedFeed.weeklyTrend,
    });
  }, [guardianFeedbacks, growthRecords, healthCheckRecords, mealRecords, selectedFeed, taskCheckInRecords]);

  const activeContext = useMemo(() => {
    if (!baseContext) return null;
    return {
      ...baseContext,
      currentInterventionCard: currentResult?.interventionCard ?? null,
    };
  }, [baseContext, currentResult]);

  const snapshot = useMemo(
    () => (baseContext ? buildParentChildSuggestionSnapshot(baseContext) : null),
    [baseContext]
  );
  const parentDrafts = useMemo(
    () =>
      mobileDrafts.filter(
        (draft) => draft.targetRole === "parent" && (!selectedFeed || draft.childId === selectedFeed.child.id)
      ),
    [mobileDrafts, selectedFeed]
  );
  const latestInterventionCard = useMemo(
    () => (selectedFeed ? getChildInterventionCard(selectedFeed.child.id) : undefined),
    [getChildInterventionCard, selectedFeed]
  );
  const latestConsultation = useMemo(
    () => (selectedFeed ? getLatestConsultationForChild(selectedFeed.child.id) : undefined),
    [getLatestConsultationForChild, selectedFeed]
  );
  const displayInterventionCard = currentResult?.interventionCard ?? latestInterventionCard;
  const displayConsultation = currentResult?.consultation ?? latestConsultation;
  const displayTonightTopAction = displayInterventionCard?.tonightHomeAction ?? currentResult?.tonightTopAction ?? baseContext?.task.description ?? "";
  const displayWhyNow =
    currentResult?.whyNow ??
    displayConsultation?.summary ??
    "系统综合近 7 天业务数据、教师观察和家长反馈，为今晚优先选出一条最值得执行的家庭动作。";
  const displayObservationPoints =
    displayInterventionCard?.observationPoints ?? currentResult?.tonightObservationPoints ?? [];
  const displayTeacherObservation =
    displayInterventionCard?.tomorrowObservationPoint ??
    currentResult?.teacherTomorrowObservation ??
    "明早继续反馈今晚执行结果，方便教师继续观察。";
  const familyTaskReminder = useMemo(
    () =>
      reminders.find(
        (item) =>
          item.targetRole === "parent" &&
          item.childId === selectedFeed?.child.id &&
          item.reminderType === "family-task"
      ),
    [reminders, selectedFeed]
  );
  const questionLoading = suggestionLoading || followUpLoading || displayedTrendLoading;

  useEffect(() => {
    if (!selectedChildId && parentFeed[0]?.child.id) {
      setSelectedChildId(parentFeed[0].child.id);
    }
  }, [parentFeed, selectedChildId]);

  useEffect(() => {
    if (!childFromQuery || childFromQuery === selectedChildIdRef.current) return;
    setSelectedChildId(childFromQuery);
  }, [childFromQuery]);

  useEffect(() => {
    selectedChildIdRef.current = selectedFeed?.child.id ?? "";
  }, [selectedFeed]);

  useEffect(() => {
    return () => {
      reflexionAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    reflexionRequestRef.current += 1;
    reflexionAbortRef.current?.abort();
    reflexionAbortRef.current = null;
    setHistory([]);
    setQuestion("");
    setTrendLoading(false);
    setTrendError(null);
    setLatestTrendQuery(null);
    setLatestTrendResult(null);
    setReflexionLoading(false);
    setParentMessageStatus(null);
    setFeedbackStatus(null);
    setFeedbackExecutionStatus(null);
  }, [selectedChildId]);

  useEffect(() => {
    if (!selectedFeed || !currentResult) return;

    buildReminderItems({
      childId: selectedFeed.child.id,
      targetRole: "parent",
      targetId: selectedFeed.child.id,
      childName: selectedFeed.child.name,
      interventionCard: currentResult.interventionCard,
      consultation: currentResult.consultation,
    }).forEach((item) => upsertReminder(item));
  }, [currentResult, selectedFeed, upsertReminder]);

  const readRouteError = useCallback(
    async (response: Response, fallbackMessage: string) => {
      try {
        const body = (await response.json()) as { error?: string; detail?: string };
        return body.error ?? body.detail ?? fallbackMessage;
      } catch {
        return fallbackMessage;
      }
    },
    []
  );

  const enrichParentMessageResult = useCallback(async (params: {
    context: ParentAgentChildContext;
    snapshotPayload: ChildSuggestionSnapshot;
    baseResult: ParentAgentResult;
    historyId?: string;
  }) => {
    const requestId = ++reflexionRequestRef.current;
    const childId = params.context.child.id;
    const controller = new AbortController();

    reflexionAbortRef.current?.abort();
    reflexionAbortRef.current = controller;

    setReflexionLoading(true);
    setParentMessageStatus("Evaluator is refining the parent-facing message.");

    try {
      const payload = buildParentMessageReflexionPayload({
        context: params.context,
        snapshot: params.snapshotPayload,
        result: params.baseResult,
      });
      const response = await fetch("/api/ai/parent-message-reflexion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          await readRouteError(
            response,
            "Parent message refinement is unavailable right now. Showing the base result instead."
          )
        );
      }

      const data = (await response.json()) as ParentMessageReflexionResponse;
      if (
        reflexionRequestRef.current !== requestId ||
        selectedChildIdRef.current !== childId
      ) {
        return;
      }

      const nextResult = mergeParentMessageReflexionResult({
        baseResult: params.baseResult,
        response: data,
      });

      setCurrentResult(nextResult);
      if (params.historyId) {
        setHistory((prev) =>
          prev.map((item) =>
            item.id === params.historyId ? { ...item, result: nextResult } : item
          )
        );
      }

      if (data.fallback || data.evaluationMeta.fallback) {
        setParentMessageStatus("Showing a backend fallback refinement result.");
      } else if (!data.evaluationMeta.canSend) {
        setParentMessageStatus(
          "Showing the evaluator output, but can_send is still false."
        );
      } else {
        setParentMessageStatus(null);
      }
    } catch (error) {
      if (
        controller.signal.aborted ||
        reflexionRequestRef.current !== requestId ||
        selectedChildIdRef.current !== childId
      ) {
        return;
      }

      setParentMessageStatus(
        error instanceof Error
          ? error.message
          : "Parent message refinement is unavailable right now. Showing the base result instead."
      );
    } finally {
      if (
        reflexionRequestRef.current === requestId &&
        selectedChildIdRef.current === childId
      ) {
        setReflexionLoading(false);
      }
      if (reflexionAbortRef.current === controller) {
        reflexionAbortRef.current = null;
      }
    }
  }, [readRouteError]);

  async function submitTrendQuery(nextQuestion: string) {
    if (!selectedFeed) return;
    if (trendDebugCase) {
      setQuestion("");
      return;
    }

    setTrendLoading(true);
    setTrendError(null);
    setLatestTrendQuery(nextQuestion);
    setLatestTrendResult(null);

    try {
      const payload = buildParentTrendQueryPayload({
        question: nextQuestion,
        childId: selectedFeed.child.id,
        children,
        attendanceRecords,
        mealRecords,
        growthRecords,
        guardianFeedbacks,
        healthCheckRecords,
        taskCheckInRecords,
        interventionCards,
        consultations,
        mobileDrafts,
        reminders,
      });

      const response = await fetch("/api/ai/parent-trend-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readRouteError(response, "趋势查询暂时不可用，请稍后再试。"));
      }

      const data = (await response.json()) as ParentTrendQueryResponse;
      setLatestTrendResult(data);
      setQuestion("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "趋势查询暂时不可用，请稍后再试。";
      setTrendError(message);
    } finally {
      setTrendLoading(false);
    }
  }

  async function submitFollowUp(prefilledQuestion?: string) {
    if (!activeContext || !currentResult) return;
    const nextQuestion = (prefilledQuestion ?? question).trim();
    if (!nextQuestion) return;

    if (isLikelyTrendQuestion(nextQuestion)) {
      await submitTrendQuery(nextQuestion);
      return;
    }

    setTrendError(null);
    setLatestTrendQuery(null);
    setLatestTrendResult(null);
    setFollowUpLoading(true);
    try {
      const payload = buildParentAgentFollowUpPayload({
        context: activeContext,
        question: nextQuestion,
        suggestionResult: currentResult,
        history: history.map((item) => ({ question: item.question, answer: item.result.assistantAnswer })),
      });

      const response = await fetch("/api/ai/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("follow-up failed");
      }

      const data = (await response.json()) as AiFollowUpResponse;
      const nextResult = buildParentAgentFollowUpResult({
        context: activeContext,
        baseResult: currentResult,
        response: data,
      });

      parentDrafts
        .filter((draft) => draft.syncStatus === "local_pending")
        .forEach((draft) => markMobileDraftSyncStatus(draft.draftId, "synced"));

      setCurrentResult(nextResult);
      const historyId = `${Date.now()}-${history.length}`;
      setHistory((prev) => [
        ...prev,
        { id: historyId, question: nextQuestion, result: nextResult },
      ]);
      void enrichParentMessageResult({
        context: activeContext,
        snapshotPayload: payload.snapshot as ChildSuggestionSnapshot,
        baseResult: nextResult,
        historyId,
      });
      setQuestion("");
    } finally {
      setFollowUpLoading(false);
    }
  }

  useEffect(() => {
    if (!baseContext || !snapshot) return;

    let cancelled = false;
    const controller = new AbortController();
    const context = baseContext;
    const snapshotPayload = snapshot;

    async function fetchSuggestion() {
      setSuggestionLoading(true);

      try {
        const response = await fetch("/api/ai/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot: snapshotPayload }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("fetch suggestion failed");
        }

        const data = (await response.json()) as AiSuggestionResponse;
        if (!cancelled) {
          const baseResult = buildParentAgentSuggestionResult({
            context,
            suggestion: data,
          });
          setCurrentResult(baseResult);
          void enrichParentMessageResult({
            context,
            snapshotPayload,
            baseResult,
          });
        }
      } catch {
        if (!cancelled) {
          const fallback = buildFallbackSuggestion(snapshotPayload.ruleFallback);
          const baseResult = buildParentAgentSuggestionResult({
            context,
            suggestion: fallback,
          });
          setCurrentResult(baseResult);
          void enrichParentMessageResult({
            context,
            snapshotPayload,
            baseResult,
          });
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
  }, [baseContext, enrichParentMessageResult, snapshot]);

  function submitFeedback() {
    if (!selectedFeed || !displayInterventionCard) return;
    if (feedbackExecutionStatus === null) {
      setFeedbackStatus("请先选择今晚是否已执行。");
      return;
    }
    if (!childReaction.trim()) {
      setFeedbackStatus("请补充孩子反应，再提交反馈。");
      return;
    }

    addGuardianFeedback({
      childId: selectedFeed.child.id,
      date: getLocalToday(),
      status: feedbackExecutionStatus === "not_started" ? "今晚反馈" : "在家已配合",
      content: buildFeedbackContent({
        executionStatus: feedbackExecutionStatus,
        childReaction,
        improved: feedbackImproved,
        freeNote,
      }),
      interventionCardId: displayInterventionCard.id,
      sourceWorkflow: "parent-agent",
      executionStatus: feedbackExecutionStatus,
      executed: feedbackExecutionStatus !== "not_started",
      childReaction: childReaction.trim(),
      improved: feedbackImproved,
      freeNote: freeNote.trim() || undefined,
    });

    if (feedbackExecutionStatus !== "not_started") {
      checkInTask(selectedFeed.child.id, activeContext?.task.id ?? displayInterventionCard.id, getLocalToday());
    }

    parentDrafts
      .filter((draft) => draft.syncStatus === "local_pending")
      .forEach((draft) => markMobileDraftSyncStatus(draft.draftId, "synced"));

    setFeedbackStatus("今晚反馈已提交，下一轮 follow-up 会自动把这条反馈带进上下文。");
    if (familyTaskReminder) {
      updateReminderStatus(familyTaskReminder.reminderId, "acknowledged");
    }

    setFeedbackExecutionStatus(null);
    setFeedbackImproved("unknown");
    setChildReaction("");
    setFreeNote("");
  }

  function snoozeFamilyReminder() {
    if (!familyTaskReminder) {
      setFeedbackStatus("当前没有可稍后提醒的家庭任务提醒。");
      return;
    }

    updateReminderStatus(familyTaskReminder.reminderId, "snoozed");
    setFeedbackStatus("已设置稍后提醒，任务卡状态会同步保存在本地。");
  }

  function createVoiceDraft() {
    if (!selectedFeed) return;
    const draft = buildMockVoiceDraft({
      childId: selectedFeed.child.id,
      targetRole: "parent",
      childName: selectedFeed.child.name,
      scenario: "parent-feedback",
    });
    saveMobileDraft(draft);
    setQuestion(draft.content);
  }

  function createOcrDraft() {
    if (!selectedFeed) return;
    const draft = buildMockOcrDraft({
      childId: selectedFeed.child.id,
      targetRole: "parent",
      childName: selectedFeed.child.name,
      attachmentName: "health-note.jpg",
    });
    saveMobileDraft(draft);
    setFreeNote(draft.content);
  }

  if (!selectedFeed || !baseContext || !snapshot) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <EmptyState
          icon={<BrainCircuit className="h-6 w-6" />}
          title="当前没有可用于家长 Agent 的儿童数据"
          description="请先从家长首页确认当前孩子档案是否可见。"
        />
      </div>
    );
  }

  return (
    <RolePageShell
      badge={`家长 AI 助手 · 当前儿童 ${selectedFeed.child.name}`}
      title="把今晚怎么做、做完怎么反馈、明天老师继续看什么，放进同一条 AI 闭环里"
      description="这一版家长 Agent 不再只是追问聊天框，而是基于真实 7 天业务数据、家庭任务、最近反馈和 AI 干预卡，给出今晚可执行动作，并把家长反馈直接送回下一轮 follow-up。"
      actions={
        <>
          <InlineLinkButton href="/parent" label="返回家长首页" />
          <InlineLinkButton href={`/parent/agent?child=${selectedFeed.child.id}`} label="刷新当前建议" variant="premium" />
        </>
      }
    >
      <RoleSplitLayout
        main={
          <div className="space-y-6">
            <SectionCard title="当前儿童信息卡" description="先锁定这次 Agent 服务的对象，再决定今晚先做什么。">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-100 bg-white p-4">
                  <p className="text-lg font-semibold text-slate-900">{selectedFeed.child.name}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {selectedFeed.child.className} · {getAgeText(selectedFeed.child.birthDate)} · 出生于 {formatDisplayDate(selectedFeed.child.birthDate)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedFeed.child.allergies.length > 0 ? (
                      selectedFeed.child.allergies.map((item) => (
                        <Badge key={item} variant="warning">
                          过敏：{item}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="success">暂无过敏重点</Badge>
                    )}
                  </div>
                </div>
                <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">今晚家庭任务</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{displayInterventionCard?.title ?? baseContext.task.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{displayTonightTopAction}</p>
                  <p className="mt-3 text-sm font-medium text-sky-700">{baseContext.task.durationText} · {baseContext.task.tag}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">为什么推荐：{displayWhyNow}</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="最近风险摘要" description="AI 先用真实业务数据找出今晚最值得处理的信号。">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl bg-amber-50 p-4">
                  <p className="text-xs text-amber-700">近 7 天重点原因</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">{baseContext.focusReasons[0]}</p>
                </div>
                <div className="rounded-3xl bg-sky-50 p-4">
                  <p className="text-xs text-sky-700">平均饮水</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{selectedFeed.weeklyTrend.hydrationAvg} ml</p>
                </div>
                <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-100">
                  <p className="text-xs text-slate-500">最近家长反馈</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">
                    {selectedFeed.latestFeedback ? selectedFeed.latestFeedback.status : "最近尚未形成反馈"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {baseContext.focusReasons.map((item) => (
                  <Badge key={item} variant="secondary">{item}</Badge>
                ))}
              </div>
            </SectionCard>

            <AgentWorkspaceCard
              title="今日建议摘要"
              description="先读系统给出的今晚动作，再用快捷问题继续追问。"
              promptButtons={
                <>
                  {PARENT_AGENT_QUICK_QUESTIONS.map((item) => (
                    <Button
                      key={item}
                      variant="outline"
                      className="rounded-full"
                      onClick={() => {
                        setQuestion(item);
                        void submitFollowUp(item);
                      }}
                      disabled={questionLoading || !currentResult}
                    >
                      {item}
                    </Button>
                  ))}
                </>
              }
            >
              {suggestionLoading || !currentResult ? (
                <div className="rounded-3xl border border-slate-100 bg-white p-5 text-sm text-slate-500">
                  正在基于最近 7 天数据生成家长端建议…
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="rounded-full" onClick={createVoiceDraft}>
                      <Mic className="mr-2 h-4 w-4" />
                      语音速记
                    </Button>
                    <Button type="button" variant="outline" className="rounded-full" onClick={createOcrDraft}>
                      <ScanSearch className="mr-2 h-4 w-4" />
                      OCR 草稿
                    </Button>
                  </div>
                  <div className="rounded-3xl border border-indigo-100 bg-indigo-50/70 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={currentResult.source === "ai" ? "success" : currentResult.source === "mock" ? "info" : "secondary"}>
                        {currentResult.source}
                      </Badge>
                      {currentResult.model ? <Badge variant="secondary">{currentResult.model}</Badge> : null}
                      {currentResult.parentMessageMeta ? (
                        <>
                          <Badge variant="outline">
                            revisions {currentResult.parentMessageMeta.revisionCount}
                          </Badge>
                          <Badge variant="outline">
                            score {currentResult.parentMessageMeta.score.toFixed(1)}
                          </Badge>
                          <Badge
                            variant={
                              currentResult.parentMessageMeta.canSend
                                ? "success"
                                : "secondary"
                            }
                          >
                            can_send {currentResult.parentMessageMeta.canSend ? "true" : "false"}
                          </Badge>
                        </>
                      ) : null}
                      {reflexionLoading ? <Badge variant="outline">evaluator</Badge> : null}
                    </div>
                    {parentMessageStatus ? (
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {parentMessageStatus}
                      </p>
                    ) : null}
                    <p className="mt-3 text-lg font-semibold text-slate-900">{currentResult.title}</p>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{currentResult.summary}</p>
                    <div className="mt-4 rounded-2xl bg-white/80 p-4">
                      <p className="text-sm font-semibold text-slate-900">今晚最该做的一件事</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{displayTonightTopAction}</p>
                      <p className="mt-3 text-sm font-semibold text-slate-900">为什么现在做</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{displayWhyNow}</p>
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-3xl border border-slate-100 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">今晚观察点</p>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                        {displayObservationPoints.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-3xl border border-slate-100 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">明天老师继续看</p>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{displayTeacherObservation}</p>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        48 小时内复查：{displayConsultation?.followUp48h?.[0] ?? displayInterventionCard?.reviewIn48h ?? "继续观察并补一条反馈。"}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    {parentDrafts.length > 0 ? (
                      parentDrafts.slice(0, 4).map((draft) => (
                        <div key={draft.draftId} className="rounded-3xl border border-slate-100 bg-white p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">{draft.draftType.toUpperCase()} 草稿</p>
                            <span className="text-xs text-slate-500">{getDraftSyncStatusLabel(draft.syncStatus)}</span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{draft.content}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-3xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                        当前还没有待同步草稿。
                      </div>
                    )}
                  </div>
                </div>
              )}
            </AgentWorkspaceCard>

            <SectionCard title="AI 回复区" description="支持普通追问和趋势问答，回答会自动带上当前干预卡、最近反馈和趋势图卡。">
              <div className="space-y-4">
                <Textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="继续追问，例如：今晚我具体先做哪一步？如果孩子不配合怎么办？"
                  className="min-h-28 bg-white"
                />
                {trendDebugEnabled ? (
                  <ParentTrendQaPanel
                    childId={selectedFeed.child.id}
                    activeCase={trendDebugCase}
                  />
                ) : null}
                <div className="space-y-3">
                  <div>
                    <p className="mb-2 text-xs font-medium tracking-[0.14em] text-slate-400">继续追问</p>
                    <div className="flex flex-wrap gap-2">
                      {currentResult?.recommendedQuestions.slice(0, 3).map((item) => (
                        <Button
                          key={item}
                          type="button"
                          variant="outline"
                          className="rounded-full"
                          onClick={() => void submitFollowUp(item)}
                          disabled={questionLoading}
                        >
                          {item}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium tracking-[0.14em] text-slate-400">趋势快问</p>
                    <div className="flex flex-wrap gap-2">
                      {PARENT_TREND_QUICK_QUESTIONS.map((item) => (
                        <Button
                          key={item}
                          type="button"
                          variant="outline"
                          className="rounded-full border-sky-200 bg-sky-50/70 text-sky-700 hover:bg-sky-100"
                          onClick={() => {
                            setQuestion(item);
                            void submitFollowUp(item);
                          }}
                          disabled={questionLoading || !currentResult}
                        >
                          {item}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    className="gap-2 rounded-xl"
                    onClick={() => void submitFollowUp()}
                    disabled={questionLoading || !question.trim() || !currentResult}
                  >
                    <Send className="h-4 w-4" />
                    {followUpLoading ? "追问中…" : trendLoading ? "查询趋势中…" : "发送追问"}
                  </Button>
                </div>
                <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-5">
                  {currentResult ? (
                    <div className="prose prose-sm max-w-none text-slate-700">
                      <ReactMarkdown>{currentResult.assistantAnswer}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">建议生成后，这里会展示结构化 AI 回复。</p>
                  )}
                </div>
                {followUpLoading ? (
                  <div className="rounded-3xl border border-slate-100 bg-white p-4 text-sm text-slate-500">
                    AI 正在整理最新追问，请稍候…
                  </div>
                ) : null}
                {hasVisibleTrendCard ? (
                  <ParentTrendResponseCard
                    question={displayedTrendQuestion}
                    result={displayedTrendResult}
                    loading={displayedTrendLoading}
                    error={displayedTrendError}
                    onRetry={displayedTrendQuestion ? () => void submitTrendQuery(displayedTrendQuestion) : undefined}
                  />
                ) : null}
              </div>
            </SectionCard>

            {displayInterventionCard ? (
              <div id="intervention">
                <SectionCard title="当前干预卡摘要区" description="这张卡既服务家长端，也能给教师端继续消费。">
                  <InterventionCardPanel
                    card={displayInterventionCard}
                    footer={
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                          <p className="text-sm font-semibold text-slate-900">家长沟通话术</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{displayInterventionCard.parentMessageDraft}</p>
                        </div>
                        <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                          <p className="text-sm font-semibold text-slate-900">教师后续跟进</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{displayInterventionCard.teacherFollowupDraft}</p>
                        </div>
                      </div>
                    }
                  />
                </SectionCard>
              </div>
            ) : null}

            <div id="feedback">
              <SectionCard title="反馈提交区" description="上一轮建议执行完后，直接在这里把反馈送回下一轮 Agent。">
                <div className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-slate-100 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">今晚任务执行状态</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" variant={feedbackExecutionStatus === "completed" ? "premium" : "outline"} onClick={() => setFeedbackExecutionStatus("completed")}>
                        已执行
                      </Button>
                      <Button type="button" variant={feedbackExecutionStatus === "partial" ? "premium" : "outline"} onClick={() => setFeedbackExecutionStatus("partial")}>
                        部分执行
                      </Button>
                      <Button type="button" variant={feedbackExecutionStatus === "not_started" ? "premium" : "outline"} onClick={() => setFeedbackExecutionStatus("not_started")}>
                        未执行
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-100 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">是否改善</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" variant={feedbackImproved === true ? "premium" : "outline"} onClick={() => setFeedbackImproved(true)}>
                        有改善
                      </Button>
                      <Button type="button" variant={feedbackImproved === false ? "premium" : "outline"} onClick={() => setFeedbackImproved(false)}>
                        暂未改善
                      </Button>
                      <Button type="button" variant={feedbackImproved === "unknown" ? "premium" : "outline"} onClick={() => setFeedbackImproved("unknown")}>
                        还需观察
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-900">孩子反应</p>
                    <Textarea
                      value={childReaction}
                      onChange={(event) => setChildReaction(event.target.value)}
                      placeholder="例如：一开始抗拒，3 分钟后愿意配合；今晚喝水明显更主动。"
                      className="min-h-24 bg-white"
                    />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-900">自由补充</p>
                    <Textarea
                      value={freeNote}
                      onChange={(event) => setFreeNote(event.target.value)}
                      placeholder="补充执行时段、持续时间、家庭场景或其他异常。"
                      className="min-h-24 bg-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{currentResult?.feedbackPrompt ?? "提交反馈后，下一轮 follow-up 会自动带上这条记录。"}</p>
                    <p className="mt-1 text-sm text-slate-600">这条反馈会挂到当前干预卡上，并进入下一轮 follow-up 上下文。</p>
                    {familyTaskReminder ? (
                      <p className="mt-2 text-sm text-slate-600">当前提醒状态：{familyTaskReminder.status}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="rounded-xl" onClick={snoozeFamilyReminder}>
                      稍后提醒
                    </Button>
                    <Button className="gap-2 rounded-xl" onClick={submitFeedback} disabled={!displayInterventionCard}>
                      <CheckCircle2 className="h-4 w-4" />
                      提交今晚反馈
                    </Button>
                  </div>
                </div>

                  {feedbackStatus ? <p className="text-sm text-slate-600">{feedbackStatus}</p> : null}
                </div>
              </SectionCard>
            </div>

            <SectionCard title="会话历史区" description="保留本次会话内的追问和 AI 回答，便于连续演示。">
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
                        <ReactMarkdown>{item.result.assistantAnswer}</ReactMarkdown>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">还没有追问记录，先点一个快捷问题或直接输入你的问题。</p>
                )}
              </div>
            </SectionCard>
          </div>
        }
        aside={
          <div className="space-y-6">
            <SectionCard title="当前服务对象" description="作为 Agent 上下文的固定摘要。">
              <ul className="space-y-3 text-sm text-slate-600">
                <li>当前儿童：{selectedFeed.child.name}</li>
                <li>当前班级：{selectedFeed.child.className}</li>
                <li>当前任务：{baseContext.task.title}</li>
                <li>最近反馈：{selectedFeed.latestFeedback?.status ?? "最近暂无反馈"}</li>
              </ul>
            </SectionCard>

            <SectionCard title="切换儿童" description="如示例家长账号下有多个孩子，可从这里切换。">
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

            <SectionCard title="推荐继续追问" description="用来串起家长今晚执行、明天老师复查和 48 小时闭环。">
              <div className="space-y-3">
                {(currentResult?.recommendedQuestions ?? PARENT_AGENT_QUICK_QUESTIONS).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => void submitFollowUp(item)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    disabled={questionLoading || !currentResult}
                  >
                    <div className="flex items-start gap-3">
                      <Sparkles className="mt-0.5 h-4 w-4 text-indigo-500" />
                      <span>{item}</span>
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="首页联动入口" description="把首页里的任务、干预卡预览和待反馈入口真正串起来。">
              <div className="space-y-3 text-sm text-slate-600">
                <Link href={`/parent?child=${selectedFeed.child.id}`} className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700 hover:bg-slate-50">
                  返回家长首页查看干预卡预览
                </Link>
                <Link href={`#intervention`} className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700 hover:bg-slate-50">
                  查看当前干预卡详情
                </Link>
                <Link href={`#feedback`} className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700 hover:bg-slate-50">
                  直接提交今晚反馈
                </Link>
              </div>
            </SectionCard>
          </div>
        }
      />
    </RolePageShell>
  );
}
