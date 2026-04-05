"use client";

import { BrainCircuit, Database, GitBranchPlus, Network, SearchCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminConsultationPriorityItem } from "@/lib/agent/admin-consultation";
import { cn } from "@/lib/utils";

function getProviderBadgeVariant(state: AdminConsultationPriorityItem["trace"]["providerState"]) {
  if (state === "real") return "success" as const;
  if (state === "fallback") return "warning" as const;
  return "outline" as const;
}

function getMemoryBadgeVariant(state: AdminConsultationPriorityItem["trace"]["memoryState"]) {
  if (state === "ready") return "success" as const;
  if (state === "degraded") return "warning" as const;
  return "outline" as const;
}

export default function ConsultationTraceCard({
  item,
  className,
}: {
  item: AdminConsultationPriorityItem;
  className?: string;
}) {
  const { trace } = item;

  return (
    <Card className={cn("h-full rounded-[28px] border-slate-100 bg-white/95 shadow-sm", className)}>
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={getProviderBadgeVariant(trace.providerState)}>{trace.providerStateLabel}</Badge>
          <Badge variant={getMemoryBadgeVariant(trace.memoryState)}>{trace.memoryStateLabel}</Badge>
          {trace.providerLabel ? <Badge variant="outline">{trace.providerLabel}</Badge> : null}
        </div>

        <div>
          <CardTitle className="flex items-center gap-2 text-lg text-slate-900">
            <BrainCircuit className="h-5 w-5 text-indigo-500" />
            会诊 Trace 摘要
          </CardTitle>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            园长端只保留可答辩的 Explainability，不伪装 teacher 端的流式时间线。
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
          <div className="flex items-center gap-2">
            <SearchCheck className="h-4 w-4 text-emerald-500" />
            <p className="text-sm font-semibold text-slate-900">协作摘要</p>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{trace.collaborationSummary}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">参与 Agent</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {trace.participants.length > 0 ? (
                trace.participants.map((participant) => (
                  <Badge key={participant} variant="info">
                    {participant}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-slate-500">当前没有参与者信息。</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">关键发现</p>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              {trace.keyFindings.length > 0 ? (
                trace.keyFindings.map((finding) => (
                  <p key={finding} className="rounded-xl bg-slate-50 px-3 py-2">
                    {finding}
                  </p>
                ))
              ) : (
                <p>当前没有额外关键发现。</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex items-center gap-2">
            <GitBranchPlus className="h-4 w-4 text-indigo-500" />
            <p className="text-sm font-semibold text-slate-900">Explainability</p>
          </div>
          <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
            {trace.explainability.length > 0 ? (
              trace.explainability.map((itemExplainability) => (
                <div
                  key={`${itemExplainability.label}-${itemExplainability.detail}`}
                  className="rounded-2xl bg-slate-50/80 p-3"
                >
                  <p className="font-medium text-slate-900">{itemExplainability.label}</p>
                  <p className="mt-1">{itemExplainability.detail}</p>
                </div>
              ))
            ) : (
              <p>当前没有额外 explainability 明细。</p>
            )}
          </div>
        </div>

        {trace.evidenceHighlights.length > 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">证据亮点</p>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              {trace.evidenceHighlights.map((itemEvidence) => (
                <p key={itemEvidence} className="rounded-xl bg-slate-50 px-3 py-2">
                  {itemEvidence}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-sky-500" />
              <p className="text-sm font-semibold text-slate-900">Provider 状态</p>
            </div>
            <p className="mt-3 text-sm text-slate-600">{trace.providerLabel ?? trace.providerStateLabel}</p>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-900">Memory 状态</p>
            </div>
            <p className="mt-3 text-sm text-slate-600">{trace.memoryDetail ?? trace.memoryStateLabel}</p>
          </div>
        </div>

        {trace.syncTargets.length > 0 ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4">
            <p className="text-sm font-semibold text-emerald-900">当前同步去向</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {trace.syncTargets.map((syncTarget) => (
                <Badge key={syncTarget} variant="success">
                  {syncTarget}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
