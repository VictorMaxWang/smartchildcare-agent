"use client";

import { useState } from "react";
import type { ConsultationResult } from "@/lib/ai/types";
import type { InterventionCard } from "@/lib/agent/intervention-card";
import type {
  GuardianFeedback,
  ParentFeedbackAttachments,
  ParentFeedbackChildReaction,
  ParentFeedbackExecutionStatus,
  ParentFeedbackExecutorRole,
  ParentFeedbackImprovementStatus,
} from "@/lib/feedback/types";
import type { CanonicalTask } from "@/lib/tasks/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ExecutionCountOption = 1 | 2 | 3;

const EXECUTION_STATUS_OPTIONS: Array<{
  value: ParentFeedbackExecutionStatus;
  label: string;
}> = [
  { value: "completed", label: "已做" },
  { value: "partial", label: "做了一部分" },
  { value: "not_started", label: "还没做" },
];

const CHILD_REACTION_OPTIONS: Array<{
  value: ParentFeedbackChildReaction;
  label: string;
}> = [
  { value: "resisted", label: "抗拒" },
  { value: "neutral", label: "一般" },
  { value: "accepted", label: "愿意配合" },
  { value: "improved", label: "明显更顺" },
];

const IMPROVEMENT_STATUS_OPTIONS: Array<{
  value: ParentFeedbackImprovementStatus;
  label: string;
}> = [
  { value: "no_change", label: "没变化" },
  { value: "slight_improvement", label: "有一点好转" },
  { value: "clear_improvement", label: "明显好转" },
  { value: "worse", label: "更糟了" },
];

const EXECUTION_COUNT_OPTIONS: Array<{
  value: ExecutionCountOption;
  label: string;
}> = [
  { value: 1, label: "1次" },
  { value: 2, label: "2次" },
  { value: 3, label: "3次+" },
];

const EXECUTOR_ROLE_OPTIONS: Array<{
  value: ParentFeedbackExecutorRole;
  label: string;
}> = [
  { value: "parent", label: "家长" },
  { value: "grandparent", label: "祖辈" },
  { value: "caregiver", label: "照护人" },
  { value: "mixed", label: "多人配合" },
];

const BARRIER_OPTIONS = [
  "孩子抗拒",
  "今晚没时间",
  "照护人没对齐",
  "孩子状态不好",
  "不确定怎么做",
] as const;

function toggleBarrier(barriers: string[], nextBarrier: string) {
  return barriers.includes(nextBarrier)
    ? barriers.filter((item) => item !== nextBarrier)
    : [...barriers, nextBarrier];
}

export interface ParentStructuredFeedbackComposerSubmitInput {
  childId: string;
  executionStatus: ParentFeedbackExecutionStatus;
  executionCount?: number;
  executorRole: ParentFeedbackExecutorRole;
  childReaction: ParentFeedbackChildReaction;
  improvementStatus: ParentFeedbackImprovementStatus;
  barriers: string[];
  notes: string;
  relatedTaskId?: string;
  relatedConsultationId?: string;
  interventionCardId?: string;
  attachments: ParentFeedbackAttachments;
}

interface ParentStructuredFeedbackComposerProps {
  childId: string;
  interventionCard?: InterventionCard | null;
  activeTask?: CanonicalTask;
  consultation?: ConsultationResult;
  feedbackPrompt?: string;
  reminderStatus?: string;
  latestFeedback?: GuardianFeedback;
  statusMessage?: string | null;
  notePrefill?: { value: string; token: number } | null;
  onSubmit: (input: ParentStructuredFeedbackComposerSubmitInput) => void;
  onSnoozeReminder?: () => void;
}

export default function ParentStructuredFeedbackComposer({
  childId,
  interventionCard,
  activeTask,
  consultation,
  feedbackPrompt,
  reminderStatus,
  latestFeedback,
  statusMessage,
  notePrefill,
  onSubmit,
  onSnoozeReminder,
}: ParentStructuredFeedbackComposerProps) {
  const [executionStatus, setExecutionStatus] =
    useState<ParentFeedbackExecutionStatus | null>(null);
  const [executionCount, setExecutionCount] = useState<number | undefined>(1);
  const [childReaction, setChildReaction] =
    useState<ParentFeedbackChildReaction | null>(null);
  const [improvementStatus, setImprovementStatus] =
    useState<ParentFeedbackImprovementStatus | null>(null);
  const [executorRole, setExecutorRole] =
    useState<ParentFeedbackExecutorRole>("parent");
  const [barriers, setBarriers] = useState<string[]>([]);
  const [notes, setNotes] = useState(() => notePrefill?.value ?? "");
  const [showDetails, setShowDetails] = useState(() => Boolean(notePrefill?.value));
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const composerMessage = validationMessage ?? statusMessage;
  const reviewLabel =
    consultation?.followUp48h?.[0] ??
    interventionCard?.reviewIn48h ??
    "提交后会继续带入 48 小时复查上下文。";

  function handleSubmit() {
    if (!interventionCard) {
      setValidationMessage("当前还没有可关联的干预卡，暂时无法提交结构化反馈。");
      return;
    }
    if (!executionStatus) {
      setValidationMessage("请先选择今晚做了没有。");
      return;
    }
    if (!childReaction) {
      setValidationMessage("请先选择孩子反应怎样。");
      return;
    }
    if (!improvementStatus) {
      setValidationMessage("请先选择有没有更好一点。");
      return;
    }

    setValidationMessage(null);
    onSubmit({
      childId,
      executionStatus,
      executionCount:
        executionStatus === "not_started" ? undefined : executionCount ?? 1,
      executorRole,
      childReaction,
      improvementStatus,
      barriers,
      notes: notes.trim(),
      relatedTaskId: activeTask?.taskId,
      relatedConsultationId:
        interventionCard.consultationId ?? consultation?.consultationId,
      interventionCardId: interventionCard.id,
      attachments: {},
    });

    setExecutionStatus(null);
    setExecutionCount(1);
    setChildReaction(null);
    setImprovementStatus(null);
    setExecutorRole("parent");
    setBarriers([]);
    setNotes("");
    setShowDetails(false);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-100 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {activeTask ? <Badge variant="info">已关联今晚任务</Badge> : null}
          {interventionCard?.consultationId || consultation ? (
            <Badge variant="warning">已关联复查上下文</Badge>
          ) : null}
          {latestFeedback ? (
            <Badge variant="secondary">最近反馈：{latestFeedback.status}</Badge>
          ) : (
            <Badge variant="secondary">今晚可提交首条结构化反馈</Badge>
          )}
          {reminderStatus ? (
            <Badge variant="outline">提醒状态：{reminderStatus}</Badge>
          ) : null}
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-900">
          {interventionCard?.title ?? "当前暂无可提交反馈的干预卡"}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {interventionCard?.tonightHomeAction ??
            "请先生成或选择当前干预卡，提交按钮会在有上下文后启用。"}
        </p>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          48 小时内复查：{reviewLabel}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-100 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">今晚做了没有</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {EXECUTION_STATUS_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={executionStatus === option.value ? "premium" : "outline"}
                className="rounded-full"
                onClick={() => {
                  setExecutionStatus(option.value);
                  setExecutionCount((current) =>
                    option.value === "not_started" ? undefined : current ?? 1
                  );
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
          {executionStatus && executionStatus !== "not_started" ? (
            <div className="mt-4">
              <p className="text-xs font-medium tracking-[0.14em] text-slate-400">
                执行次数
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {EXECUTION_COUNT_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={executionCount === option.value ? "premium" : "outline"}
                    className="rounded-full"
                    onClick={() => setExecutionCount(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">孩子反应怎样</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CHILD_REACTION_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={childReaction === option.value ? "premium" : "outline"}
                className="rounded-full"
                onClick={() => setChildReaction(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">有没有更好一点</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {IMPROVEMENT_STATUS_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={improvementStatus === option.value ? "premium" : "outline"}
                className="rounded-full"
                onClick={() => setImprovementStatus(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">补充更多情况</p>
            <p className="mt-1 text-sm text-slate-600">
              障碍、执行人、补充说明都放在第二层，不打断第一步快速反馈。
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => setShowDetails((current) => !current)}
          >
            {showDetails ? "收起补充" : "补充更多"}
          </Button>
        </div>

        {showDetails ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-3xl border border-white/80 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">谁来执行</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {EXECUTOR_ROLE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={executorRole === option.value ? "premium" : "outline"}
                    className="rounded-full"
                    onClick={() => setExecutorRole(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/80 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">遇到哪些障碍</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {BARRIER_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={barriers.includes(option) ? "premium" : "outline"}
                    className="rounded-full"
                    onClick={() => setBarriers((current) => toggleBarrier(current, option))}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/80 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">补充说明</p>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="补充今晚的场景、持续时间、孩子状态，或 OCR 草稿里的细节。"
                className="mt-3 min-h-28 bg-white"
              />
            </div>

            <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">附件补充</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                语音和图片补充将在后续任务接入。本轮先保留结构化字段与占位入口，不上传文件。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="rounded-full" disabled>
                  语音补充 即将支持
                </Button>
                <Button type="button" variant="outline" className="rounded-full" disabled>
                  图片补充 即将支持
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {feedbackPrompt ?? "提交后，下一轮 follow-up 会自动带上这条结构化反馈。"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            数据会先进入 canonical feedback shape，再自动镜像 legacy 兼容字段。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onSnoozeReminder ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={onSnoozeReminder}
            >
              稍后提醒
            </Button>
          ) : null}
          <Button
            type="button"
            className="rounded-xl"
            onClick={handleSubmit}
            disabled={!interventionCard}
          >
            提交今晚反馈
          </Button>
        </div>
      </div>

      {composerMessage ? (
        <p className="text-sm text-slate-600">{composerMessage}</p>
      ) : null}
    </div>
  );
}
