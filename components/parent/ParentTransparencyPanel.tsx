"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ShieldCheck, TriangleAlert, Workflow } from "lucide-react";
import ParentSpeakButton from "@/components/parent/ParentSpeakButton";
import type { ParentTransparencyViewModel } from "@/lib/agent/parent-transparency";
import { SectionCard } from "@/components/role-shell/RoleScaffold";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildParentSpeechScript } from "@/lib/voice/browser-tts";

export interface ParentTransparencyPanelProps {
  model: ParentTransparencyViewModel;
  title?: string;
  description?: string;
  institutionStatusNote?: string;
  careMode?: boolean;
}

function ParentTransparencyPanelContent({
  model,
  title = "Why This Suggestion",
  description = "Show the data source, reliability, and closure status behind the current parent-facing suggestion.",
  institutionStatusNote,
  careMode = false,
}: ParentTransparencyPanelProps) {
  const [expanded, setExpanded] = useState(careMode ? false : model.defaultExpanded);
  const showDetailBlocks = !careMode || expanded;
  const speechText = buildParentSpeechScript({
    title,
    sections: [
      { label: "summary", text: model.summarySentence },
      { label: "reliability", text: model.reliabilityText },
      { label: "closure", text: model.closureStatus },
      { label: "warning", text: model.warnings[0] },
    ],
    outro: "Browser TTS only. This is not backend-generated voice.",
  });

  return (
    <SectionCard
      title={title}
      description={description}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={model.warnings.length > 0 ? "warning" : "info"} className="px-3 py-1">
            {model.warnings.length > 0 ? "Has alerts" : careMode ? "Care mode" : "Transparency"}
          </Badge>
          <ParentSpeakButton
            text={speechText}
            label={"\u8bfb\u7ed9\u6211\u542c"}
            careMode={careMode}
            className={careMode ? "min-w-[220px]" : ""}
          />
        </div>
      }
    >
      <div data-testid="parent-transparency-panel" className="space-y-4">
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-medium tracking-[0.14em] text-slate-400">Summary</p>
          <p className={careMode ? "mt-3 text-base leading-8 text-slate-800" : "mt-2 text-sm leading-7 text-slate-700"}>
            {model.summarySentence}
          </p>
        </div>

        {showDetailBlocks ? (
          <>
            <div className="flex flex-wrap gap-2">
              {model.sourceBadges.map((badge) => (
                <Badge key={badge.id} variant={badge.variant}>
                  {badge.label}
                </Badge>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <InfoBlock
                title="Reliability"
                body={model.reliabilityText}
                detail={model.coverageText}
                icon={<ShieldCheck className="h-4 w-4" />}
                careMode={careMode}
              />
              <InfoBlock
                title="Closure status"
                body={model.closureStatus}
                detail={institutionStatusNote}
                icon={<Workflow className="h-4 w-4" />}
                careMode={careMode}
              />
            </div>
          </>
        ) : null}

        {model.warnings.length > 0 ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900">Points to keep in mind</p>
                <ul className={careMode ? "mt-3 space-y-3 text-base leading-7 text-amber-900/90" : "mt-2 space-y-2 text-sm leading-6 text-amber-900/90"}>
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
              <p className="text-sm font-semibold text-slate-900">
                {careMode ? "See more detail?" : "Expand details"}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {careMode
                  ? "Care mode keeps just one summary layer visible by default."
                  : "Expand to review evidence bullets and boundary notes."}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? "Hide details" : "Show details"}
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {expanded ? (
            <div className="mt-4 space-y-4">
              {careMode ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <InfoBlock
                    title="Reliability"
                    body={model.reliabilityText}
                    detail={model.coverageText}
                    icon={<ShieldCheck className="h-4 w-4" />}
                    careMode={careMode}
                  />
                  <InfoBlock
                    title="Closure status"
                    body={model.closureStatus}
                    detail={institutionStatusNote}
                    icon={<Workflow className="h-4 w-4" />}
                    careMode={careMode}
                  />
                </div>
              ) : null}
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Evidence bullets</p>
                  <ul className={careMode ? "mt-3 space-y-3 text-base leading-7 text-slate-600" : "mt-3 space-y-2 text-sm leading-6 text-slate-600"}>
                    {model.evidenceBullets.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Boundary notes</p>
                  <ul className={careMode ? "mt-3 space-y-3 text-base leading-7 text-slate-600" : "mt-3 space-y-2 text-sm leading-6 text-slate-600"}>
                    {model.boundaryNotes.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
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
  careMode = false,
}: {
  title: string;
  body: string;
  detail?: string;
  icon: ReactNode;
  careMode?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="text-slate-500">{icon}</span>
        {title}
      </div>
      <p className={careMode ? "mt-3 text-base leading-8 text-slate-700" : "mt-3 text-sm leading-7 text-slate-700"}>
        {body}
      </p>
      {detail ? <p className={careMode ? "mt-2 text-sm leading-7 text-slate-500" : "mt-2 text-sm leading-6 text-slate-500"}>{detail}</p> : null}
    </div>
  );
}

export default function ParentTransparencyPanel({
  model,
  title = "Why This Suggestion",
  description = "Show the data source, reliability, and closure status behind the current parent-facing suggestion.",
  institutionStatusNote,
  careMode = false,
}: ParentTransparencyPanelProps) {
  const resetKey = [
    model.summarySentence,
    model.defaultExpanded ? "open" : "closed",
    model.warnings.join("|"),
    careMode ? "care" : "normal",
  ].join("::");

  return (
    <ParentTransparencyPanelContent
      key={resetKey}
      model={model}
      title={title}
      description={description}
      institutionStatusNote={institutionStatusNote}
      careMode={careMode}
    />
  );
}
