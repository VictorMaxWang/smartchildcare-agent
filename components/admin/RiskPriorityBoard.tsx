"use client";

import Link from "next/link";
import { ArrowRight, ShieldAlert } from "lucide-react";
import ConsultationTraceCard from "@/components/admin/ConsultationTraceCard";
import DirectorDecisionCard from "@/components/admin/DirectorDecisionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminConsultationPriorityItem } from "@/lib/agent/admin-consultation";
import { cn } from "@/lib/utils";

export default function RiskPriorityBoard({
  items,
  className,
  emptyHref = "/teacher/high-risk-consultation",
}: {
  items: AdminConsultationPriorityItem[];
  className?: string;
  emptyHref?: string;
}) {
  if (items.length === 0) {
    return (
      <div
        className={cn(
          "rounded-[28px] border border-dashed border-slate-200 bg-slate-50/70 p-5 text-sm text-slate-600",
          className
        )}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div className="space-y-2">
              <p className="font-semibold text-slate-900">当前还没有升级到园长侧的重点会诊</p>
              <p className="leading-6">
                教师端完成高风险会诊后，这里会自动出现“今日重点会诊 / 高风险优先事项”，用于园长答辩展示和派单闭环。
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="min-h-11 rounded-xl md:self-start">
            <Link href={emptyHref} className="gap-2">
              去教师会诊入口
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="warning">AI 园长办公会</Badge>
        <Badge variant="outline">默认展示 {items.length} 条今日重点会诊</Badge>
        <Badge variant="info">按风险等级、处理状态、生成时间排序</Badge>
      </div>

      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.consultation.consultationId}
            className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]"
          >
            <DirectorDecisionCard item={item} />
            <ConsultationTraceCard item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}
