import { NextResponse } from "next/server";
import {
  buildHighRiskConsultationAutoContext,
  resolveHighRiskConsultationContexts,
  type HighRiskConsultationRequestPayload,
} from "@/lib/agent/high-risk-consultation";
import { buildInterventionCardFromConsultation } from "@/lib/agent/intervention-card";
import { buildTeacherChildSuggestionSnapshotWithMemory } from "@/lib/agent/teacher-agent";
import { maybeRunHighRiskConsultation } from "@/lib/agent/consultation/coordinator";
import { buildConsultationInputFromSnapshot } from "@/lib/agent/consultation/input";
import {
  resolveAsrProvider,
  resolveLlmProvider,
  resolveOcrProvider,
  resolveTtsProvider,
} from "@/lib/ai/providers";
import { forwardBrainRequest } from "@/lib/server/brain-client";
import { buildMemoryContextForPrompt } from "@/lib/server/memory-context";

function isRecordArray(value: unknown) {
  return Array.isArray(value);
}

function isValidPayload(payload: unknown): payload is HighRiskConsultationRequestPayload {
  if (!payload || typeof payload !== "object") return false;
  const obj = payload as Record<string, unknown>;

  return (
    typeof obj.targetChildId === "string" &&
    obj.currentUser !== null &&
    typeof obj.currentUser === "object" &&
    isRecordArray(obj.visibleChildren) &&
    isRecordArray(obj.presentChildren) &&
    isRecordArray(obj.healthCheckRecords) &&
    isRecordArray(obj.growthRecords) &&
    isRecordArray(obj.guardianFeedbacks)
  );
}

export async function POST(request: Request) {
  const proxied = await forwardBrainRequest(request, "/api/v1/agents/consultations/high-risk");
  if (proxied) return proxied;

  let payload: HighRiskConsultationRequestPayload | null = null;

  try {
    payload = (await request.json()) as HighRiskConsultationRequestPayload;
  } catch (error) {
    console.error("[AI] Invalid high-risk consultation payload", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidPayload(payload)) {
    return NextResponse.json({ error: "Invalid high-risk consultation payload" }, { status: 400 });
  }

  const { classContext, childContext } = resolveHighRiskConsultationContexts(payload);
  if (!childContext) {
    return NextResponse.json({ error: "No visible child available for consultation" }, { status: 400 });
  }

  const autoContext = buildHighRiskConsultationAutoContext({
    classContext,
    childContext,
  });
  const ocrProvider = resolveOcrProvider();
  const asrProvider = resolveAsrProvider();
  const llmProvider = resolveLlmProvider();
  const ttsProvider = resolveTtsProvider();

  const [ocrResult, asrResult] = await Promise.all([
    payload.imageInput ? ocrProvider.extract({ attachmentName: payload.imageInput.attachmentName, fallbackText: payload.imageInput.content }) : null,
    payload.voiceInput ? asrProvider.transcribe({ attachmentName: payload.voiceInput.attachmentName, fallbackText: payload.voiceInput.content }) : null,
  ]);

  const teacherSignals = [
    payload.teacherNote?.trim(),
    ocrResult?.output.text,
    asrResult?.output.transcript,
  ].filter((item): item is string => Boolean(item));
  const memoryContext = await buildMemoryContextForPrompt({
    childId: childContext.child.id,
    workflowType: "high-risk-consultation",
    query: [...autoContext.focusReasons, ...teacherSignals].join(" "),
    request,
  });
  const suggestionSnapshot = buildTeacherChildSuggestionSnapshotWithMemory(childContext, memoryContext);

  const consultationInput = buildConsultationInputFromSnapshot({
    snapshot: suggestionSnapshot,
    latestFeedback: childContext.latestFeedback
      ? {
          date: childContext.latestFeedback.date,
          status: childContext.latestFeedback.status,
          content: childContext.latestFeedback.content,
          executed: childContext.latestFeedback.executed,
          childReaction: childContext.latestFeedback.childReaction,
          improved: childContext.latestFeedback.improved,
          freeNote: childContext.latestFeedback.freeNote,
        }
      : undefined,
    focusReasons: [...autoContext.focusReasons, ...teacherSignals],
    source: "teacher",
    priorityHint: {
      level: "P1",
      score: 92,
      reason: "教师主动发起高风险会诊，需进入闭环评估。",
    },
    memoryContext,
  });

  const consultation = await maybeRunHighRiskConsultation(consultationInput);
  if (!consultation) {
    return NextResponse.json({ error: "Failed to generate consultation result" }, { status: 500 });
  }

  const llmResult = await llmProvider.generateHighRiskConsultationNarrative({
    childName: childContext.child.name,
    className: classContext.className,
    riskLevel: consultation.riskLevel,
    triggerReasons: consultation.triggerReasons,
    keyFindings: consultation.keyFindings,
    todayInSchoolActions: consultation.todayInSchoolActions,
    tonightAtHomeActions: consultation.tonightAtHomeActions,
    nextCheckpoints: consultation.nextCheckpoints,
    longTermTraits: memoryContext.promptContext.longTermTraits,
    recentContinuitySignals: memoryContext.promptContext.recentContinuitySignals,
    lastConsultationTakeaways: memoryContext.promptContext.lastConsultationTakeaways,
    openLoops: memoryContext.promptContext.openLoops,
  });
  const ttsResult = await ttsProvider.synthesize({
    text: llmResult.output.summary,
  });

  const nextConsultation = {
    ...consultation,
    summary: llmResult.output.summary,
    parentMessageDraft: llmResult.output.parentMessageDraft,
    continuityNotes: consultation.continuityNotes ?? suggestionSnapshot.continuityNotes,
    ...(process.env.NODE_ENV !== "production" || request.headers.get("x-debug-memory") === "1"
      ? { memoryMeta: consultation.memoryMeta ?? memoryContext.meta }
      : {}),
    directorDecisionCard: {
      ...consultation.directorDecisionCard,
      reason: llmResult.output.directorReason,
    },
    explainability: [
      ...consultation.explainability,
      {
        label: "教师补充",
        detail: teacherSignals.join("；") || "本次主要使用系统自动上下文发起会诊。",
      },
    ],
  };
  const interventionCard = buildInterventionCardFromConsultation({
    targetChildId: childContext.child.id,
    childName: childContext.child.name,
    consultation: nextConsultation,
    generatedAt: nextConsultation.generatedAt,
  });

  return NextResponse.json(
    {
      ...nextConsultation,
      interventionCard,
      autoContext,
      providerTrace: {
        llm: llmResult.provider,
        ocr: ocrResult?.provider ?? "unused",
        asr: asrResult?.provider ?? "unused",
        tts: ttsResult.provider,
        modes: {
          llm: llmResult.mode,
          ocr: ocrResult?.mode ?? "mock",
          asr: asrResult?.mode ?? "mock",
          tts: ttsResult.mode,
        },
      },
      audioNarrationScript: ttsResult.output.script,
      multimodalNotes: {
        imageText: ocrResult?.output.text,
        voiceText: asrResult?.output.transcript,
        teacherNote: payload.teacherNote?.trim() || "",
      },
    },
    { status: 200 }
  );
}
