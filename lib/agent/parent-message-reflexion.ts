import type {
  ChildSuggestionSnapshot,
  ParentMessageReflexionRequest,
  ParentMessageReflexionResponse,
} from "@/lib/ai/types";
import type {
  ParentAgentChildContext,
  ParentAgentResult,
  ParentMessageMeta,
} from "@/lib/agent/parent-agent";

function uniqueItems(items: Array<string | null | undefined>, limit = 4) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const normalized = item?.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }

  return result;
}

function buildParentMessageMeta(
  response: ParentMessageReflexionResponse
): ParentMessageMeta {
  return {
    revisionCount: response.revisionCount,
    score: response.evaluationMeta.score,
    canSend: response.evaluationMeta.canSend,
    fallback: response.fallback || response.evaluationMeta.fallback,
    stopReason: response.evaluationMeta.stopReason,
    source: response.source,
    model: response.model ?? undefined,
  };
}

function buildAssistantAnswer(
  response: ParentMessageReflexionResponse,
  fallbackTopAction: string
) {
  const topAction =
    response.finalOutput.tonightActions[0]?.trim() || fallbackTopAction;
  const actionLines = uniqueItems(response.finalOutput.tonightActions, 4).map(
    (item, index) => `${index + 1}. ${item}`
  );

  return [
    response.finalOutput.wordingForParent,
    "",
    `Why it matters: ${response.finalOutput.whyThisMatters}`,
    `Tonight's top action: ${topAction}`,
    "",
    "Tonight actions:",
    ...(actionLines.length > 0 ? actionLines : [`1. ${fallbackTopAction}`]),
    "",
    `Follow-up window: ${response.finalOutput.followUpWindow}`,
    `Estimated time: ${response.finalOutput.estimatedTime}`,
  ].join("\n");
}

export function buildParentMessageReflexionPayload(params: {
  context: ParentAgentChildContext;
  snapshot: ChildSuggestionSnapshot;
  result: ParentAgentResult;
}): ParentMessageReflexionRequest {
  const { context, snapshot, result } = params;
  const todayInSchoolActions = uniqueItems([
    result.interventionCard.todayInSchoolAction,
    ...(result.consultation?.todayInSchoolActions ?? []),
    result.consultation?.schoolAction,
  ]);
  const tonightHomeActions = uniqueItems([
    result.tonightTopAction,
    ...result.homeSteps,
    ...result.interventionCard.homeSteps,
    ...(result.consultation?.tonightAtHomeActions ?? []),
    result.consultation?.homeAction,
  ]);

  return {
    targetChildId: context.child.id,
    teacherNote:
      context.teacherSuggestionSummary ??
      result.interventionCard.teacherFollowupDraft ??
      result.summary,
    issueSummary: uniqueItems(
      [
        result.summary,
        result.interventionCard.triggerReason,
        ...context.focusReasons,
      ],
      2
    ).join("; "),
    currentInterventionCard:
      result.interventionCard as unknown as Record<string, unknown>,
    latestGuardianFeedback: context.latestFeedback
      ? ({
          date: context.latestFeedback.date,
          status: context.latestFeedback.status,
          content: context.latestFeedback.content,
          executed: context.latestFeedback.executed,
          childReaction: context.latestFeedback.childReaction,
          improved: context.latestFeedback.improved,
          freeNote: context.latestFeedback.freeNote,
        } satisfies Record<string, unknown>)
      : null,
    todayInSchoolActions,
    tonightHomeActions,
    snapshot: snapshot as unknown as Record<string, unknown>,
    visibleChildren: [
      {
        id: context.child.id,
        name: context.child.name,
        className: context.child.className,
      },
    ],
    debugMemory: false,
    debugLoop: false,
  };
}

export function mergeParentMessageReflexionResult(params: {
  baseResult: ParentAgentResult;
  response: ParentMessageReflexionResponse;
}): ParentAgentResult {
  const { baseResult, response } = params;
  const mergedHomeSteps = uniqueItems([
    ...response.finalOutput.tonightActions,
    ...baseResult.homeSteps,
  ]);
  const tonightTopAction = mergedHomeSteps[0] ?? baseResult.tonightTopAction;
  const nextReviewWindow =
    response.finalOutput.followUpWindow.trim() ||
    baseResult.interventionCard.reviewIn48h;
  const nextTitle = response.finalOutput.title.trim() || baseResult.title;
  const nextSummary =
    response.finalOutput.summary.trim() || baseResult.summary;

  return {
    ...baseResult,
    title: nextTitle,
    summary: nextSummary,
    tonightTopAction,
    whyNow: response.finalOutput.whyThisMatters.trim() || baseResult.whyNow,
    homeSteps:
      mergedHomeSteps.length > 0 ? mergedHomeSteps : baseResult.homeSteps,
    interventionCard: {
      ...baseResult.interventionCard,
      title: response.finalOutput.title.trim() || baseResult.interventionCard.title,
      summary: nextSummary,
      tonightHomeAction:
        response.finalOutput.tonightActions[0]?.trim() ||
        baseResult.interventionCard.tonightHomeAction,
      homeSteps:
        mergedHomeSteps.length > 0
          ? mergedHomeSteps
          : baseResult.interventionCard.homeSteps,
      reviewIn48h: nextReviewWindow,
      parentMessageDraft:
        response.finalOutput.wordingForParent.trim() ||
        baseResult.interventionCard.parentMessageDraft,
    },
    assistantAnswer: buildAssistantAnswer(response, tonightTopAction),
    highlights: uniqueItems([
      response.finalOutput.whyThisMatters,
      ...baseResult.highlights,
    ]),
    parentMessageMeta: buildParentMessageMeta(response),
  };
}
