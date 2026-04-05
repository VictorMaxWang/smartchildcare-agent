"use client";

import type { ReactNode } from "react";
import { CalendarClock, Home, School, ShieldAlert, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminConsultationPriorityItem } from "@/lib/agent/admin-consultation";
import { cn } from "@/lib/utils";

function getRiskBadgeVariant(item: AdminConsultationPriorityItem["decision"]["riskLevel"]) {
  if (item === "high") return "warning" as const;
  if (item === "medium") return "info" as const;
  return "secondary" as const;
}

function getStatusBadgeVariant(item: AdminConsultationPriorityItem["decision"]["status"]) {
  if (item === "completed") return "success" as const;
  if (item === "in_progress") return "info" as const;
  return "outline" as const;
}

function ActionColumn({
  icon,
  title,
  items,
  toneClassName,
}: {
  icon: ReactNode;
  title: string;
  items: string[];
  toneClassName: string;
}) {
  return (
    <div className={cn("rounded-2xl border p-4", toneClassName)}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm font-semibold text-slate-900">{title}</p>
      </div>
      <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
        {items.length > 0 ? (
          items.map((item) => (
            <p key={item} className="rounded-xl bg-white/70 px-3 py-2">
              {item}
            </p>
          ))
        ) : (
          <p>当前暂无明确动作建议。</p>
        )}
      </div>
    </div>
  );
}

export default function DirectorDecisionCard({
  item,
  className,
}: {
  item: AdminConsultationPriorityItem;
  className?: string;
}) {
  const { decision } = item;

  return (
    <Card
      className={cn(
        "h-full rounded-[28px] border-amber-100 bg-linear-to-br from-amber-50 via-white to-rose-50 shadow-sm",
        className
      )}
    >
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={getRiskBadgeVariant(decision.riskLevel)}>{decision.priorityLabel}</Badge>
          <Badge variant={getStatusBadgeVariant(decision.status)}>{decision.statusLabel}</Badge>
          <Badge variant="secondary">{decision.riskLabel}</Badge>
          <Badge variant="outline">{decision.className}</Badge>
        </div>

        <div className="space-y-3">
          <div>
            <CardTitle className="text-xl text-slate-900">{decision.childName}</CardTitle>
            <p className="mt-2 text-sm leading-6 text-slate-600">{decision.summary}</p>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
              Why High Priority
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{decision.whyHighPriority}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/80 bg-white/90 p-4">
            <div className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-indigo-500" />
              <p className="text-sm font-semibold text-slate-900">建议负责人</p>
            </div>
            <p className="mt-3 text-sm text-slate-600">{decision.recommendedOwnerName}</p>
          </div>

          <div className="rounded-2xl border border-white/80 bg-white/90 p-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-sky-500" />
              <p className="text-sm font-semibold text-slate-900">建议截止时间</p>
            </div>
            <p className="mt-3 text-sm text-slate-600">{decision.recommendedAtLabel}</p>
          </div>

          <div className="rounded-2xl border border-white/80 bg-white/90 p-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-semibold text-slate-900">当前状态</p>
            </div>
            <p className="mt-3 text-sm text-slate-600">{decision.statusLabel}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-white/80 bg-white/90 p-4">
            <p className="text-sm font-semibold text-slate-900">触发原因</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {decision.triggerReasons.length > 0 ? (
                decision.triggerReasons.map((reason) => (
                  <Badge
                    key={reason}
                    variant="warning"
                    className="whitespace-normal px-3 py-1 text-left leading-5"
                  >
                    {reason}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-slate-500">当前没有额外触发原因。</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/80 bg-white/90 p-4">
            <p className="text-sm font-semibold text-slate-900">关键发现</p>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              {decision.keyFindings.length > 0 ? (
                decision.keyFindings.map((finding) => (
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

        <div className="grid gap-3 xl:grid-cols-3">
          <ActionColumn
            icon={<School className="h-4 w-4 text-emerald-500" />}
            title="今日园内动作"
            items={decision.schoolActions}
            toneClassName="border-emerald-100 bg-emerald-50/80"
          />
          <ActionColumn
            icon={<Home className="h-4 w-4 text-indigo-500" />}
            title="今晚家庭任务"
            items={decision.homeActions}
            toneClassName="border-indigo-100 bg-indigo-50/70"
          />
          <ActionColumn
            icon={<CalendarClock className="h-4 w-4 text-sky-500" />}
            title="48 小时复查"
            items={decision.followUpActions}
            toneClassName="border-sky-100 bg-sky-50/80"
          />
        </div>

        <p className="text-xs text-slate-500">
          会诊生成时间：{decision.generatedAtLabel}
          {decision.statusSource === "dispatch" ? " | 状态已与派单同步" : ""}
        </p>
      </CardContent>
    </Card>
  );
}
