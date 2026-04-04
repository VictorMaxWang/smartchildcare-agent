"use client";

import Link from "next/link";
import { Activity, Bug, CheckCircle2, ListChecks, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ConsultationTraceCase, ConsultationTraceViewModel } from "@/lib/consultation/trace-types";
import { cn } from "@/lib/utils";

const DEBUG_CASES: Array<{
  value: ConsultationTraceCase;
  label: string;
  description: string;
  expected: string;
}> = [
  {
    value: "fallback",
    label: "Provider fallback",
    description: "前端演练。模拟 provider fallback，但主内容仍完整可读。",
    expected: "应看到 fallback 可见，但不淹没主内容；memory 仍保持可读状态。",
  },
  {
    value: "empty-memory",
    label: "Empty memory",
    description: "前端演练。模拟没有历史记忆命中的情况。",
    expected: "应看到明确空记忆文案，但会诊故事线仍可继续展示。",
  },
  {
    value: "partial",
    label: "SSE partial",
    description: "前端演练。模拟 SSE 在当前建议阶段提前结束。",
    expected: "应保留已收到的长期画像/最近快照内容，整体状态为部分结果。",
  },
  {
    value: "invalid-result",
    label: "Invalid done.result",
    description: "前端演练。模拟 done 已到达但 result 缺关键字段。",
    expected: "应出现缺字段提示，不同步 consultation、不写 intervention card、不建 reminder。",
  },
  {
    value: "error",
    label: "Backend error",
    description: "前端演练。模拟 consultation response unavailable / upstream error。",
    expected: "应看到错误状态，但页面和 trace 仍稳定可读。",
  },
];

function getCurrentCaseMeta(activeCase: ConsultationTraceCase | null) {
  return DEBUG_CASES.find((item) => item.value === activeCase) ?? null;
}

export default function ConsultationQaPanel({
  viewModel,
  activeCase,
  className,
}: {
  viewModel: ConsultationTraceViewModel;
  activeCase: ConsultationTraceCase | null;
  className?: string;
}) {
  const currentCase = getCurrentCaseMeta(activeCase);
  const isRealWalkthrough = activeCase === null;

  return (
    <Card className={cn("border-dashed border-slate-200 bg-slate-50/80 shadow-sm", className)}>
      <CardHeader className="gap-3 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="warning">调试态 QA</Badge>
          <Badge variant={isRealWalkthrough ? "success" : "secondary"}>
            {isRealWalkthrough ? "真实链路" : "前端演练"}
          </Badge>
          <Badge variant="outline">{viewModel.overallStatusLabel}</Badge>
        </div>
        <CardTitle className="flex items-center gap-2 text-base text-slate-900">
          <ListChecks className="h-4 w-4 text-sky-500" />
          联调 / 答辩前检查入口
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">真实 consultation SSE 主链</Badge>
            <Badge variant="outline">/teacher/high-risk-consultation?trace=debug</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              asChild
              size="sm"
              variant={isRealWalkthrough ? "premium" : "outline"}
              className="rounded-full"
            >
              <Link href="/teacher/high-risk-consultation?trace=debug">
                <Radio className="mr-2 h-4 w-4" />
                打开真实 walkthrough
              </Link>
            </Button>
          </div>
          <ol className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
            <li>1. 保持当前输入区不变，选择儿童并点击“一键生成会诊”。</li>
            <li>2. 确认 trace 依次经过 `loading / streaming / done`。</li>
            <li>3. 重点看长期画像、最近会诊 / 快照、当前建议、providerTrace、memoryMeta 和最终落点。</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline">长期画像命中</Badge>
            <Badge variant="outline">最近会诊 / 快照</Badge>
            <Badge variant="outline">当前建议</Badge>
            <Badge variant="outline">providerTrace</Badge>
            <Badge variant="outline">memoryMeta</Badge>
            <Badge variant="outline">done.result 最终落点</Badge>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning">固定 5 个 debug case</Badge>
            <span className="text-sm text-amber-900">这些是前端演练，不会发起真实故障注入。</span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {DEBUG_CASES.map((item) => {
              const active = item.value === activeCase;
              return (
                <div key={item.value} className="rounded-2xl border border-white/80 bg-white/85 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={active ? "warning" : "secondary"}>{item.label}</Badge>
                      {active ? <Badge variant="outline">当前查看</Badge> : null}
                    </div>
                    <Button
                      asChild
                      size="sm"
                      variant={active ? "secondary" : "outline"}
                      className="rounded-full"
                    >
                      <Link href={`/teacher/high-risk-consultation?trace=debug&traceCase=${item.value}`}>
                        <Bug className="mr-2 h-4 w-4" />
                        打开
                      </Link>
                    </Button>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{item.description}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.expected}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Activity className="h-4 w-4 text-indigo-500" />
              当前检查对象
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {currentCase
                ? `${currentCase.label}：${currentCase.expected}`
                : "真实 consultation SSE 主链。这里应以真实 trace、真实 providerTrace / memoryMeta 和最终结果落点为准。"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              固定断言
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              <li>partial 时保留已收到的阶段内容。</li>
              <li>empty memory 有明确文案。</li>
              <li>provider fallback 可见但不淹没主内容。</li>
              <li>invalid done.result 不写 store、不建 reminder。</li>
              <li>error 状态可见且不导致页面崩掉。</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
