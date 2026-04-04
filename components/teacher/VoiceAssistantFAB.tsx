"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import {
  AlertTriangle,
  AudioLines,
  CheckCircle2,
  LoaderCircle,
  Mic,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { VoiceUploadResponse } from "@/lib/mobile/voice-assistant-upload";
import { cn } from "@/lib/utils";

export type VoiceAssistantFabStatus =
  | "unsupported"
  | "idle"
  | "requesting_permission"
  | "press_arming"
  | "recording"
  | "stopping"
  | "too_short"
  | "uploading"
  | "processing"
  | "success"
  | "error";

export interface VoiceAssistantFabChildOption {
  id: string;
  name: string;
  className: string;
}

export interface VoiceAssistantFabResult {
  response: VoiceUploadResponse;
  durationMs: number;
  fileName: string;
  mimeType: string;
  size: number;
}

interface VoiceAssistantFABProps {
  status: VoiceAssistantFabStatus;
  durationMs: number;
  statusLabel: string;
  statusHint: string;
  disabled?: boolean;
  result: VoiceAssistantFabResult | null;
  childOptions: VoiceAssistantFabChildOption[];
  selectedChildId: string;
  onSelectedChildChange: (childId: string) => void;
  onPointerStart: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerEnd: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onKeyboardToggle: () => void;
  onRetry: () => void;
  onCloseResult: () => void;
  onSaveDraft: () => void;
  onSaveAndContinue?: (nextAction: "teacher-agent" | "high-risk-consultation") => void;
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

function getNextActionLabel(nextAction: VoiceUploadResponse["nextAction"]) {
  if (nextAction === "teacher-agent") {
    return "保存并前往教师 AI 助手";
  }
  if (nextAction === "high-risk-consultation") {
    return "保存并前往高风险会诊";
  }
  return null;
}

function getButtonTone(status: VoiceAssistantFabStatus) {
  if (status === "unsupported") {
    return "border-slate-300 bg-slate-300/70 text-slate-500 shadow-none";
  }
  if (status === "error") {
    return "border-rose-200 bg-linear-to-br from-rose-500 via-orange-500 to-amber-400 text-white shadow-[0_18px_42px_rgba(244,63,94,0.32)]";
  }
  if (status === "recording" || status === "stopping") {
    return "border-fuchsia-200 bg-linear-to-br from-indigo-600 via-fuchsia-500 to-sky-400 text-white shadow-[0_24px_54px_rgba(99,102,241,0.35)]";
  }
  if (status === "uploading" || status === "processing") {
    return "border-sky-200 bg-linear-to-br from-slate-900 via-indigo-700 to-sky-500 text-white shadow-[0_22px_50px_rgba(15,23,42,0.34)]";
  }
  if (status === "success") {
    return "border-emerald-200 bg-linear-to-br from-emerald-500 via-teal-500 to-sky-400 text-white shadow-[0_22px_50px_rgba(16,185,129,0.3)]";
  }
  if (status === "too_short") {
    return "border-amber-200 bg-linear-to-br from-amber-400 via-orange-400 to-rose-400 text-white shadow-[0_22px_50px_rgba(251,191,36,0.3)]";
  }
  return "border-indigo-200 bg-linear-to-br from-indigo-500 via-violet-500 to-sky-400 text-white shadow-[0_22px_50px_rgba(99,102,241,0.3)]";
}

function renderFabIcon(status: VoiceAssistantFabStatus) {
  if (status === "uploading" || status === "processing" || status === "requesting_permission") {
    return <LoaderCircle className="h-6 w-6 animate-spin" />;
  }
  if (status === "success") {
    return <CheckCircle2 className="h-6 w-6" />;
  }
  if (status === "error") {
    return <AlertTriangle className="h-6 w-6" />;
  }
  if (status === "recording" || status === "stopping") {
    return <AudioLines className="h-6 w-6" />;
  }
  return <Mic className="h-6 w-6" />;
}

export default function VoiceAssistantFAB({
  status,
  durationMs,
  statusLabel,
  statusHint,
  disabled,
  result,
  childOptions,
  selectedChildId,
  onSelectedChildChange,
  onPointerStart,
  onPointerEnd,
  onPointerCancel,
  onKeyboardToggle,
  onRetry,
  onCloseResult,
  onSaveDraft,
  onSaveAndContinue,
}: VoiceAssistantFABProps) {
  const nextActionLabel = getNextActionLabel(result?.response.nextAction);
  const canContinue =
    result?.response.nextAction === "teacher-agent" ||
    result?.response.nextAction === "high-risk-consultation";

  return (
    <>
      <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-50 flex max-w-[min(16rem,calc(100vw-2rem))] flex-col items-end gap-3 sm:right-6">
        <div className="pointer-events-auto max-w-full rounded-[26px] border border-white/70 bg-white/88 px-4 py-3 shadow-[0_16px_48px_rgba(15,23,42,0.14)] backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <Badge
              variant={
                status === "error"
                  ? "warning"
                  : status === "success"
                    ? "success"
                    : status === "unsupported"
                      ? "secondary"
                      : "info"
              }
              className="gap-1"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI 语音
            </Badge>
            <p className="truncate text-sm font-semibold text-slate-900">{statusLabel}</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">{statusHint}</p>
        </div>

        {status === "error" ? (
          <Button
            type="button"
            variant="secondary"
            className="pointer-events-auto min-h-10 rounded-full px-4"
            onClick={onRetry}
          >
            重新尝试
          </Button>
        ) : null}

        <button
          type="button"
          aria-label={`${statusLabel}，${statusHint}`}
          aria-disabled={disabled}
          aria-pressed={status === "recording"}
          className={cn(
            "voice-assistant-fab pointer-events-auto relative flex h-[5.5rem] w-[5.5rem] items-center justify-center overflow-hidden rounded-full border transition-all duration-300",
            getButtonTone(status),
            disabled ? "cursor-not-allowed opacity-90" : "cursor-pointer"
          )}
          disabled={disabled}
          onPointerDown={onPointerStart}
          onPointerUp={onPointerEnd}
          onPointerLeave={status === "recording" ? onPointerCancel : undefined}
          onPointerCancel={onPointerCancel}
          onKeyDown={(event) => {
            if (event.repeat) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onKeyboardToggle();
            }
          }}
          onClick={(event) => {
            event.preventDefault();
          }}
        >
          <span className="voice-assistant-glow" aria-hidden="true" />
          <span className="voice-assistant-wave voice-assistant-wave-delay-0" aria-hidden="true" />
          <span className="voice-assistant-wave voice-assistant-wave-delay-1" aria-hidden="true" />
          <span className="voice-assistant-wave voice-assistant-wave-delay-2" aria-hidden="true" />
          <span className="relative z-10 flex flex-col items-center justify-center gap-1">
            {renderFabIcon(status)}
            <span className="text-[11px] font-semibold tracking-[0.08em] text-white/95">
              {status === "recording" ||
              status === "stopping" ||
              status === "uploading" ||
              status === "processing"
                ? formatDuration(durationMs)
                : status === "success"
                  ? "已完成"
                  : status === "error"
                    ? "重试"
                    : "按住说"}
            </span>
          </span>
        </button>

        <div className="sr-only" aria-live="polite">
          {statusLabel}，{statusHint}
        </div>
      </div>

      <Dialog open={Boolean(result)} onOpenChange={(open) => (!open ? onCloseResult() : undefined)}>
        <DialogContent className="left-0 right-0 top-auto w-full max-w-none translate-x-0 translate-y-0 rounded-t-[28px] rounded-b-none border-x-0 border-b-0 px-0 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-0 sm:right-auto sm:left-[50%] sm:top-[50%] sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[28px] sm:border">
          {result ? (
            <div className="overflow-hidden">
              <div className="voice-assistant-sheet-header px-6 py-5">
                <DialogHeader>
                  <DialogTitle className="text-xl text-slate-950">语音采集已完成</DialogTitle>
                  <DialogDescription className="mt-2 text-sm leading-6 text-slate-600">
                    当前只打通“采集 + 上传 + 草稿入口”，后续可直接衔接教师 Agent 或高风险会诊流。
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="space-y-5 px-6 pt-5">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={result.response.source === "mock" ? "warning" : "success"}>
                    {result.response.source === "mock" ? "Mock Fallback" : "Upload API"}
                  </Badge>
                  <Badge
                    variant={
                      result.response.status === "processing"
                        ? "info"
                        : result.response.status === "failed"
                          ? "warning"
                          : "success"
                    }
                  >
                    状态：{result.response.status}
                  </Badge>
                  {result.response.provider ? (
                    <Badge variant="secondary">Provider：{result.response.provider}</Badge>
                  ) : null}
                </div>

                <div className="rounded-[24px] border border-slate-100 bg-slate-50/70 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        文件
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{result.fileName}</p>
                      <p className="mt-1 text-xs text-slate-500">{result.mimeType}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                        录音信息
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {formatDuration(result.durationMs)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{formatFileSize(result.size)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">归属儿童</p>
                  <Select value={selectedChildId} onValueChange={onSelectedChildChange}>
                    <SelectTrigger className="min-h-12 rounded-2xl bg-white">
                      <SelectValue placeholder="选择要保存到哪位幼儿" />
                    </SelectTrigger>
                    <SelectContent>
                      {childOptions.map((child) => (
                        <SelectItem key={child.id} value={child.id}>
                          {child.name} · {child.className}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">转写 / 草稿预览</p>
                  <div className="rounded-[24px] border border-indigo-100 bg-indigo-50/70 p-4">
                    <p className="text-sm leading-7 text-slate-700">
                      {result.response.transcript ?? result.response.draftContent}
                    </p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/70 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">后续接口占位</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    已保留 `assetId / transcript / nextAction`，后续可直接接到教师 Agent
                    的流式结果回流。
                  </p>
                </div>

                <div className="flex flex-col gap-3 pb-1">
                  <Button type="button" variant="premium" className="min-h-12 rounded-2xl" onClick={onSaveDraft}>
                    保存为教师语音草稿
                  </Button>
                  {canContinue && nextActionLabel && onSaveAndContinue ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-12 rounded-2xl"
                      onClick={() =>
                        onSaveAndContinue(
                          result.response.nextAction as "teacher-agent" | "high-risk-consultation"
                        )
                      }
                    >
                      {nextActionLabel}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-12 rounded-2xl"
                    onClick={onCloseResult}
                  >
                    继续录音
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
