"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ShieldCheck, TriangleAlert, Workflow } from "lucide-react";
import type { ParentTransparencyViewModel } from "@/lib/agent/parent-transparency";
import { SectionCard } from "@/components/role-shell/RoleScaffold";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ParentTransparencyPanelProps {
  model: ParentTransparencyViewModel;
  title?: string;
  description?: string;
  institutionStatusNote?: string;
}

function ParentTransparencyPanelContent({
  model,
  title = "为什么会看到这条建议",
  description = "把当前建议的数据来源、可信度和闭环状态，用家长能看懂的方式说明清楚。",
  institutionStatusNote,
}: ParentTransparencyPanelProps) {
  const [expanded, setExpanded] = useState(model.defaultExpanded);

  return (
    <SectionCard
      title={title}
      description={description}
      actions={
        <Badge variant={model.warnings.length > 0 ? "warning" : "info"} className="px-3 py-1">
          {model.warnings.length > 0 ? "需继续观察" : "透明说明"}
        </Badge>
      }
    >
      <div data-testid="parent-transparency-panel" className="space-y-4">
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-medium tracking-[0.14em] text-slate-400">来源说明</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">{model.summarySentence}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {model.sourceBadges.map((badge) => (
            <Badge key={badge.id} variant={badge.variant}>
              {badge.label}
            </Badge>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <InfoBlock
            title="结果可信度"
            body={model.reliabilityText}
            detail={model.coverageText}
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <InfoBlock
            title="机构侧闭环状态"
            body={model.closureStatus}
            detail={institutionStatusNote}
            icon={<Workflow className="h-4 w-4" />}
          />
        </div>

        {model.warnings.length > 0 ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900">当前仍有需要留意的地方</p>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-amber-900/90">
                  {model.warnings.map((warning) => (
                    <li key={warning}>- {warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        <div className="rounded-3xl border border-slate-100 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">这条建议怎么来的</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                看为什么不是凭空生成，以及系统当前能做什么、不能做什么。
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? "收起说明" : "查看更多"}
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {expanded ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">为什么不是凭空生成</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  {model.evidenceBullets.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">系统边界</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  {model.boundaryNotes.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}

function InfoBlock({
  title,
  body,
  detail,
  icon,
}: {
  title: string;
  body: string;
  detail?: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="text-slate-500">{icon}</span>
        {title}
      </div>
      <p className="mt-3 text-sm leading-7 text-slate-700">{body}</p>
      {detail ? <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p> : null}
    </div>
  );
}

export default function ParentTransparencyPanel({
  model,
  title = "为什么会看到这条建议",
  description = "把当前建议的数据来源、可信度和闭环状态，用家长能看懂的方式说明清楚。",
  institutionStatusNote,
}: ParentTransparencyPanelProps) {
  const resetKey = [
    model.summarySentence,
    model.defaultExpanded ? "open" : "closed",
    model.warnings.join("|"),
  ].join("::");

  return (
    <ParentTransparencyPanelContent
      key={resetKey}
      model={model}
      title={title}
      description={description}
      institutionStatusNote={institutionStatusNote}
    />
  );
}
