import type {
  HealthFileBridgeActionItem,
  HealthFileBridgeEscalationSuggestion,
  HealthFileBridgeFact,
  HealthFileBridgeFile,
  HealthFileBridgeFollowUpItem,
  HealthFileBridgeRequest,
  HealthFileBridgeResponse,
  HealthFileBridgeRiskItem,
  HealthFileBridgeSource,
  HealthFileBridgeWritebackSuggestion,
} from "../ai/types";

const HEALTH_FILE_BRIDGE_DISCLAIMER =
  "T7 skeleton: this bridge turns external health file context into daycare actions only. It does not perform verified OCR, diagnosis, writeback, or escalation dispatch.";

type RuleBucket =
  | "fever_or_temperature"
  | "allergy_or_medication"
  | "recheck_or_follow_up"
  | "generic_unknown";

const BUCKET_PRIORITY: RuleBucket[] = [
  "allergy_or_medication",
  "fever_or_temperature",
  "recheck_or_follow_up",
  "generic_unknown",
];

const FEVER_KEYWORDS = [
  "发热",
  "发烧",
  "体温",
  "temperature",
  "fever",
  "temp",
  "38.",
  "37.",
];

const ALLERGY_OR_MEDICATION_KEYWORDS = [
  "过敏",
  "allergy",
  "药",
  "用药",
  "处方",
  "prescription",
  "抗生素",
  "喷剂",
  "雾化",
  "medication",
  "medicine",
  "antibiotic",
  "nebulizer",
];

const FOLLOW_UP_KEYWORDS = [
  "复查",
  "复诊",
  "复测",
  "follow-up",
  "follow up",
  "recheck",
  "随访",
  "观察",
  "review",
  "revisit",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isValidFile(value: unknown): value is HealthFileBridgeFile {
  if (!isRecord(value)) return false;
  return typeof value.name === "string" && value.name.trim().length > 0;
}

export function isValidHealthFileBridgeRequest(payload: unknown): payload is HealthFileBridgeRequest {
  if (!isRecord(payload)) return false;
  if (payload.sourceRole !== "parent" && payload.sourceRole !== "teacher") return false;
  if (typeof payload.requestSource !== "string" || payload.requestSource.trim().length === 0) {
    return false;
  }
  if (!Array.isArray(payload.files) || payload.files.length === 0) return false;
  return payload.files.every(isValidFile);
}

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function safeText(value?: string | null) {
  return value?.trim() ?? "";
}

function collectSignals(request: HealthFileBridgeRequest) {
  const fileNames = request.files.map((file) => safeText(file.name)).filter(Boolean);
  const mimeTypes = request.files.map((file) => safeText(file.mimeType)).filter(Boolean);
  const previewTexts = request.files.map((file) => safeText(file.previewText)).filter(Boolean);
  const notes = safeText(request.optionalNotes);
  const haystack = normalizeText(
    [request.fileKind ?? "", ...fileNames, ...mimeTypes, ...previewTexts, notes].join(" ")
  );

  return {
    fileNames,
    previewTexts,
    notes,
    haystack,
  };
}

function hasKeyword(haystack: string, keywords: string[]) {
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function detectBuckets(haystack: string): RuleBucket[] {
  const buckets = new Set<RuleBucket>();

  if (hasKeyword(haystack, FEVER_KEYWORDS)) {
    buckets.add("fever_or_temperature");
  }
  if (hasKeyword(haystack, ALLERGY_OR_MEDICATION_KEYWORDS)) {
    buckets.add("allergy_or_medication");
  }
  if (hasKeyword(haystack, FOLLOW_UP_KEYWORDS)) {
    buckets.add("recheck_or_follow_up");
  }
  if (buckets.size === 0) {
    buckets.add("generic_unknown");
  }

  return BUCKET_PRIORITY.filter((bucket) => buckets.has(bucket));
}

function baseFacts(request: HealthFileBridgeRequest): HealthFileBridgeFact[] {
  return [
    {
      label: "Bridge mode",
      detail: `T7 skeleton received ${request.files.length} external health file(s) for daycare action bridging.`,
      source: "request-meta",
    },
    {
      label: "Source role",
      detail: `Current request came from ${request.sourceRole}.`,
      source: "request-meta",
    },
    {
      label: "Binary processing",
      detail:
        "This run uses file metadata and optional text hints only. Real OCR/PDF parsing is not executed in T7.",
      source: "request-meta",
    },
  ];
}

function bucketFacts(bucket: RuleBucket, signals: ReturnType<typeof collectSignals>): HealthFileBridgeFact[] {
  switch (bucket) {
    case "fever_or_temperature":
      return [
        {
          label: "Temperature signal",
          detail:
            "The external file context mentions fever or temperature-related information that should be rechecked in daycare.",
          source: "rule:fever_or_temperature",
        },
      ];
    case "allergy_or_medication":
      return [
        {
          label: "Allergy or medication signal",
          detail:
            "The external file context appears to include allergy or medication-related information that staff should review before routine care.",
          source: "rule:allergy_or_medication",
        },
      ];
    case "recheck_or_follow_up":
      return [
        {
          label: "Follow-up signal",
          detail:
            "The external file context mentions recheck or follow-up instructions that should be bridged into daycare reminders.",
          source: "rule:recheck_or_follow_up",
        },
      ];
    case "generic_unknown":
    default:
      return [
        {
          label: "Manual bridge needed",
          detail:
            signals.notes.length > 0 || signals.previewTexts.length > 0
              ? "A teacher should manually extract the key actionable points from the provided notes before using them inside daycare."
              : "Only file metadata is currently available, so a teacher should manually confirm the key actionable points from the original file.",
          source: "rule:generic_unknown",
        },
      ];
  }
}

function bucketRisk(bucket: RuleBucket): HealthFileBridgeRiskItem {
  switch (bucket) {
    case "fever_or_temperature":
      return {
        title: "Need same-day health recheck in daycare",
        severity: "medium",
        detail:
          "This is a bridge reminder only. Teachers should recheck the child status in daycare instead of treating the external file as a diagnosis.",
        source: "rule:fever_or_temperature",
      };
    case "allergy_or_medication":
      return {
        title: "Need teacher review before routine care",
        severity: "high",
        detail:
          "Potential allergy or medication instructions should be confirmed by staff before meals, activity, or nap routines.",
        source: "rule:allergy_or_medication",
      };
    case "recheck_or_follow_up":
      return {
        title: "Need follow-up reminder alignment",
        severity: "medium",
        detail:
          "The external file suggests a follow-up timeline that should be bridged into daycare reminders and parent handoff.",
        source: "rule:recheck_or_follow_up",
      };
    case "generic_unknown":
    default:
      return {
        title: "Need manual interpretation by teacher",
        severity: "low",
        detail:
          "The current T7 skeleton cannot interpret the original file content automatically, so a teacher should confirm the actionable points first.",
        source: "rule:generic_unknown",
      };
  }
}

function bucketSchoolAction(bucket: RuleBucket): HealthFileBridgeActionItem {
  switch (bucket) {
    case "fever_or_temperature":
      return {
        title: "Recheck temperature and energy level after arrival",
        detail:
          "Record the same-day observation in a teacher note and keep the activity plan conservative until the child status looks stable.",
        ownerRole: "teacher",
        timing: "today at arrival",
        source: "rule:fever_or_temperature",
      };
    case "allergy_or_medication":
      return {
        title: "Review allergy or medication instructions with the care team",
        detail: "Confirm meal, medication, and classroom precautions before daily routines continue.",
        ownerRole: "teacher",
        timing: "before meals and routine care",
        source: "rule:allergy_or_medication",
      };
    case "recheck_or_follow_up":
      return {
        title: "Create a same-day reminder for the follow-up point",
        detail:
          "Bridge the external recheck note into a daycare reminder so teachers know what to observe today.",
        ownerRole: "teacher",
        timing: "today before pickup",
        source: "rule:recheck_or_follow_up",
      };
    case "generic_unknown":
    default:
      return {
        title: "Teacher manually summarizes the external file into a daycare note",
        detail: "Capture only observable and actionable items; do not copy the file as a diagnosis conclusion.",
        ownerRole: "teacher",
        timing: "today before action planning",
        source: "rule:generic_unknown",
      };
  }
}

function bucketFamilyAction(bucket: RuleBucket): HealthFileBridgeActionItem {
  switch (bucket) {
    case "fever_or_temperature":
      return {
        title: "Keep one short evening status update for pickup handoff",
        detail:
          "Parents should record temperature or visible status changes tonight so the daycare team can compare next-day observations.",
        ownerRole: "family",
        timing: "tonight",
        source: "rule:fever_or_temperature",
      };
    case "allergy_or_medication":
      return {
        title: "Prepare the exact medication or allergy wording for tomorrow handoff",
        detail: "Parents should bring or restate the relevant instruction so teachers do not rely on memory alone.",
        ownerRole: "family",
        timing: "tonight",
        source: "rule:allergy_or_medication",
      };
    case "recheck_or_follow_up":
      return {
        title: "Keep the follow-up timing visible for tomorrow handoff",
        detail:
          "Parents should note what needs to be rechecked and when, so the daycare plan matches the external advice.",
        ownerRole: "family",
        timing: "tonight",
        source: "rule:recheck_or_follow_up",
      };
    case "generic_unknown":
    default:
      return {
        title: "Add one manual summary sentence for the daycare team",
        detail:
          "Parents should write the single most actionable point from the external file instead of sending only the file itself.",
        ownerRole: "family",
        timing: "tonight",
        source: "rule:generic_unknown",
      };
  }
}

function bucketFollowUp(bucket: RuleBucket): HealthFileBridgeFollowUpItem {
  switch (bucket) {
    case "fever_or_temperature":
      return {
        title: "Compare tonight status with next-day daycare observation",
        detail:
          "Use the next handoff to confirm whether the temperature-related concern still needs closer monitoring.",
        ownerRole: "teacher",
        due: "next morning handoff",
        source: "rule:fever_or_temperature",
      };
    case "allergy_or_medication":
      return {
        title: "Confirm classroom precautions were followed",
        detail:
          "Review whether the care team and family used the same allergy or medication instruction wording.",
        ownerRole: "teacher",
        due: "next care cycle",
        source: "rule:allergy_or_medication",
      };
    case "recheck_or_follow_up":
      return {
        title: "Check that the follow-up milestone was not missed",
        detail: "Bridge the external recheck date into the next daycare review point.",
        ownerRole: "teacher",
        due: "next scheduled review",
        source: "rule:recheck_or_follow_up",
      };
    case "generic_unknown":
    default:
      return {
        title: "Confirm the core actionable point with the family",
        detail:
          "Before using the external file in a daycare plan, verify the one action that teachers should actually take.",
        ownerRole: "teacher",
        due: "next family handoff",
        source: "rule:generic_unknown",
      };
  }
}

function buildEscalationSuggestion(buckets: RuleBucket[]): HealthFileBridgeEscalationSuggestion {
  if (buckets.includes("allergy_or_medication")) {
    return {
      shouldEscalate: true,
      level: "school-health-review",
      reason:
        "Potential allergy or medication instructions usually need a same-day staff review before routine care.",
      nextStep: "Ask the responsible teacher or school health contact to confirm the actionable precautions.",
      source: "rule:allergy_or_medication",
    };
  }
  if (buckets.includes("fever_or_temperature") || buckets.includes("recheck_or_follow_up")) {
    return {
      shouldEscalate: true,
      level: "teacher-review",
      reason:
        "The external file adds same-day monitoring or follow-up information that should be acknowledged by the teacher team.",
      nextStep:
        "Bridge the note into a teacher review item instead of assuming the external file has already been acted on.",
      source: buckets.includes("fever_or_temperature")
        ? "rule:fever_or_temperature"
        : "rule:recheck_or_follow_up",
    };
  }
  return {
    shouldEscalate: false,
    level: "none",
    reason: "The current input does not justify escalation beyond a teacher-side manual review in T7.",
    nextStep: "Keep this as a bridge note and confirm the actionable point with the family.",
    source: "rule:generic_unknown",
  };
}

function buildWritebackSuggestion(
  request: HealthFileBridgeRequest,
  facts: HealthFileBridgeFact[],
  risks: HealthFileBridgeRiskItem[]
): HealthFileBridgeWritebackSuggestion {
  return {
    shouldWriteback: true,
    destination: "teacher-health-note-draft",
    summary:
      "Create a draft daycare note with the external-file facts, bridge risks, and same-day actions. Do not auto-write it in T7.",
    payload: {
      childId: request.childId ?? null,
      sourceRole: request.sourceRole,
      fileKind: request.fileKind ?? null,
      fileNames: request.files.map((file) => file.name),
      extractedFactLabels: facts.map((item) => item.label),
      riskTitles: risks.map((item) => item.title),
    },
    source: "rule:writeback-draft",
    status: "placeholder",
  };
}

function dedupeByTitle<T extends { title: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  });
}

function dedupeByLabel<T extends { label: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.label)) return false;
    seen.add(item.label);
    return true;
  });
}

export function buildHealthFileBridgeResponse(
  request: HealthFileBridgeRequest,
  options: {
    source: HealthFileBridgeSource;
    fallback: boolean;
    mock: boolean;
    liveReadyButNotVerified: boolean;
  }
): HealthFileBridgeResponse {
  const signals = collectSignals(request);
  const buckets = detectBuckets(signals.haystack);

  const extractedFacts = dedupeByLabel([
    ...baseFacts(request),
    ...buckets.flatMap((bucket) => bucketFacts(bucket, signals)),
  ]);
  const riskItems = dedupeByTitle(buckets.map((bucket) => bucketRisk(bucket)));
  const schoolTodayActions = dedupeByTitle(buckets.map((bucket) => bucketSchoolAction(bucket)));
  const familyTonightActions = dedupeByTitle(buckets.map((bucket) => bucketFamilyAction(bucket)));
  const followUpPlan = dedupeByTitle(buckets.map((bucket) => bucketFollowUp(bucket)));
  const escalationSuggestion = buildEscalationSuggestion(buckets);
  const writebackSuggestion = buildWritebackSuggestion(request, extractedFacts, riskItems);

  return {
    childId: request.childId,
    sourceRole: request.sourceRole,
    fileKind: request.fileKind,
    summary:
      "T7 skeleton bridged external health file context into daycare actions. Teachers still need to manually review the original file before using the suggestions operationally.",
    extractedFacts,
    riskItems,
    schoolTodayActions,
    familyTonightActions,
    followUpPlan,
    escalationSuggestion,
    writebackSuggestion,
    disclaimer: HEALTH_FILE_BRIDGE_DISCLAIMER,
    source: options.source,
    fallback: options.fallback,
    mock: options.mock,
    liveReadyButNotVerified: options.liveReadyButNotVerified,
    generatedAt: new Date().toISOString(),
    provider: "health-file-bridge-rule",
    model: "t7-health-file-bridge-skeleton",
  };
}
