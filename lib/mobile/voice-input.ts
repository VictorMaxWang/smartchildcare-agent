import type { MobileDraft } from "@/lib/ai/types";
import { createMobileDraft } from "@/lib/mobile/local-draft-cache";
import type { VoiceUploadResponse } from "@/lib/mobile/voice-assistant-upload";

export function buildMockVoiceDraft(params: {
  childId: string;
  targetRole: MobileDraft["targetRole"];
  childName: string;
  scenario: "teacher-observation" | "parent-feedback";
}): MobileDraft {
  const transcript =
    params.scenario === "teacher-observation"
      ? `${params.childName} 今天晨检后情绪偏低，午睡前需要再看一次体温和饮水，先记成重点观察。`
      : `${params.childName} 今晚先执行了补水和安抚动作，孩子一开始有点抗拒，后面配合度有所提升。`;

  return createMobileDraft({
    childId: params.childId,
    draftType: "voice",
    targetRole: params.targetRole,
    content: transcript,
    structuredPayload: {
      transcript,
      scenario: params.scenario,
      source: "mock-voice",
    },
  });
}

export function buildVoiceDraftFromUpload(params: {
  childId: string;
  childName?: string;
  targetRole: MobileDraft["targetRole"];
  response: VoiceUploadResponse;
  recordingMeta: {
    durationMs: number;
    mimeType: string;
    fileName: string;
    size: number;
    scene: "teacher-global-fab";
  };
}) {
  const transcript = params.response.transcript?.trim() || params.response.draftContent.trim();

  return createMobileDraft({
    childId: params.childId,
    draftType: "voice",
    targetRole: params.targetRole,
    content: params.response.draftContent,
    attachmentName: params.response.attachmentName,
    structuredPayload: {
      transcript,
      childName: params.childName,
      assetId: params.response.assetId,
      provider: params.response.provider,
      source: params.response.source,
      uploadStatus: params.response.status,
      nextAction: params.response.nextAction ?? "none",
      recordingMeta: params.recordingMeta,
    },
  });
}

export function getVoiceDraftSyncStatus(response: VoiceUploadResponse) {
  if (response.status === "failed") return "failed" as const;
  if (response.status === "processing") return "local_pending" as const;
  return "synced" as const;
}
