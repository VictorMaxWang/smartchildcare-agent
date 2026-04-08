"use client";

import { BrainCircuit, Database, GitBranchPlus, Network, SearchCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminConsultationPriorityItem } from "@/lib/agent/admin-consultation";
import { cn } from "@/lib/utils";

const DESKTOP_SUMMARY_LIMIT = 96;
const DESKTOP_FINDINGS_LIMIT = 2;
const DESKTOP_EXPLAINABILITY_LIMIT = 2;
const DESKTOP_EVIDENCE_LIMIT = 2;

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

function summarizeText(text: string, limit: number) {
  const normalized = text.trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit).trimEnd()}...`;
}

function SectionHeading({
  icon,
  title,
  toneClassName,
}: {
  icon: React.ReactNode;
  title: string;
  toneClassName: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-full", toneClassName)}>
        {icon}
      </span>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
    </div>
  );
}

function FilledList({
  items,
  emptyText,
  toneClassName = "bg-slate-50",
}: {
  items: string[];
  emptyText: string;
  toneClassName?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm leading-6 text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="space-y-2 text-sm leading-6 text-slate-600">
      {items.map((item) => (
        <p key={item} className={cn("rounded-xl px-3 py-2", toneClassName)}>
          {item}
        </p>
      ))}
    </div>
  );
}

function DesktopMetaCard({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {icon}
        <span>{title}</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}

function DesktopExplainabilityList({
  items,
  emptyText,
}: {
  items: AdminConsultationPriorityItem["trace"]["explainability"];
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm leading-6 text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((itemExplainability) => (
        <div
          key={`${itemExplainability.label}-${itemExplainability.detail}`}
          className="rounded-2xl border border-slate-100 bg-white/90 px-3 py-3"
        >
          <p className="text-sm font-semibold text-slate-900">{itemExplainability.label}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{itemExplainability.detail}</p>
        </div>
      ))}
    </div>
  );
}

export default function ConsultationTraceCard({
  item,
  className,
}: {
  item: AdminConsultationPriorityItem;
  className?: string;
}) {
  const { trace } = item;
  const summaryPreview = summarizeText(trace.collaborationSummary, DESKTOP_SUMMARY_LIMIT);
  const desktopKeyFindings = trace.keyFindings.slice(0, DESKTOP_FINDINGS_LIMIT);
  const extraKeyFindings = trace.keyFindings.slice(DESKTOP_FINDINGS_LIMIT);
  const desktopExplainability = trace.explainability.slice(0, DESKTOP_EXPLAINABILITY_LIMIT);
  const extraExplainability = trace.explainability.slice(DESKTOP_EXPLAINABILITY_LIMIT);
  const desktopEvidence = trace.evidenceHighlights.slice(0, DESKTOP_EVIDENCE_LIMIT);
  const extraEvidence = trace.evidenceHighlights.slice(DESKTOP_EVIDENCE_LIMIT);
  const hasDesktopDetails =
    summaryPreview !== trace.collaborationSummary ||
    extraKeyFindings.length > 0 ||
    extraExplainability.length > 0 ||
    extraEvidence.length > 0;

  return (
    <Card
      className={cn(
        "rounded-[28px] border-slate-100 bg-white/95 shadow-sm xl:self-start",
        className
      )}
    >
      <CardHeader className="gap-4 pb-4">
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
            园长端只保留可答辩的 explainability、证据与协作状态，不再呈现日志式时间线。
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-4 xl:hidden">
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
              <div className="mt-3">
                <FilledList items={trace.keyFindings} emptyText="当前没有额外关键发现。" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <div className="flex items-center gap-2">
              <GitBranchPlus className="h-4 w-4 text-indigo-500" />
              <p className="text-sm font-semibold text-slate-900">Explainability</p>
            </div>
            <div className="mt-3">
              <DesktopExplainabilityList
                items={trace.explainability}
                emptyText="当前没有额外 explainability 明细。"
              />
            </div>
          </div>

          {trace.evidenceHighlights.length > 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">证据亮点</p>
              <div className="mt-3">
                <FilledList items={trace.evidenceHighlights} emptyText="当前没有证据亮点。" />
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
        </div>

        <div className="hidden xl:block">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(250px,0.85fr)]">
            <div className="space-y-4">
              <div className="rounded-3xl border border-indigo-100 bg-linear-to-br from-indigo-50 via-white to-slate-50 p-5">
                <SectionHeading
                  icon={<SearchCheck className="h-4 w-4 text-emerald-500" />}
                  title="协作摘要"
                  toneClassName="bg-emerald-100 text-emerald-700"
                />
                <p className="mt-3 text-sm leading-7 text-slate-700">{summaryPreview}</p>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-3xl border border-slate-100 bg-white p-4">
                  <SectionHeading
                    icon={<BrainCircuit className="h-4 w-4 text-indigo-500" />}
                    title="关键发现"
                    toneClassName="bg-indigo-100 text-indigo-700"
                  />
                  <div className="mt-3">
                    <FilledList items={desktopKeyFindings} emptyText="当前没有额外关键发现。" />
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-100 bg-white p-4">
                  <SectionHeading
                    icon={<GitBranchPlus className="h-4 w-4 text-sky-500" />}
                    title="Explainability"
                    toneClassName="bg-sky-100 text-sky-700"
                  />
                  <div className="mt-3">
                    <DesktopExplainabilityList
                      items={desktopExplainability}
                      emptyText="当前没有额外 explainability 明细。"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
                <p className="text-sm font-semibold text-slate-900">参与 Agent</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {trace.participants.length > 0 ? (
                    trace.participants.map((participant) => (
                      <Badge key={participant} variant="info">
                        {participant}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-slate-500">当前没有参与者信息。</p>
                  )}
                </div>
              </div>

              {desktopEvidence.length > 0 ? (
                <div className="rounded-3xl border border-slate-100 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">证据亮点</p>
                  <div className="mt-3">
                    <FilledList
                      items={desktopEvidence}
                      emptyText="当前没有证据亮点。"
                      toneClassName="bg-amber-50/80"
                    />
                  </div>
                </div>
              ) : null}

              <div className="rounded-3xl border border-slate-100 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">状态面板</p>
                <div className="mt-3 grid gap-3">
                  <DesktopMetaCard
                    icon={<Network className="h-4 w-4 text-sky-500" />}
                    title="Provider"
                    detail={trace.providerLabel ?? trace.providerStateLabel}
                  />
                  <DesktopMetaCard
                    icon={<Database className="h-4 w-4 text-emerald-500" />}
                    title="Memory"
                    detail={trace.memoryDetail ?? trace.memoryStateLabel}
                  />
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-3">
                    <p className="text-sm font-semibold text-emerald-900">Sync 去向</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {trace.syncTargets.length > 0 ? (
                        trace.syncTargets.map((syncTarget) => (
                          <Badge key={syncTarget} variant="success">
                            {syncTarget}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm leading-6 text-emerald-700">当前没有同步目标。</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {hasDesktopDetails ? (
            <details className="mt-4 rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
                查看完整 trace 细节
              </summary>

              <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
                {summaryPreview !== trace.collaborationSummary ? (
                  <div>
                    <p className="text-sm font-semibold text-slate-900">完整协作摘要</p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{trace.collaborationSummary}</p>
                  </div>
                ) : null}

                {extraKeyFindings.length > 0 ? (
                  <div>
                    <p className="text-sm font-semibold text-slate-900">其余关键发现</p>
                    <div className="mt-3">
                      <FilledList items={extraKeyFindings} emptyText="当前没有额外关键发现。" />
                    </div>
                  </div>
                ) : null}

                {extraExplainability.length > 0 ? (
                  <div>
                    <p className="text-sm font-semibold text-slate-900">其余 Explainability</p>
                    <div className="mt-3">
                      <DesktopExplainabilityList
                        items={extraExplainability}
                        emptyText="当前没有额外 explainability 明细。"
                      />
                    </div>
                  </div>
                ) : null}

                {extraEvidence.length > 0 ? (
                  <div>
                    <p className="text-sm font-semibold text-slate-900">其余证据亮点</p>
                    <div className="mt-3">
                      <FilledList
                        items={extraEvidence}
                        emptyText="当前没有证据亮点。"
                        toneClassName="bg-amber-50/80"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
