"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import VoiceAssistantFAB, {
  type VoiceAssistantFabResult,
  type VoiceAssistantFabStatus,
} from "@/components/teacher/VoiceAssistantFAB";
import {
  buildTeacherAgentClassContext,
  pickTeacherAgentDefaultChildId,
} from "@/lib/agent/teacher-agent";
import { useApp } from "@/lib/store";
import {
  buildVoiceDraftFromUpload,
  getVoiceDraftSyncStatus,
} from "@/lib/mobile/voice-input";
import { uploadTeacherVoiceCapture } from "@/lib/mobile/voice-assistant-upload";
import { useVoiceRecorder } from "@/lib/mobile/use-voice-recorder";

const LONG_PRESS_MS = 180;
const MIN_DURATION_MS = 600;
const PROCESSING_DELAY_MS = 480;

function buildStatusHint(params: {
  status: VoiceAssistantFabStatus;
  supportState: ReturnType<typeof useVoiceRecorder>["supportState"];
  errorMessage: string | null;
}) {
  if (params.supportState === "checking") {
    return {
      label: "检查设备中",
      hint: "正在确认当前浏览器是否支持语音采集。",
    };
  }

  switch (params.status) {
    case "unsupported":
      return {
        label: "暂不支持",
        hint: "当前浏览器不支持 MediaRecorder 或麦克风调用。",
      };
    case "press_arming":
      return {
        label: "继续按住",
        hint: "保持按压约 0.2 秒后开始录音，避免误触。",
      };
    case "requesting_permission":
      return {
        label: "请求权限中",
        hint: "请允许麦克风权限，授权后会立即开始录音。",
      };
    case "recording":
      return {
        label: "录音中",
        hint: "松开手指即可结束，滑出按钮区域会取消本次录音。",
      };
    case "stopping":
      return {
        label: "正在收尾",
        hint: "正在整理音频片段并生成可上传文件。",
      };
    case "too_short":
      return {
        label: "录音太短",
        hint: "请至少说满 0.6 秒，让系统生成有效语音草稿。",
      };
    case "uploading":
      return {
        label: "上传中",
        hint: "正在把音频发送到教师端语音上传接口。",
      };
    case "processing":
      return {
        label: "识别中",
        hint: "当前先走 mock / fallback 转写壳，稍后可直接接入 Agent 回流。",
      };
    case "success":
      return {
        label: "上传完成",
        hint: "可以把这条语音保存为教师草稿，或继续前往下一条工作流。",
      };
    case "error":
      return {
        label: "采集失败",
        hint: params.errorMessage ?? "录音或上传没有完成，请点击重试后重新说一遍。",
      };
    default:
      return {
        label: "长按说话",
        hint: "像手机 AI 助手一样长按录音，松开结束并生成上传入口。",
      };
  }
}

function buildRecorderErrorMessage(errorCode: string | null) {
  if (!errorCode) return null;
  if (errorCode === "microphone_permission_denied") {
    return "麦克风权限被拒绝，请在浏览器设置里允许访问。";
  }
  if (errorCode === "microphone_not_found") {
    return "当前设备没有可用的麦克风。";
  }
  if (errorCode === "microphone_not_readable") {
    return "麦克风当前不可用，可能被别的应用占用。";
  }
  if (errorCode === "voice_recorder_not_supported") {
    return "当前浏览器不支持语音录制。";
  }
  return "录音没有成功开始，请重试。";
}

export default function TeacherVoiceAssistantLayer() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    currentUser,
    visibleChildren,
    presentChildren,
    healthCheckRecords,
    growthRecords,
    guardianFeedbacks,
    saveMobileDraft,
    markMobileDraftSyncStatus,
  } = useApp();
  const recorder = useVoiceRecorder();

  const [status, setStatus] = useState<VoiceAssistantFabStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<VoiceAssistantFabResult | null>(null);
  const [resultChildId, setResultChildId] = useState("");

  const armingTimerRef = useRef<number | null>(null);
  const processingTimerRef = useRef<number | null>(null);
  const pointerPressedRef = useRef(false);
  const previousPathRef = useRef(pathname);
  const asyncFlowRef = useRef(0);

  const classContext = useMemo(
    () =>
      currentUser.role === "教师"
        ? buildTeacherAgentClassContext({
            currentUser,
            visibleChildren,
            presentChildren,
            healthCheckRecords,
            growthRecords,
            guardianFeedbacks,
          })
        : null,
    [
      currentUser,
      guardianFeedbacks,
      growthRecords,
      healthCheckRecords,
      presentChildren,
      visibleChildren,
    ]
  );

  const defaultChildId = useMemo(
    () =>
      classContext
        ? pickTeacherAgentDefaultChildId(classContext) ?? visibleChildren[0]?.id ?? ""
        : visibleChildren[0]?.id ?? "",
    [classContext, visibleChildren]
  );

  const childOptions = useMemo(
    () =>
      visibleChildren.map((child) => ({
        id: child.id,
        name: child.name,
        className: child.className,
      })),
    [visibleChildren]
  );

  const isTeacherReady = currentUser.role === "教师";
  const disabled =
    !isTeacherReady ||
    visibleChildren.length === 0 ||
    recorder.supportState === "checking" ||
    recorder.supportState === "unsupported";
  const effectiveStatus =
    recorder.supportState === "unsupported" ? "unsupported" : status;
  const selectedResultChildId =
    resultChildId && visibleChildren.some((child) => child.id === resultChildId)
      ? resultChildId
      : defaultChildId;

  const clearArmingTimer = useCallback(() => {
    if (armingTimerRef.current !== null) {
      window.clearTimeout(armingTimerRef.current);
      armingTimerRef.current = null;
    }
  }, []);

  const clearProcessingTimer = useCallback(() => {
    if (processingTimerRef.current !== null) {
      window.clearTimeout(processingTimerRef.current);
      processingTimerRef.current = null;
    }
  }, []);

  const resetToIdle = useCallback(() => {
    asyncFlowRef.current += 1;
    clearArmingTimer();
    clearProcessingTimer();
    pointerPressedRef.current = false;
    setErrorMessage(null);
    setStatus("idle");
  }, [clearArmingTimer, clearProcessingTimer]);

  useEffect(() => {
    return () => {
      clearArmingTimer();
      clearProcessingTimer();
    };
  }, [clearArmingTimer, clearProcessingTimer]);

  const cancelCapture = useCallback(async () => {
    asyncFlowRef.current += 1;
    clearArmingTimer();
    clearProcessingTimer();
    pointerPressedRef.current = false;

    if (recorder.isRecording) {
      await recorder.cancelRecording();
    }

    setErrorMessage(null);
    setStatus("idle");
  }, [clearArmingTimer, clearProcessingTimer, recorder]);

  useEffect(() => {
    if (previousPathRef.current === pathname) {
      return;
    }

    previousPathRef.current = pathname;

    if (
      status === "press_arming" ||
      status === "requesting_permission" ||
      status === "recording" ||
      status === "stopping" ||
      status === "uploading" ||
      status === "processing"
    ) {
      const timeoutId = window.setTimeout(() => {
        void cancelCapture();
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }
  }, [cancelCapture, pathname, status]);

  const beginRecording = useCallback(
    async (trigger: "pointer" | "keyboard") => {
      if (disabled) {
        return;
      }

      clearArmingTimer();
      setErrorMessage(null);
      setStatus("requesting_permission");

      try {
        const fileNameBase = `teacher-voice-${new Date().toISOString().replace(/[:.]/g, "-")}`;
        await recorder.startRecording(fileNameBase);

        if (trigger === "pointer" && !pointerPressedRef.current) {
          await recorder.cancelRecording();
          setStatus("idle");
          return;
        }

        setStatus("recording");
      } catch (error) {
        const nextError =
          buildRecorderErrorMessage(error instanceof Error ? error.message : recorder.lastError) ??
          "麦克风没有准备好，请重试。";
        setErrorMessage(nextError);
        setStatus("error");
        toast.error(nextError);
      }
    },
    [clearArmingTimer, disabled, recorder]
  );

  const finishRecording = useCallback(async () => {
    if (!recorder.isRecording) {
      setStatus("idle");
      return;
    }

    setStatus("stopping");

    try {
      const captureResult = await recorder.stopRecording();
      const requestId = ++asyncFlowRef.current;

      if (!captureResult) {
        setErrorMessage("没有采集到有效语音，请重试。");
        setStatus("error");
        toast.error("没有采集到有效语音，请重试。");
        return;
      }

      if (captureResult.durationMs < MIN_DURATION_MS) {
        setStatus("too_short");
        toast.warning("录音太短，请至少说满 0.6 秒。");
        clearProcessingTimer();
        processingTimerRef.current = window.setTimeout(() => {
          if (asyncFlowRef.current !== requestId) return;
          setStatus("idle");
        }, 1200);
        return;
      }

      setStatus("uploading");

      const targetChildId = selectedResultChildId;
      const uploadResponse = await uploadTeacherVoiceCapture({
        file: captureResult.file,
        targetRole: "teacher",
        childId: targetChildId || undefined,
        scene: "teacher-global-fab",
        durationMs: captureResult.durationMs,
        mimeType: captureResult.mimeType,
      });

      if (asyncFlowRef.current !== requestId) {
        return;
      }

      if (uploadResponse.status === "failed") {
        const nextError =
          typeof uploadResponse.raw?.error === "string"
            ? uploadResponse.raw.error
            : "语音上传失败，请稍后重试。";
        setErrorMessage(nextError);
        setStatus("error");
        toast.error(nextError);
        return;
      }

      setResultChildId(targetChildId);
      setStatus("processing");

      clearProcessingTimer();
      processingTimerRef.current = window.setTimeout(() => {
        if (asyncFlowRef.current !== requestId) return;
        setResult({
          response: uploadResponse,
          durationMs: captureResult.durationMs,
          fileName: captureResult.file.name,
          mimeType: captureResult.mimeType,
          size: captureResult.size,
        });
        setStatus("success");
      }, PROCESSING_DELAY_MS);
    } catch (error) {
      const nextError =
        error instanceof Error ? error.message : "语音上传失败，请稍后重试。";
      setErrorMessage(nextError);
      setStatus("error");
      toast.error(nextError);
    }
  }, [
    clearProcessingTimer,
    recorder,
    selectedResultChildId,
  ]);

  const handlePointerStart = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || effectiveStatus === "uploading" || effectiveStatus === "processing") {
        if (!isTeacherReady || visibleChildren.length === 0) {
          toast.message("当前教师账号没有可用于保存语音草稿的班级数据。");
        }
        return;
      }

      pointerPressedRef.current = true;
      event.preventDefault();

      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Ignore pointer capture errors on unsupported browsers.
      }

      setErrorMessage(null);
      setStatus("press_arming");

      clearArmingTimer();
      armingTimerRef.current = window.setTimeout(() => {
        void beginRecording("pointer");
      }, LONG_PRESS_MS);
    },
    [
      beginRecording,
      clearArmingTimer,
      disabled,
      effectiveStatus,
      isTeacherReady,
      visibleChildren.length,
    ]
  );

  const handlePointerEnd = useCallback(
    async (event: React.PointerEvent<HTMLButtonElement>) => {
      pointerPressedRef.current = false;

      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Ignore pointer release errors.
      }

      clearArmingTimer();

      if (effectiveStatus === "press_arming") {
        setStatus("idle");
        return;
      }

      if (effectiveStatus === "recording") {
        await finishRecording();
      }
    },
    [clearArmingTimer, effectiveStatus, finishRecording]
  );

  const handlePointerCancel = useCallback(
    async (event: React.PointerEvent<HTMLButtonElement>) => {
      pointerPressedRef.current = false;

      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Ignore pointer release errors.
      }

      clearArmingTimer();

      if (effectiveStatus === "recording" || effectiveStatus === "requesting_permission") {
        await cancelCapture();
      } else if (effectiveStatus === "press_arming") {
        setStatus("idle");
      }
    },
    [cancelCapture, clearArmingTimer, effectiveStatus]
  );

  const handleKeyboardToggle = useCallback(async () => {
    if (disabled || effectiveStatus === "uploading" || effectiveStatus === "processing") {
      return;
    }

    if (effectiveStatus === "recording") {
      await finishRecording();
      return;
    }

    await beginRecording("keyboard");
  }, [beginRecording, disabled, effectiveStatus, finishRecording]);

  const closeResult = useCallback(() => {
    setResult(null);
    resetToIdle();
  }, [resetToIdle]);

  const saveVoiceDraft = useCallback(
    (destination?: "teacher-agent" | "high-risk-consultation") => {
      if (!result) {
        return;
      }

      const targetChild = visibleChildren.find((child) => child.id === selectedResultChildId);
      if (!targetChild) {
        toast.error("请先选择一位幼儿，再保存语音草稿。");
        return;
      }

      const draft = buildVoiceDraftFromUpload({
        childId: targetChild.id,
        childName: targetChild.name,
        targetRole: "teacher",
        response: result.response,
        recordingMeta: {
          durationMs: result.durationMs,
          mimeType: result.mimeType,
          fileName: result.fileName,
          size: result.size,
          scene: "teacher-global-fab",
        },
      });

      saveMobileDraft(draft);
      markMobileDraftSyncStatus(draft.draftId, getVoiceDraftSyncStatus(result.response));

      toast.success(`已保存到 ${targetChild.name} 的教师语音草稿。`);
      closeResult();

      if (destination === "teacher-agent") {
        router.push("/teacher/agent");
      }

      if (destination === "high-risk-consultation") {
        router.push("/teacher/high-risk-consultation");
      }
    },
    [
      closeResult,
      markMobileDraftSyncStatus,
      result,
      selectedResultChildId,
      router,
      saveMobileDraft,
      visibleChildren,
    ]
  );

  if (!isTeacherReady) {
    return null;
  }

  const statusCopy = buildStatusHint({
    status: effectiveStatus,
    supportState: recorder.supportState,
    errorMessage,
  });

  return (
    <VoiceAssistantFAB
      status={effectiveStatus}
      durationMs={recorder.durationMs}
      statusLabel={statusCopy.label}
      statusHint={statusCopy.hint}
      disabled={disabled}
      result={result}
      childOptions={childOptions}
      selectedChildId={selectedResultChildId}
      onSelectedChildChange={setResultChildId}
      onPointerStart={handlePointerStart}
      onPointerEnd={handlePointerEnd}
      onPointerCancel={handlePointerCancel}
      onKeyboardToggle={handleKeyboardToggle}
      onRetry={resetToIdle}
      onCloseResult={closeResult}
      onSaveDraft={() => saveVoiceDraft()}
      onSaveAndContinue={
        result?.response.nextAction === "teacher-agent" ||
        result?.response.nextAction === "high-risk-consultation"
          ? saveVoiceDraft
          : undefined
      }
    />
  );
}
