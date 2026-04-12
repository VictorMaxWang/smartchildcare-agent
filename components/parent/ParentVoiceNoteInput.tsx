"use client";

import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useVoiceRecorder } from "@/lib/mobile/use-voice-recorder";
import {
  createBrowserSpeechRecognizer,
  getBrowserSpeechInputSupport,
  type BrowserSpeechRecognizerController,
  type BrowserSpeechRecognizerStatus,
} from "@/lib/voice/browser-speech-input";

interface ParentVoiceNoteInputProps {
  value: string;
  onChange: (nextValue: string) => void;
  careMode?: boolean;
  disabled?: boolean;
}

type LocalRecordingPreview = {
  durationMs: number;
  url: string;
};

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function mergeVoiceNote(currentValue: string, transcript: string) {
  const nextTranscript = transcript.trim();
  if (!nextTranscript) return currentValue;
  if (!currentValue.trim()) return nextTranscript;
  if (currentValue.includes(nextTranscript)) return currentValue;
  return `${currentValue.trim()}\n${nextTranscript}`;
}

function toRecorderMessage(errorCode: string | null) {
  switch (errorCode) {
    case "microphone_permission_denied":
      return "Local audio capture requires microphone permission.";
    case "microphone_not_found":
      return "No microphone is available on this device.";
    case "microphone_not_readable":
      return "The microphone is busy or unavailable right now.";
    case "voice_recorder_not_supported":
      return "This browser does not support local audio capture.";
    default:
      return "Local audio capture did not complete successfully.";
  }
}

export default function ParentVoiceNoteInput({
  value,
  onChange,
  careMode = false,
  disabled = false,
}: ParentVoiceNoteInputProps) {
  const [support] = useState(() => getBrowserSpeechInputSupport());
  const [recognitionStatus, setRecognitionStatus] = useState<BrowserSpeechRecognizerStatus>(() =>
    support.recognitionSupported ? "idle" : "unsupported"
  );
  const [statusMessage, setStatusMessage] = useState(() => {
    if (support.recognitionSupported) {
      return "Browser speech recognition is available. Results will be appended to notes.";
    }
    if (support.recordingSupported) {
      return "Speech recognition is unavailable here. You can still capture a local audio fallback, but it will not be transcribed.";
    }
    return "This browser supports neither speech recognition nor local audio capture.";
  });
  const [recordingPreview, setRecordingPreview] = useState<LocalRecordingPreview | null>(null);

  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const recognizerRef = useRef<BrowserSpeechRecognizerController | null>(null);
  const recorder = useVoiceRecorder();
  const displayStatusMessage = recorder.lastError ? toRecorderMessage(recorder.lastError) : statusMessage;

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!support.recognitionSupported) return;

    const controller = createBrowserSpeechRecognizer({
      onStatusChange(nextStatus) {
        setRecognitionStatus(nextStatus);
        if (nextStatus === "listening") {
          setStatusMessage("Listening in the browser. When you stop, the transcript will be appended to notes.");
          return;
        }
        if (nextStatus === "stopping") {
          setStatusMessage("Stopping recognition and finalizing the browser transcript.");
          return;
        }
        if (nextStatus === "idle") {
          setStatusMessage("Browser speech recognition is available. Results will be appended to notes.");
        }
      },
      onResult(result) {
        const nextValue = mergeVoiceNote(valueRef.current, result.transcript);
        onChangeRef.current(nextValue);
        setStatusMessage("The browser transcript was appended to notes. Please review it before submitting.");
      },
      onError(message) {
        setStatusMessage(message);
      },
    });

    recognizerRef.current = controller;

    return () => {
      controller.destroy();
      recognizerRef.current = null;
    };
  }, [support.recognitionSupported]);

  useEffect(() => {
    return () => {
      if (recordingPreview?.url) {
        URL.revokeObjectURL(recordingPreview.url);
      }
    };
  }, [recordingPreview]);

  async function handleSpeechToggle() {
    if (disabled || !support.recognitionSupported) return;
    const recognizer = recognizerRef.current;
    if (!recognizer?.supported) return;

    try {
      if (recognitionStatus === "listening") {
        recognizer.stop();
        return;
      }

      recognizer.start();
    } catch {
      setStatusMessage("Browser speech recognition could not start. Please try again.");
    }
  }

  async function handleRecordingToggle() {
    if (disabled || !support.recordingSupported) return;

    if (recorder.isRecording) {
      const result = await recorder.stopRecording();
      if (!result) {
        setStatusMessage("Local audio capture did not complete successfully.");
        return;
      }

      if (recordingPreview?.url) {
        URL.revokeObjectURL(recordingPreview.url);
      }

      setRecordingPreview({
        durationMs: result.durationMs,
        url: URL.createObjectURL(result.blob),
      });
      setStatusMessage(
        `A local audio clip was captured for ${formatDuration(result.durationMs)}. This phase does not auto-transcribe or upload it.`
      );
      return;
    }

    try {
      await recorder.startRecording("parent-voice-note");
      setStatusMessage("Capturing local audio. It will stay in the browser and will not be transcribed automatically.");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? toRecorderMessage(error.message) : "Local audio capture did not complete successfully."
      );
    }
  }

  return (
    <div className="rounded-3xl border border-white/80 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">Browser preview</Badge>
            {support.recognitionSupported ? (
              <Badge variant="secondary">Speech recognition</Badge>
            ) : support.recordingSupported ? (
              <Badge variant="outline">Local audio fallback</Badge>
            ) : (
              <Badge variant="warning">Unsupported</Badge>
            )}
          </div>
          <div>
            <p className={careMode ? "text-base font-semibold text-slate-900" : "text-sm font-semibold text-slate-900"}>
              {"\u8bed\u97f3\u53cd\u9988"}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Browser-first only. This phase does not connect to backend ASR.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {support.recognitionSupported ? (
            <Button
              type="button"
              variant={recognitionStatus === "listening" ? "secondary" : "outline"}
              className={careMode ? "min-h-11 rounded-2xl px-4 text-base" : "rounded-xl"}
              onClick={() => void handleSpeechToggle()}
              disabled={disabled}
            >
              {recognitionStatus === "listening" ? (
                <Square className="mr-2 h-4 w-4" />
              ) : (
                <Mic className="mr-2 h-4 w-4" />
              )}
              {recognitionStatus === "listening" ? "\u505c\u6b62\u6536\u542c" : "\u8bf4\u7ed9\u6211\u542c"}
            </Button>
          ) : support.recordingSupported ? (
            <Button
              type="button"
              variant={recorder.isRecording ? "secondary" : "outline"}
              className={careMode ? "min-h-11 rounded-2xl px-4 text-base" : "rounded-xl"}
              onClick={() => void handleRecordingToggle()}
              disabled={disabled}
            >
              {recorder.isRecording ? (
                <Square className="mr-2 h-4 w-4" />
              ) : (
                <Mic className="mr-2 h-4 w-4" />
              )}
              {recorder.isRecording ? "\u505c\u6b62\u5f55\u97f3" : "\u5f55\u4e00\u6bb5\u8bed\u97f3"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className={careMode ? "min-h-11 rounded-2xl px-4 text-base" : "rounded-xl"}
              disabled
            >
              <Mic className="mr-2 h-4 w-4" />
              {"\u5f53\u524d\u6d4f\u89c8\u5668\u4e0d\u652f\u6301\u8bed\u97f3"}
            </Button>
          )}
        </div>
      </div>

      <p className={careMode ? "mt-3 text-sm leading-7 text-slate-600" : "mt-3 text-sm leading-6 text-slate-600"}>
        {displayStatusMessage}
      </p>

      {recordingPreview ? (
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-900">
            Local audio preview: {formatDuration(recordingPreview.durationMs)}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            This clip stays on the current page only. It is not transcribed and not uploaded.
          </p>
          <audio controls src={recordingPreview.url} className="mt-3 w-full" />
        </div>
      ) : null}
    </div>
  );
}
