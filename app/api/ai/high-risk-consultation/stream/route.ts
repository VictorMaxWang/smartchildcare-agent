import { forwardBrainRequest } from "@/lib/server/brain-client";

type ProviderTrace = {
  provider?: string;
  source?: string;
  model?: string;
  requestId?: string;
  realProvider?: boolean;
  fallback?: boolean;
  [key: string]: unknown;
};

type StreamEvent =
  | { event: "status"; data: Record<string, unknown> }
  | { event: "text"; data: Record<string, unknown> }
  | { event: "ui"; data: Record<string, unknown> }
  | { event: "error"; data: Record<string, unknown> }
  | { event: "done"; data: Record<string, unknown> };

function encodeEvent(event: StreamEvent) {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

function streamResponse(events: StreamEvent[], status = 200) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        let index = 0;
        const push = () => {
          if (index >= events.length) {
            controller.close();
            return;
          }
          controller.enqueue(encoder.encode(encodeEvent(events[index])));
          index += 1;
          setTimeout(push, 80);
        };
        push();
      },
    }),
    {
      status,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    }
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function getTraceId(value: unknown) {
  const traceId = typeof value === "string" && value.trim() ? value.trim() : "";
  return traceId || `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildProviderTrace(result: Record<string, unknown>): ProviderTrace {
  const trace = asRecord(result.providerTrace);
  const source = String(trace.source ?? result.source ?? "next-fallback");
  const fallback = Boolean(trace.fallback ?? (source === "mock" || source === "next-fallback"));
  const realProvider = Boolean(trace.realProvider ?? (!fallback && source !== "mock" && source !== "next-fallback"));
  return {
    ...trace,
    source,
    provider: String(trace.provider ?? trace.llm ?? source),
    model: String(trace.model ?? result.model ?? ""),
    requestId: String(trace.requestId ?? trace.request_id ?? ""),
    realProvider,
    fallback,
  };
}

function buildSummaryCard(result: Record<string, unknown>, memoryMeta: Record<string, unknown>, providerTrace: ProviderTrace) {
  const coordinatorSummary = asRecord(result.coordinatorSummary);
  const continuityNotes = asStringArray(result.continuityNotes);
  const triggerReasons = asStringArray(result.triggerReasons);
  const keyFindings = asStringArray(result.keyFindings);

  return {
    stage: "long_term_profile",
    title: String(result.summary ? "会诊总览" : "会诊摘要"),
    summary: String(result.summary ?? coordinatorSummary.finalConclusion ?? ""),
    content: String(coordinatorSummary.finalConclusion ?? result.parentMessageDraft ?? ""),
    items: [...continuityNotes.slice(0, 2), ...triggerReasons.slice(0, 2), ...keyFindings.slice(0, 2)].filter(Boolean),
    providerTrace,
    memoryMeta,
  };
}

function buildLongTermItems(result: Record<string, unknown>, memoryMeta: Record<string, unknown>) {
  const continuityNotes = asStringArray(result.continuityNotes);
  const usedSources = asStringArray(memoryMeta.usedSources);
  const matchedSnapshots = asStringArray(memoryMeta.matchedSnapshotIds);
  const matchedTraces = asStringArray(memoryMeta.matchedTraceIds);

  return [
    ...continuityNotes.slice(0, 2),
    ...usedSources.slice(0, 2).map((item) => `memory source: ${item}`),
    ...matchedSnapshots.slice(0, 1).map((item) => `snapshot: ${item}`),
    ...matchedTraces.slice(0, 1).map((item) => `trace: ${item}`),
  ].filter(Boolean);
}

function buildRecentItems(result: Record<string, unknown>) {
  return [...asStringArray(result.triggerReasons).slice(0, 2), ...asStringArray(result.keyFindings).slice(0, 2), ...asStringArray(result.nextCheckpoints).slice(0, 2)].filter(Boolean);
}

function buildFollowUpCard(result: Record<string, unknown>, providerTrace: ProviderTrace) {
  const interventionCard = asRecord(result.interventionCard);
  return {
    title: String(interventionCard.title ?? "48 小时复查"),
    items: [
      String(interventionCard.todayInSchoolAction ?? ""),
      String(interventionCard.tonightHomeAction ?? ""),
      ...asStringArray(result.followUp48h).slice(0, 2),
    ].filter(Boolean),
    reviewIn48h: String(interventionCard.reviewIn48h ?? result.reviewIn48h ?? ""),
    providerTrace,
  };
}

async function buildFallbackEvents(payload: Record<string, unknown>, origin: string): Promise<StreamEvent[]> {
  const response = await fetch(new URL("/api/ai/high-risk-consultation", origin), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-debug-memory": "1",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return [
      {
        event: "error",
        data: {
          stage: "current_recommendation",
          title: "会诊失败",
          message: `fallback request failed with status ${response.status}`,
          traceId: getTraceId(payload.traceId),
        },
      },
      {
        event: "done",
        data: {
          traceId: getTraceId(payload.traceId),
          result: {},
          providerTrace: { source: "next-fallback", provider: "next-fallback", fallback: true, realProvider: false },
          memoryMeta: {},
          realProvider: false,
          fallback: true,
        },
      },
    ];
  }

  const result = (await response.json()) as Record<string, unknown>;
  const traceId = getTraceId(result.consultationId ?? payload.traceId);
  const providerTrace = buildProviderTrace(result);
  const memoryMeta = asRecord(result.memoryMeta);
  const childName = String(asRecord(result.interventionCard).title ?? "高风险会诊");

  return [
    {
      event: "status",
      data: {
        stage: "long_term_profile",
        title: "长期画像",
        message: `正在读取 ${childName} 的长期底色`,
        traceId,
        providerTrace,
        memory: memoryMeta,
      },
    },
    {
      event: "text",
      data: {
        stage: "long_term_profile",
        title: "长期画像",
        text: buildLongTermItems(result, memoryMeta).join("，") || String(result.summary ?? ""),
        items: buildLongTermItems(result, memoryMeta),
        append: false,
        source: providerTrace.source ?? "next-fallback",
      },
    },
    {
      event: "ui",
      data: {
        stage: "long_term_profile",
        cardType: "ConsultationSummaryCard",
        data: buildSummaryCard(result, memoryMeta, providerTrace),
      },
    },
    {
      event: "status",
      data: {
        stage: "recent_context",
        title: "最近会诊",
        message: "正在整合最近会诊、近期快照和连续信号",
        traceId,
        providerTrace,
        memory: memoryMeta,
      },
    },
    {
      event: "text",
      data: {
        stage: "recent_context",
        title: "最近会诊",
        text: buildRecentItems(result).join("，") || String(asRecord(result.coordinatorSummary).finalConclusion ?? ""),
        items: buildRecentItems(result),
        append: false,
        source: providerTrace.source ?? "next-fallback",
      },
    },
    {
      event: "status",
      data: {
        stage: "current_recommendation",
        title: "当前建议",
        message: "正在生成今天园内、今晚家庭和 48 小时复查建议",
        traceId,
        providerTrace,
        memory: memoryMeta,
      },
    },
    {
      event: "text",
      data: {
        stage: "current_recommendation",
        title: "当前建议",
        text: String(result.summary ?? asRecord(result.coordinatorSummary).finalConclusion ?? ""),
        items: [
          ...asStringArray(result.todayInSchoolActions).slice(0, 2),
          ...asStringArray(result.tonightAtHomeActions).slice(0, 2),
          ...asStringArray(result.followUp48h).slice(0, 2),
        ].filter(Boolean),
        append: false,
        source: providerTrace.source ?? "next-fallback",
      },
    },
    {
      event: "ui",
      data: {
        stage: "current_recommendation",
        cardType: "FollowUp48hCard",
        data: buildFollowUpCard(result, providerTrace),
      },
    },
    {
      event: "done",
      data: {
        traceId,
        result,
        providerTrace,
        memoryMeta,
        realProvider: Boolean(providerTrace.realProvider),
        fallback: Boolean(providerTrace.fallback),
      },
    },
  ];
}

export async function POST(request: Request) {
  const proxied = await forwardBrainRequest(request, "/api/v1/agents/consultations/high-risk/stream");
  if (proxied) return proxied;

  let payload: Record<string, unknown>;
  try {
    payload = (await request.clone().json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const events = await buildFallbackEvents(payload, new URL(request.url).origin);
  return streamResponse(events);
}
