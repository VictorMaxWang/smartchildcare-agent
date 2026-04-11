import Link from "next/link";
import { AlertCircle, Clock3, RefreshCw } from "lucide-react";
import { SectionCard } from "@/components/role-shell/RoleScaffold";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getWeeklyReportRoleMeta,
  getWeeklyReportSourceMeta,
} from "@/lib/agent/weekly-report-client";
import type { WeeklyReportResponse, WeeklyReportRole } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

type WeeklyReportPreviewCardProps = {
  title: string;
  description: string;
  role: WeeklyReportRole;
  periodLabel: string;
  report: WeeklyReportResponse | null;
  loading?: boolean;
  error?: string | null;
  ctaHref: string;
  ctaLabel: string;
  ctaVariant?: "outline" | "premium" | "secondary";
  className?: string;
};

export default function WeeklyReportPreviewCard({
  title,
  description,
  role,
  periodLabel,
  report,
  loading = false,
  error,
  ctaHref,
  ctaLabel,
  ctaVariant = "outline",
  className,
}: WeeklyReportPreviewCardProps) {
  const roleMeta = getWeeklyReportRoleMeta(role);
  const sourceMeta = report ? getWeeklyReportSourceMeta(report.source) : null;

  return (
    <SectionCard title={title} description={description} className={className}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="info">{roleMeta.label}</Badge>
          <Badge variant="outline">{periodLabel}</Badge>
          {sourceMeta ? <Badge variant={sourceMeta.variant}>{sourceMeta.label}</Badge> : null}
          {report?.source === "ai" && report.model ? <Badge variant="outline">{report.model}</Badge> : null}
          {report?.memoryMeta?.degraded ? <Badge variant="warning">记忆降级</Badge> : null}
          {loading && report ? <Badge variant="secondary">刷新中</Badge> : null}
        </div>

        {report?.continuityNotes?.[0] ? (
          <div className="flex items-start gap-3 rounded-3xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p>延续上周上下文：{report.continuityNotes[0]}</p>
          </div>
        ) : null}

        {report ? (
          <>
            {error ? (
              <div className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>当前展示上次成功结果。最新刷新失败：{error}</p>
              </div>
            ) : null}

            <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-5">
              <p className="text-base font-semibold leading-8 text-slate-900">{report.summary}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {report.sections.map((section) => (
                <div
                  key={section.id}
                  className={cn(
                    "rounded-3xl border border-slate-100 bg-white p-4",
                    report.sections.length === 3 && section.id === "topHomeAction" ? "md:col-span-2" : ""
                  )}
                >
                  <p className="text-sm font-semibold text-slate-900">{section.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{section.summary}</p>
                  {section.items.length > 0 ? (
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                      {section.items.slice(0, 2).map((item) => (
                        <li key={`${section.id}-${item.label}`}>
                          <span className="font-medium text-slate-800">{item.label}：</span>
                          {item.detail}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 p-5">
            {loading ? (
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" />
                正在生成本周周报预览…
              </div>
            ) : error ? (
              <div className="flex items-start gap-3 text-sm text-amber-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">当前还没有可展示的周报预览。</p>
            )}
          </div>
        )}

        <div className="rounded-3xl border border-slate-100 bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <Badge variant="secondary">
                {report?.primaryAction ? report.primaryAction.title : "下一步动作"}
              </Badge>
              <p className="text-sm leading-6 text-slate-700">
                {report?.primaryAction?.detail ?? "进入完整周报工作区或反馈入口后，可查看更完整的行动建议。"}
              </p>
              {report?.primaryAction ? (
                <p className="text-xs text-slate-500">
                  责任角色：{getWeeklyReportRoleMeta(report.primaryAction.ownerRole).label} · 时窗：
                  {report.primaryAction.dueWindow}
                </p>
              ) : null}
            </div>
            <Button asChild variant={ctaVariant} className="min-h-11 rounded-xl">
              <Link href={ctaHref}>{ctaLabel}</Link>
            </Button>
          </div>
        </div>

        {report?.disclaimer ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-xs leading-6 text-slate-500">
            {report.disclaimer}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
