import type {
  HealthFileBridgeContraindication,
  HealthFileBridgeFact,
  HealthFileBridgeFile,
  HealthFileBridgeFileType,
  HealthFileBridgeFollowUpHint,
  HealthFileBridgeRequest,
  HealthFileBridgeResponse,
  HealthFileBridgeRiskItem,
  HealthFileBridgeSource,
} from "../ai/types";

const HEALTH_FILE_BRIDGE_DISCLAIMER =
  "T8 extraction only: this bridge returns structured facts from file metadata and text hints. It does not perform verified binary OCR, medical diagnosis, daycare action mapping, writeback, or escalation dispatch.";

const REPORT_KEYWORDS = ["report", "lab", "result", "检验", "检查", "报告"];
const CHECKLIST_KEYWORDS = ["checklist", "form", "sheet", "单", "表"];
const RECHECK_KEYWORDS = ["recheck", "follow-up", "follow up", "复查", "复诊", "复测", "复检"];
const ALLERGY_KEYWORDS = ["allergy", "allergic", "过敏"];
const MEDICATION_KEYWORDS = [
  "medication",
  "medicine",
  "prescription",
  "antibiotic",
  "nebulizer",
  "用药",
  "药",
  "处方",
  "抗生素",
  "雾化",
];
const ABNORMAL_KEYWORDS = ["abnormal", "positive", "elevated", "high", "low", "异常", "偏高", "偏低", "阳性"];
const FOLLOW_UP_HINT_KEYWORDS = [...RECHECK_KEYWORDS, "review", "随访", "明天", "tomorrow", "48h", "48小时"];
const TEMPERATURE_PATTERN = /(?<!\d)(3[5-9](?:\.\d)?)(?:\s*(?:°?\s*[cC]|℃))?/;

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
  const fileUrls = request.files.map((file) => safeText(file.fileUrl)).filter(Boolean);
  const notes = safeText(request.optionalNotes);
  const providerText = [...previewTexts, notes].filter(Boolean).join("\n");
  const haystack = normalizeText(
    [request.fileKind ?? "", ...fileNames, ...mimeTypes, ...previewTexts, ...fileUrls, notes, providerText].join(" ")
  );

  return {
    fileNames,
    mimeTypes,
    previewTexts,
    fileUrls,
    notes,
    providerText,
    haystack,
  };
}

function hasKeyword(haystack: string, keywords: string[]) {
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function detectFileType(request: HealthFileBridgeRequest, signals: ReturnType<typeof collectSignals>): HealthFileBridgeFileType {
  const fileTypes = new Set<HealthFileBridgeFileType>();
  for (const file of request.files) {
    const mimeType = normalizeText(file.mimeType);
    const name = normalizeText(file.name);
    if (mimeType.includes("pdf") || name.endsWith(".pdf")) {
      fileTypes.add("pdf");
    } else if (mimeType.startsWith("image/")) {
      fileTypes.add("report-screenshot");
    }
  }

  const fileKind = normalizeText(request.fileKind);
  if (fileKind === "lab-report" || fileKind === "health-note" || hasKeyword(signals.haystack, REPORT_KEYWORDS)) {
    fileTypes.add(fileTypes.has("pdf") ? "pdf" : "report-screenshot");
  }
  if (fileKind === "discharge-note" || hasKeyword(signals.haystack, RECHECK_KEYWORDS)) {
    fileTypes.add("recheck-slip");
  }
  if (fileKind === "prescription" || hasKeyword(signals.haystack, CHECKLIST_KEYWORDS)) {
    fileTypes.add("checklist");
  }

  if (fileTypes.size === 0) return "unknown";
  if (fileTypes.size === 1) return Array.from(fileTypes)[0]!;
  return "mixed";
}

function extractTemperature(haystack: string) {
  return haystack.match(TEMPERATURE_PATTERN)?.[1] ?? null;
}

function baseFacts(
  request: HealthFileBridgeRequest,
  signals: ReturnType<typeof collectSignals>,
  fileType: HealthFileBridgeFileType
): HealthFileBridgeFact[] {
  const facts: HealthFileBridgeFact[] = [
    {
      label: "File type",
      detail: `Detected fileType=${fileType} from the uploaded file metadata and text hints.`,
      source: "derived:file-type",
    },
    {
      label: "Source role",
      detail: `Current request came from ${request.sourceRole}.`,
      source: "request-meta",
    },
    {
      label: "Extraction mode",
      detail: `T8 processed ${request.files.length} file(s) using request-supplied preview text, notes, file names, and mime hints only.`,
      source: "request-meta",
    },
  ];

  if (signals.providerText) {
    facts.push({
      label: "Text evidence",
      detail: "A text hint was available for structured extraction.",
      source: "ocr:text-fallback",
    });
  }

  return facts;
}

function signalFacts(haystack: string): HealthFileBridgeFact[] {
  const facts: HealthFileBridgeFact[] = [];
  const temperature = extractTemperature(haystack);
  if (temperature) {
    facts.push({
      label: "Temperature mention",
      detail: `Detected a temperature-like value: ${temperature}.`,
      source: "pattern:temperature",
    });
  }
  if (hasKeyword(haystack, ALLERGY_KEYWORDS)) {
    facts.push({
      label: "Allergy mention",
      detail: "Detected allergy-related wording in the provided text hints.",
      source: "pattern:allergy",
    });
  }
  if (hasKeyword(haystack, MEDICATION_KEYWORDS)) {
    facts.push({
      label: "Medication mention",
      detail: "Detected medication or prescription-related wording in the provided text hints.",
      source: "pattern:medication",
    });
  }
  if (hasKeyword(haystack, ABNORMAL_KEYWORDS)) {
    facts.push({
      label: "Abnormal result wording",
      detail: "Detected wording that usually appears around abnormal or flagged findings.",
      source: "pattern:abnormal",
    });
  }
  if (hasKeyword(haystack, FOLLOW_UP_HINT_KEYWORDS)) {
    facts.push({
      label: "Follow-up wording",
      detail: "Detected recheck, review, or follow-up wording in the available text hints.",
      source: "pattern:follow-up",
    });
  }
  return facts;
}

function riskItems(haystack: string): HealthFileBridgeRiskItem[] {
  const risks: HealthFileBridgeRiskItem[] = [];
  const temperature = extractTemperature(haystack);
  if (temperature) {
    risks.push({
      title: "Temperature-related signal needs manual confirmation",
      severity: Number(temperature) >= 38 ? "high" : "medium",
      detail:
        "A temperature mention was detected in the uploaded material. Staff should verify the original document and the child's current status before operational use.",
      source: "pattern:temperature",
    });
  }
  if (hasKeyword(haystack, ALLERGY_KEYWORDS)) {
    risks.push({
      title: "Potential allergy-related instruction detected",
      severity: "high",
      detail:
        "Allergy wording was detected, but the exact allergen and scope were not independently verified from binary OCR.",
      source: "pattern:allergy",
    });
  }
  if (hasKeyword(haystack, MEDICATION_KEYWORDS)) {
    risks.push({
      title: "Medication wording should not be treated as verified administration guidance",
      severity: "medium",
      detail:
        "Prescription or medication wording was detected, but T8 only extracts structure and does not verify dosage, authorization, or daycare execution rules.",
      source: "pattern:medication",
    });
  }
  if (hasKeyword(haystack, ABNORMAL_KEYWORDS)) {
    risks.push({
      title: "Abnormal or flagged result wording detected",
      severity: "medium",
      detail: "The text hints contain abnormal-result wording that may require review against the original document.",
      source: "pattern:abnormal",
    });
  }
  if (risks.length === 0) {
    risks.push({
      title: "Low-confidence extraction from limited text hints",
      severity: "low",
      detail:
        "The current request does not include enough verified text to infer more specific medical facts safely.",
      source: "fallback:text-hints",
    });
  }
  return dedupeByTitle(risks);
}

function contraindications(haystack: string): HealthFileBridgeContraindication[] {
  const items: HealthFileBridgeContraindication[] = [];
  if (hasKeyword(haystack, ALLERGY_KEYWORDS)) {
    items.push({
      title: "Do not assume allergen exposure is acceptable",
      detail:
        "Allergy-related wording was detected, so meals, activity materials, or medication exposure should not be inferred as safe from this file alone.",
      source: "pattern:allergy",
    });
  }
  if (hasKeyword(haystack, MEDICATION_KEYWORDS)) {
    items.push({
      title: "Do not infer a daycare medication plan from the file alone",
      detail:
        "Medication wording was detected, but dosage and administration authority were not verified by binary OCR or writeback flows.",
      source: "pattern:medication",
    });
  }
  const temperature = extractTemperature(haystack);
  if (temperature && Number(temperature) >= 38) {
    items.push({
      title: "Avoid treating the file as a diagnosis clearance",
      detail:
        "A fever-range value was detected. The upload should not be used as proof that normal activity is already cleared.",
      source: "pattern:temperature",
    });
  }
  return dedupeByTitle(items);
}

function followUpHints(haystack: string, fileType: HealthFileBridgeFileType): HealthFileBridgeFollowUpHint[] {
  const hints: HealthFileBridgeFollowUpHint[] = [];
  if (fileType === "recheck-slip" || hasKeyword(haystack, FOLLOW_UP_HINT_KEYWORDS)) {
    hints.push({
      title: "Keep the original follow-up timing visible",
      detail:
        "The upload appears to contain recheck or follow-up wording. Preserve the original timeline from the source document for later T9/T10 mapping.",
      source: "pattern:follow-up",
    });
  }
  if (hasKeyword(haystack, MEDICATION_KEYWORDS)) {
    hints.push({
      title: "Capture the exact medication wording for later review",
      detail:
        "If this file is reused downstream, keep the original medication phrasing rather than paraphrasing it into an action prematurely.",
      source: "pattern:medication",
    });
  }
  if (hints.length === 0) {
    hints.push({
      title: "Preserve the original file for manual walkthrough",
      detail:
        "T8 extracted only structured hints. A later walkthrough should compare these hints against the original screenshot or PDF before mapping actions.",
      source: "fallback:text-hints",
    });
  }
  return dedupeByTitle(hints);
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

function computeConfidence(
  signals: ReturnType<typeof collectSignals>,
  facts: HealthFileBridgeFact[],
  fileType: HealthFileBridgeFileType
) {
  let score = 0.18;
  if (signals.previewTexts.length > 0) score += 0.34;
  if (signals.notes) score += 0.14;
  if (signals.fileUrls.length > 0) score += 0.08;
  if (fileType !== "unknown") score += 0.12;
  score += Math.min(facts.length, 5) * 0.04;
  if (!signals.providerText) score -= 0.06;
  return Math.max(0.1, Math.min(Number(score.toFixed(2)), 0.92));
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
  const fileType = detectFileType(request, signals);
  const extractedFacts = dedupeByLabel([...baseFacts(request, signals, fileType), ...signalFacts(signals.haystack)]);
  return {
    childId: request.childId,
    sourceRole: request.sourceRole,
    fileKind: request.fileKind,
    fileType,
    summary:
      "T8 extracted structured health-file hints only. Daycare action mapping remains out of scope for this step.",
    extractedFacts,
    riskItems: riskItems(signals.haystack),
    contraindications: contraindications(signals.haystack),
    followUpHints: followUpHints(signals.haystack, fileType),
    confidence: computeConfidence(signals, extractedFacts, fileType),
    disclaimer: HEALTH_FILE_BRIDGE_DISCLAIMER,
    source: options.source,
    fallback: options.fallback,
    mock: options.mock,
    liveReadyButNotVerified: options.liveReadyButNotVerified,
    generatedAt: new Date().toISOString(),
    provider: "next-local-health-file-extractor",
    model: "t8-health-file-bridge-local",
  };
}
