"use client";

import { Clock3, MessageSquareText, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TeacherAgentResult } from "@/lib/agent/teacher-agent";
import { buildTeacherAgentTimeLabel } from "@/lib/agent/teacher-agent";

export default function TeacherAgentResultCard({ result }: { result: TeacherAgentResult }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Badge variant={result.objectScope === "class" ? "info" : "warning"}>
          {result.objectScope === "class" ? "班级模式" : "单个儿童模式"}
        </Badge>
        <Badge variant={result.source === "ai" ? "success" : result.source === "mock" ? "info" : "secondary"}>
          来源：{result.source}
        </Badge>
        {result.model ? <Badge variant="secondary">{result.model}</Badge> : null}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-900">{result.title}</h3>
        <p className="mt-2 text-sm leading-7 text-slate-700">{result.summary}</p>
      </div>

      {result.highlights.length > 0 ? (
        <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-100">
          <p className="text-sm font-semibold text-slate-900">关键点</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
            {result.highlights.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.keyChildren?.length || result.riskTypes?.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {result.keyChildren?.length ? (
            <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-100">
              <p className="text-sm font-semibold text-slate-900">重点儿童</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.keyChildren.map((item) => (
                  <Badge key={item} variant="warning">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {result.riskTypes?.length ? (
            <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-100">
              <p className="text-sm font-semibold text-slate-900">主要风险类型</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.riskTypes.map((item) => (
                  <Badge key={item} variant="secondary">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {result.actionItems.length > 0 ? (
        <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-100">
          <p className="text-sm font-semibold text-slate-900">行动列表</p>
          <div className="mt-3 space-y-3">
            {result.actionItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-indigo-500" />
                    <p className="text-sm font-semibold text-slate-900">{item.target}</p>
                  </div>
                  <Badge variant="info">{item.timing}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">原因：{item.reason}</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">建议动作：{item.action}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {result.parentMessageDraft ? (
        <div className="rounded-3xl border border-indigo-100 bg-indigo-50/70 p-4">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-indigo-600" />
            <p className="text-sm font-semibold text-slate-900">家长沟通建议稿</p>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-700">{result.parentMessageDraft}</p>
        </div>
      ) : null}

      {result.tomorrowObservationPoint ? (
        <div className="rounded-3xl border border-amber-100 bg-amber-50/70 p-4">
          <p className="text-sm font-semibold text-slate-900">下一步</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">{result.tomorrowObservationPoint}</p>
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Clock3 className="h-3.5 w-3.5" />
        <span>生成时间：{buildTeacherAgentTimeLabel(result.generatedAt)}</span>
      </div>
    </div>
  );
}
