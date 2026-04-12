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
  careMode?: boolean;
}

function ParentTransparencyPanelContent({
  model,
  title = "涓轰粈涔堜細鐪嬪埌杩欐潯寤鸿",
  description = "鎶婂綋鍓嶅缓璁殑鏁版嵁鏉ユ簮銆佸彲淇″害鍜岄棴鐜姸鎬侊紝鐢ㄥ闀胯兘鐪嬫噦鐨勬柟寮忚鏄庢竻妤氥€?",
  institutionStatusNote,
  careMode = false,
}: ParentTransparencyPanelProps) {
  const [expanded, setExpanded] = useState(careMode ? false : model.defaultExpanded);
  const showDetailBlocks = !careMode || expanded;

  return (
    <SectionCard
      title={title}
      description={description}
      actions={
        <Badge variant={model.warnings.length > 0 ? "warning" : "info"} className="px-3 py-1">
          {model.warnings.length > 0 ? "闇€缁х画瑙傚療" : careMode ? "简化说明" : "閫忔槑璇存槑"}
        </Badge>
      }
    >
      <div data-testid="parent-transparency-panel" className="space-y-4">
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-medium tracking-[0.14em] text-slate-400">鏉ユ簮璇存槑</p>
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
                title="缁撴灉鍙俊搴?"
                body={model.reliabilityText}
                detail={model.coverageText}
                icon={<ShieldCheck className="h-4 w-4" />}
                careMode={careMode}
              />
              <InfoBlock
                title="鏈烘瀯渚ч棴鐜姸鎬?"
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
                <p className="text-sm font-semibold text-amber-900">褰撳墠浠嶆湁闇€瑕佺暀鎰忕殑鍦版柟</p>
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
                {careMode ? "想看看为什么这样建议" : "杩欐潯寤鸿鎬庝箞鏉ョ殑"}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {careMode
                  ? "这里只保留最关键的一层说明，需要时再展开详细来源。"
                  : "鐪嬩负浠€涔堜笉鏄嚟绌虹敓鎴愶紝浠ュ強绯荤粺褰撳墠鑳藉仛浠€涔堛€佷笉鑳藉仛浠€涔堛€?"}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? "收起说明" : "展开说明"}
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {expanded ? (
            <div className="mt-4 space-y-4">
              {careMode ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <InfoBlock
                    title="缁撴灉鍙俊搴?"
                    body={model.reliabilityText}
                    detail={model.coverageText}
                    icon={<ShieldCheck className="h-4 w-4" />}
                    careMode={careMode}
                  />
                  <InfoBlock
                    title="鏈烘瀯渚ч棴鐜姸鎬?"
                    body={model.closureStatus}
                    detail={institutionStatusNote}
                    icon={<Workflow className="h-4 w-4" />}
                    careMode={careMode}
                  />
                </div>
              ) : null}
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">涓轰粈涔堜笉鏄嚟绌虹敓鎴?</p>
                  <ul className={careMode ? "mt-3 space-y-3 text-base leading-7 text-slate-600" : "mt-3 space-y-2 text-sm leading-6 text-slate-600"}>
                    {model.evidenceBullets.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">绯荤粺杈圭晫</p>
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
  title = "涓轰粈涔堜細鐪嬪埌杩欐潯寤鸿",
  description = "鎶婂綋鍓嶅缓璁殑鏁版嵁鏉ユ簮銆佸彲淇″害鍜岄棴鐜姸鎬侊紝鐢ㄥ闀胯兘鐪嬫噦鐨勬柟寮忚鏄庢竻妤氥€?",
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
