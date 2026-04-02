"use client";

import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buildTeacherAgentTimeLabel, type TeacherAgentResult } from "@/lib/agent/teacher-agent";

export interface TeacherAgentHistoryListItem {
  id: string;
  actionLabel: string;
  targetLabel: string;
  result: TeacherAgentResult;
}

export default function TeacherAgentHistoryList({ items }: { items: TeacherAgentHistoryListItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">还没有历史记录，先触发一个工作流。</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-3xl border border-slate-100 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <p className="text-sm font-semibold text-slate-900">{item.actionLabel}</p>
            <Badge variant="secondary">{item.targetLabel}</Badge>
            <Badge variant={item.result.source === "ai" ? "success" : item.result.source === "mock" ? "info" : "secondary"}>
              {item.result.source}
            </Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item.result.summary}</p>
          <p className="mt-2 text-xs text-slate-500">{buildTeacherAgentTimeLabel(item.result.generatedAt)}</p>
        </div>
      ))}
    </div>
  );
}
