const DEFAULT_TIMEOUT_MS = 20_000;

function normalizeBaseUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export function getBrainBaseUrl() {
  return normalizeBaseUrl(process.env.BRAIN_API_BASE_URL ?? process.env.NEXT_PUBLIC_BACKEND_BASE_URL);
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
  return response.status === 404 || response.status === 405 || response.status === 501 || response.status >= 500;
}

export async function forwardBrainRequest(request: Request, targetPath: string) {
  const baseUrl = getBrainBaseUrl();
  if (!baseUrl) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getBrainTimeoutMs());
  const method = request.method.toUpperCase();

  try {
    const proxiedResponse = await fetch(`${baseUrl}${targetPath}`, {
      method,
      headers: buildForwardHeaders(request),
      body: method === "GET" || method === "HEAD" ? undefined : await request.clone().arrayBuffer(),
      cache: "no-store",
      signal: controller.signal,
    });

    if (shouldFallback(proxiedResponse)) {
      console.warn(
        `[BRAIN_PROXY] Falling back to Next handler for ${targetPath} after backend returned ${proxiedResponse.status}.`
      );
      return null;
    }

    const responseHeaders = new Headers();
    const contentType = proxiedResponse.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);

    const cacheControl = proxiedResponse.headers.get("cache-control");
    if (cacheControl) responseHeaders.set("cache-control", cacheControl);

    return new Response(proxiedResponse.body, {
      status: proxiedResponse.status,
      statusText: proxiedResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.warn(`[BRAIN_PROXY] Failed to reach backend for ${targetPath}.`, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function createSseResponse(body: ReadableStream<Uint8Array>) {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
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
    })
  );
}
