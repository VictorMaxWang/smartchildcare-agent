"use client";

import { Square, Volume2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getBrowserTtsSupport,
  speakBrowserText,
  stopBrowserTts,
  type BrowserTtsStatus,
} from "@/lib/voice/browser-tts";
import { cn } from "@/lib/utils";

interface ParentSpeakButtonProps {
  text: string;
  label?: string;
  careMode?: boolean;
  className?: string;
  variant?: "outline" | "secondary" | "premium";
}

function getStatusCopy(status: BrowserTtsStatus) {
  switch (status) {
    case "speaking":
      return "Browser TTS is speaking. You can stop it at any time.";
    case "unsupported":
      return "This browser does not support TTS yet, and no backend voice is connected in this phase.";
    case "error":
      return "Browser TTS did not finish successfully. Please try again.";
    default:
      return "Browser-only playback. This is not backend-generated voice.";
  }
}

export default function ParentSpeakButton({
  text,
  label = "\u6d4f\u89c8\u5668\u64ad\u62a5",
  careMode = false,
  className,
  variant = "outline",
}: ParentSpeakButtonProps) {
  const [status, setStatus] = useState<BrowserTtsStatus>(() =>
    getBrowserTtsSupport().supported ? "idle" : "unsupported"
  );

  function handleClick() {
    if (status === "speaking") {
      stopBrowserTts();
      return;
    }

    const didStart = speakBrowserText({
      text,
      onStatusChange: setStatus,
    });

    if (!didStart && getBrowserTtsSupport().supported) {
      setStatus("error");
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        type="button"
        variant={status === "speaking" ? "secondary" : variant}
        className={cn(careMode ? "min-h-12 rounded-2xl px-4 text-base" : "min-h-10 rounded-xl")}
        onClick={handleClick}
        aria-pressed={status === "speaking"}
        disabled={status === "unsupported"}
      >
        {status === "speaking" ? (
          <Square className="mr-2 h-4 w-4" />
        ) : (
          <Volume2 className="mr-2 h-4 w-4" />
        )}
        {status === "speaking" ? "\u505c\u6b62\u64ad\u62a5" : label}
      </Button>
      <p className={cn(careMode ? "text-sm leading-6 text-slate-600" : "text-xs leading-5 text-slate-500")}>
        {getStatusCopy(status)}
      </p>
    </div>
  );
}
