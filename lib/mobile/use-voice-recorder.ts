"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceRecorderSupportState = "checking" | "supported" | "unsupported";
export type VoiceRecorderPermissionState = "unknown" | "granted" | "denied";

export interface VoiceRecordingResult {
  blob: Blob;
  file: File;
  durationMs: number;
  mimeType: string;
  size: number;
}

const MIME_TYPE_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
] as const;

function resolveSupportedMimeType() {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
    return "";
  }

  const mediaRecorderConstructor = window.MediaRecorder;
  const supportedMimeType = MIME_TYPE_CANDIDATES.find((candidate) =>
    typeof mediaRecorderConstructor.isTypeSupported === "function"
      ? mediaRecorderConstructor.isTypeSupported(candidate)
      : false
  );

  return supportedMimeType ?? "";
}

function createRecordingFile(blob: Blob, fileNameBase: string, mimeType: string) {
  const safeFileNameBase = fileNameBase.trim() || "teacher-voice-note";
  const extension =
    mimeType.includes("mp4") ? "m4a" : mimeType.includes("mpeg") ? "mp3" : "webm";

  return new File([blob], `${safeFileNameBase}.${extension}`, {
    type: mimeType || blob.type || "audio/webm",
    lastModified: Date.now(),
  });
}

function toRecorderErrorMessage(error: unknown) {
  if (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "SecurityError")
  ) {
    return "microphone_permission_denied";
  }

  if (
    error instanceof DOMException &&
    (error.name === "NotFoundError" || error.name === "DevicesNotFoundError")
  ) {
    return "microphone_not_found";
  }

  if (
    error instanceof DOMException &&
    (error.name === "NotReadableError" || error.name === "TrackStartError")
  ) {
    return "microphone_not_readable";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "voice_recorder_unknown_error";
}

function getInitialSupportState(): VoiceRecorderSupportState {
  if (typeof window === "undefined") {
    return "checking";
  }

  const isSupported =
    typeof window.MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function";

  return isSupported ? "supported" : "unsupported";
}

export function useVoiceRecorder() {
  const [supportState] = useState<VoiceRecorderSupportState>(getInitialSupportState);
  const [permissionState, setPermissionState] = useState<VoiceRecorderPermissionState>("unknown");
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [mimeType, setMimeType] = useState(() =>
    typeof window === "undefined" ? "" : resolveSupportedMimeType()
  );
  const [lastError, setLastError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const pendingFileNameRef = useRef("teacher-voice-note");
  const stopResolverRef = useRef<((result: VoiceRecordingResult | null) => void) | null>(null);
  const discardOnStopRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseMediaStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const resetRecorderState = useCallback(() => {
    clearTimer();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    startedAtRef.current = 0;
    discardOnStopRef.current = false;
    setDurationMs(0);
    setIsRecording(false);
    releaseMediaStream();
  }, [clearTimer, releaseMediaStream]);

  useEffect(() => {
    return () => {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore teardown stop errors.
        }
      }
      resetRecorderState();
    };
  }, [resetRecorderState]);

  const startRecording = useCallback(
    async (fileNameBase = "teacher-voice-note") => {
      if (supportState !== "supported") {
        throw new Error("voice_recorder_not_supported");
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        return;
      }

      pendingFileNameRef.current = fileNameBase;
      setLastError(null);
      chunksRef.current = [];
      discardOnStopRef.current = false;
      setDurationMs(0);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        setPermissionState("granted");

        const nextMimeType = resolveSupportedMimeType();
        const recorder = nextMimeType
          ? new MediaRecorder(stream, { mimeType: nextMimeType })
          : new MediaRecorder(stream);

        mediaRecorderRef.current = recorder;
        setMimeType(recorder.mimeType || nextMimeType || "audio/webm");

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        recorder.onerror = () => {
          setLastError("voice_recorder_stream_error");
        };

        recorder.onstop = () => {
          const elapsedMs = startedAtRef.current ? Date.now() - startedAtRef.current : durationMs;
          const mergedBlob = new Blob(chunksRef.current, {
            type: recorder.mimeType || nextMimeType || "audio/webm",
          });
          const shouldDiscard = discardOnStopRef.current || mergedBlob.size === 0;

          const result = shouldDiscard
            ? null
            : {
                blob: mergedBlob,
                file: createRecordingFile(
                  mergedBlob,
                  pendingFileNameRef.current,
                  recorder.mimeType || nextMimeType || "audio/webm"
                ),
                durationMs: elapsedMs,
                mimeType: recorder.mimeType || nextMimeType || "audio/webm",
                size: mergedBlob.size,
              } satisfies VoiceRecordingResult;

          stopResolverRef.current?.(result);
          stopResolverRef.current = null;
          resetRecorderState();
        };

        startedAtRef.current = Date.now();
        setIsRecording(true);
        recorder.start(200);

        timerRef.current = window.setInterval(() => {
          if (!startedAtRef.current) return;
          setDurationMs(Date.now() - startedAtRef.current);
        }, 120);
      } catch (error) {
        const nextError = toRecorderErrorMessage(error);
        if (nextError === "microphone_permission_denied") {
          setPermissionState("denied");
        }
        releaseMediaStream();
        setIsRecording(false);
        setLastError(nextError);
        throw new Error(nextError);
      }
    },
    [durationMs, releaseMediaStream, resetRecorderState, supportState]
  );

  const stopRecording = useCallback(async () => {
    const activeRecorder = mediaRecorderRef.current;

    if (!activeRecorder || activeRecorder.state === "inactive") {
      return null;
    }

    return new Promise<VoiceRecordingResult | null>((resolve) => {
      stopResolverRef.current = resolve;

      try {
        activeRecorder.stop();
      } catch {
        stopResolverRef.current = null;
        resolve(null);
        resetRecorderState();
      }
    });
  }, [resetRecorderState]);

  const cancelRecording = useCallback(async () => {
    discardOnStopRef.current = true;
    return stopRecording();
  }, [stopRecording]);

  return {
    supportState,
    permissionState,
    isRecording,
    durationMs,
    mimeType,
    lastError,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
