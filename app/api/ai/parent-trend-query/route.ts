import { NextResponse } from "next/server";
import {
  createBrainTransportHeaders,
  forwardBrainRequest,
} from "@/lib/server/brain-client";

export async function POST(request: Request) {
  const brainForward = await forwardBrainRequest(request, "/api/v1/agents/parent/trend-query");
  if (brainForward.response) return brainForward.response;

  const headers = createBrainTransportHeaders({
    transport: "next-json-fallback",
    targetPath: brainForward.targetPath,
    upstreamHost: brainForward.upstreamHost,
    fallbackReason: brainForward.fallbackReason ?? "brain-proxy-unavailable",
  });

  return NextResponse.json(
    {
      error: "家长趋势查询暂时不可用，后端趋势服务未接通。",
      detail: "这条查询必须经过 FastAPI brain 才能返回真实趋势结果，请稍后重试或检查后端地址配置。",
    },
    { status: 503, headers }
  );
}
