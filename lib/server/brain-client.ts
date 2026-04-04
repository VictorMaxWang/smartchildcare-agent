const DEFAULT_TIMEOUT_MS = 20_000;

export const SMARTCHILDCARE_TRANSPORT_HEADER = "x-smartchildcare-transport";
export const SMARTCHILDCARE_TARGET_HEADER = "x-smartchildcare-target";
export const SMARTCHILDCARE_FALLBACK_REASON_HEADER = "x-smartchildcare-fallback-reason";
export const SMARTCHILDCARE_UPSTREAM_HOST_HEADER = "x-smartchildcare-upstream-host";

export type BrainTransport =
  | "remote-brain-proxy"
  | "next-json-fallback"
  | "next-stream-fallback";

export interface BrainForwardResult {
  response: Response | null;
  targetPath: string;
  upstreamHost: string | null;
  fallbackReason: string | null;
}

function normalizeBaseUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function sanitizeReasonToken(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return normalized.replace(/^-+|-+$/g, "") || "unknown";
}

function resolveUpstreamHost(baseUrl: string | null) {
  if (!baseUrl) return null;

  try {
    return new URL(baseUrl).host || null;
  } catch {
    return null;
  }
}

function fallbackReasonFromError(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "brain-proxy-timeout";
  }
  if (error instanceof Error) {
    return `brain-fetch-${sanitizeReasonToken(error.name || "error")}`;
  }
  return "brain-fetch-error";
}

function buildTransportHeaders({
  transport,
  targetPath,
  upstreamHost,
  fallbackReason,
}: {
  transport: BrainTransport;
  targetPath: string;
  upstreamHost?: string | null;
  fallbackReason?: string | null;
}) {
  const headers = new Headers();
  headers.set(SMARTCHILDCARE_TRANSPORT_HEADER, transport);
  headers.set(SMARTCHILDCARE_TARGET_HEADER, targetPath);
  if (upstreamHost) headers.set(SMARTCHILDCARE_UPSTREAM_HOST_HEADER, upstreamHost);
  if (fallbackReason) headers.set(SMARTCHILDCARE_FALLBACK_REASON_HEADER, fallbackReason);
  return headers;
}

function mergeHeaders(base: HeadersInit, extra?: HeadersInit) {
  const headers = new Headers(base);
  if (!extra) return headers;

  new Headers(extra).forEach((value, key) => {
    headers.set(key, value);
  });
  return headers;
}

export function getBrainBaseUrl() {
  return normalizeBaseUrl(
    process.env.BRAIN_API_BASE_URL ?? process.env.NEXT_PUBLIC_BACKEND_BASE_URL
  );
}

export function createBrainTransportHeaders({
  transport,
  targetPath,
  upstreamHost,
  fallbackReason,
}: {
  transport: BrainTransport;
  targetPath: string;
  upstreamHost?: string | null;
  fallbackReason?: string | null;
}) {
  return buildTransportHeaders({ transport, targetPath, upstreamHost, fallbackReason });
}

export function readBrainTransportHeaders(headers: Headers) {
  return {
    transport: headers.get(SMARTCHILDCARE_TRANSPORT_HEADER),
    targetPath: headers.get(SMARTCHILDCARE_TARGET_HEADER),
    upstreamHost: headers.get(SMARTCHILDCARE_UPSTREAM_HOST_HEADER),
    fallbackReason: headers.get(SMARTCHILDCARE_FALLBACK_REASON_HEADER),
  };
}

function getBrainTimeoutMs() {
  const raw = process.env.BRAIN_API_TIMEOUT_MS?.trim();
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function buildForwardHeaders(request: Request) {
  const incoming = new Headers(request.headers);
  const headers = new Headers();

  const contentType = incoming.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const accept = incoming.get("accept");
  if (accept) headers.set("accept", accept);

  const traceHeaders = [
    "x-request-id",
    "x-correlation-id",
    "x-trace-id",
    "x-ai-force-fallback",
    "x-debug-memory",
  ];

  traceHeaders.forEach((name) => {
    const value = incoming.get(name);
    if (value) headers.set(name, value);
  });

  return headers;
}

function shouldFallback(response: Response) {
  return (
    response.status === 404 ||
    response.status === 405 ||
    response.status === 501 ||
    response.status >= 500
  );
}

export async function forwardBrainRequest(
  request: Request,
  targetPath: string
): Promise<BrainForwardResult> {
  const baseUrl = getBrainBaseUrl();
  const upstreamHost = resolveUpstreamHost(baseUrl);
  if (!baseUrl) {
    console.warn(
      `[BRAIN_PROXY] Falling back for ${targetPath}: BRAIN_API_BASE_URL is not configured.`
    );
    return {
      response: null,
      targetPath,
      upstreamHost,
      fallbackReason: "brain-base-url-missing",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getBrainTimeoutMs());
  const method = request.method.toUpperCase();

  try {
    const proxiedResponse = await fetch(`${baseUrl}${targetPath}`, {
      method,
      headers: buildForwardHeaders(request),
      body:
        method === "GET" || method === "HEAD"
          ? undefined
          : await request.clone().arrayBuffer(),
      cache: "no-store",
      signal: controller.signal,
    });

    if (shouldFallback(proxiedResponse)) {
      const fallbackReason = `brain-status-${proxiedResponse.status}`;
      console.warn(
        `[BRAIN_PROXY] Falling back for ${targetPath}: backend returned ${proxiedResponse.status} (${fallbackReason}).`
      );
      return {
        response: null,
        targetPath,
        upstreamHost,
        fallbackReason,
      };
    }

    const responseHeaders = new Headers();
    const contentType = proxiedResponse.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);

    const cacheControl = proxiedResponse.headers.get("cache-control");
    if (cacheControl) responseHeaders.set("cache-control", cacheControl);

    const transportHeaders = buildTransportHeaders({
      transport: "remote-brain-proxy",
      targetPath,
      upstreamHost,
    });
    transportHeaders.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    console.info(
      `[BRAIN_PROXY] Remote brain proxy succeeded for ${targetPath} via ${upstreamHost ?? "unknown-upstream"}.`
    );

    return {
      response: new Response(proxiedResponse.body, {
        status: proxiedResponse.status,
        statusText: proxiedResponse.statusText,
        headers: responseHeaders,
      }),
      targetPath,
      upstreamHost,
      fallbackReason: null,
    };
  } catch (error) {
    const fallbackReason = fallbackReasonFromError(error);
    console.warn(
      `[BRAIN_PROXY] Falling back for ${targetPath}: ${fallbackReason}.`,
      error
    );
    return {
      response: null,
      targetPath,
      upstreamHost,
      fallbackReason,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function createSseResponse(body: ReadableStream<Uint8Array>, extraHeaders?: HeadersInit) {
  return new Response(body, {
    status: 200,
    headers: mergeHeaders(
      {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
      extraHeaders
    ),
  });
}

export function createMockBrainStreamResponse() {
  const encoder = new TextEncoder();
  const events = [
    'event: meta\ndata: {"source":"next-fallback","mode":"mock"}\n\n',
    'event: reasoning\ndata: {"message":"FastAPI SSE endpoint is not available yet, using fallback stream."}\n\n',
    'event: final\ndata: {"message":"Fallback stream completed."}\n\n',
  ];

  return createSseResponse(
    new ReadableStream<Uint8Array>({
      start(controller) {
        events.forEach((event, index) => {
          setTimeout(() => {
            controller.enqueue(encoder.encode(event));
            if (index === events.length - 1) controller.close();
          }, index * 80);
        });
      },
    }),
    buildTransportHeaders({
      transport: "next-stream-fallback",
      targetPath: "/api/v1/stream/agent",
      fallbackReason: "brain-stream-mock-fallback",
    })
  );
}
