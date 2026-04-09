"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { AlertTriangle, ArrowLeft, FileText, ShieldAlert, Stethoscope, Upload } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import {
  InlineLinkButton,
  RolePageShell,
  RoleSplitLayout,
  SectionCard,
} from "@/components/role-shell/RoleScaffold";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  HealthFileBridgeContraindication,
  HealthFileBridgeFact,
  HealthFileBridgeFile,
  HealthFileBridgeFollowUpHint,
  HealthFileBridgeRequest,
  HealthFileBridgeResponse,
  HealthFileBridgeRiskItem,
  HealthFileBridgeSourceRole,
} from "@/lib/ai/types";
import { useApp } from "@/lib/store";

const NONE_CHILD_VALUE = "__none__";
const UNSPECIFIED_FILE_KIND_VALUE = "__unspecified__";
const REQUEST_SOURCE = "teacher-health-file-bridge-page";

const FILE_KIND_OPTIONS = [
  { value: UNSPECIFIED_FILE_KIND_VALUE, label: "Unspecified" },
  { value: "health-note", label: "Health note" },
  { value: "lab-report", label: "Lab report" },
  { value: "prescription", label: "Prescription / checklist" },
  { value: "discharge-note", label: "Recheck / discharge note" },
  { value: "other", label: "Other" },
];

function formatBytes(value?: number) {
  if (!value || value <= 0) return "unknown size";
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function toUploadMeta(file: File, index: number, previewText: string): HealthFileBridgeFile {
  const generatedId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${file.name}-${file.lastModified}-${index}`;

  return {
    fileId: generatedId,
    name: file.name,
    mimeType: file.type || undefined,
    sizeBytes: file.size || undefined,
    pageCount: undefined,
    previewText: previewText || undefined,
    meta: {
      lastModified: file.lastModified,
    },
  };
}

function renderBooleanBadge(label: string, active: boolean) {
  return <Badge variant={active ? "warning" : "secondary"}>{`${label}: ${active ? "true" : "false"}`}</Badge>;
}

function riskVariant(level: HealthFileBridgeRiskItem["severity"]) {
  if (level === "high") return "destructive";
  if (level === "medium") return "warning";
  return "secondary";
}

function FactCard({ fact }: { fact: HealthFileBridgeFact }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-slate-900">{fact.label}</p>
        <Badge variant="secondary">{fact.source}</Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{fact.detail}</p>
    </div>
  );
}

function RiskCard({ risk }: { risk: HealthFileBridgeRiskItem }) {
  return (
    <div className="rounded-3xl border border-rose-100 bg-rose-50/50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-slate-900">{risk.title}</p>
        <Badge variant={riskVariant(risk.severity)}>{risk.severity}</Badge>
        <Badge variant="secondary">{risk.source}</Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{risk.detail}</p>
    </div>
  );
}

function DetailCard({
  title,
  detail,
  source,
}: HealthFileBridgeContraindication | HealthFileBridgeFollowUpHint) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <Badge variant="secondary">{source}</Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}

export default function TeacherHealthFileBridgePage() {
  const { currentUser, visibleChildren } = useApp();
  const [childId, setChildId] = useState<string>(NONE_CHILD_VALUE);
  const [sourceRole, setSourceRole] = useState<HealthFileBridgeSourceRole>("teacher");
  const [fileKind, setFileKind] = useState<string>(UNSPECIFIED_FILE_KIND_VALUE);
  const [previewText, setPreviewText] = useState("");
  const [optionalNotes, setOptionalNotes] = useState("");
  const [files, setFiles] = useState<HealthFileBridgeFile[]>([]);
  const [result, setResult] = useState<HealthFileBridgeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (childId !== NONE_CHILD_VALUE && visibleChildren.some((child) => child.id === childId)) {
      return;
    }
    setChildId(visibleChildren[0]?.id ?? NONE_CHILD_VALUE);
  }, [childId, visibleChildren]);

  const selectedChild = useMemo(
    () => visibleChildren.find((child) => child.id === childId) ?? null,
    [childId, visibleChildren]
  );

  if (visibleChildren.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <EmptyState
          icon={<Stethoscope className="h-6 w-6" />}
          title="No visible child is available"
          description="The health-file bridge needs at least one visible child profile for a bound extraction request."
        />
      </div>
    );
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []).map((file, index) =>
      toUploadMeta(file, index, previewText.trim())
    );
    setFiles(nextFiles);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (files.length === 0) {
      setError("Select at least one image or PDF.");
      return;
    }

    setIsSubmitting(true);

    const requestPayload: HealthFileBridgeRequest = {
      childId: childId === NONE_CHILD_VALUE ? undefined : childId,
      sourceRole,
      files: files.map((file) => ({
        ...file,
        previewText: previewText.trim() || file.previewText,
      })),
      fileKind: fileKind === UNSPECIFIED_FILE_KIND_VALUE ? undefined : fileKind,
      requestSource: REQUEST_SOURCE,
      optionalNotes: optionalNotes.trim() || undefined,
    };

    try {
      const response = await fetch("/api/ai/health-file-bridge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      const body = (await response.json().catch(() => null)) as
        | HealthFileBridgeResponse
        | { error?: string; detail?: string }
        | null;

      if (!response.ok) {
        const message =
          (body && "error" in body && body.error) ||
          (body && "detail" in body && body.detail) ||
          "Health file extraction failed.";
        throw new Error(message);
      }

      setResult(body as HealthFileBridgeResponse);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "Health file extraction failed."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <RolePageShell
      badge={`Teacher entry · T8 extraction · ${currentUser.className ?? "current class"}`}
      title="External Health File Bridge"
      description="T8 upgrades the upload skeleton into a structured extraction flow. This page now returns facts, risks, contraindications, and follow-up hints only. Daycare action mapping remains intentionally out of scope."
      actions={
        <>
          <Button asChild variant="outline" className="min-h-11 rounded-xl">
            <Link href="/teacher/home" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to teacher home
            </Link>
          </Button>
          <InlineLinkButton href="/teacher/agent" label="Teacher AI assistant" variant="premium" />
        </>
      }
    >
      <RoleSplitLayout
        main={
          <div className="space-y-6">
            <SectionCard
              title="Extraction Request"
              description="Upload file metadata, add OCR preview text if available, and keep any manual notes narrowly factual."
            >
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900">Child binding</p>
                    <Select value={childId} onValueChange={setChildId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select child" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_CHILD_VALUE}>No specific child</SelectItem>
                        {visibleChildren.map((child) => (
                          <SelectItem key={child.id} value={child.id}>
                            {child.name} · {child.className}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900">Source role</p>
                    <Select
                      value={sourceRole}
                      onValueChange={(value) => setSourceRole(value as HealthFileBridgeSourceRole)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="teacher">teacher</SelectItem>
                        <SelectItem value="parent">parent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900">File kind</p>
                    <Select value={fileKind} onValueChange={setFileKind}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select file kind" />
                      </SelectTrigger>
                      <SelectContent>
                        {FILE_KIND_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900">Upload image / PDF</p>
                    <Input type="file" accept="image/*,.pdf" multiple onChange={handleFileChange} />
                    <p className="text-xs leading-5 text-slate-500">
                      The current teacher page still sends file metadata plus optional text hints. Verified
                      binary OCR is not claimed here.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">OCR preview / extracted text</p>
                  <Textarea
                    value={previewText}
                    onChange={(event) => setPreviewText(event.target.value)}
                    placeholder="Example: Fever 38.1, recheck tomorrow morning, continue nebulizer."
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">Additional factual notes</p>
                  <Textarea
                    value={optionalNotes}
                    onChange={(event) => setOptionalNotes(event.target.value)}
                    placeholder="Add only extra facts that should help extraction, not daycare actions."
                  />
                </div>

                <div className="rounded-3xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-indigo-500" />
                    <p className="text-sm font-semibold text-slate-900">Selected file metadata</p>
                  </div>
                  <div className="mt-3 space-y-3">
                    {files.length > 0 ? (
                      files.map((file) => (
                        <div key={file.fileId ?? file.name} className="rounded-2xl bg-white p-3">
                          <p className="text-sm font-medium text-slate-900">{file.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {file.mimeType || "unknown mime"} · {formatBytes(file.sizeBytes)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No file selected yet.</p>
                    )}
                  </div>
                </div>

                {error ? <p className="text-sm text-rose-600">{error}</p> : null}

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" variant="premium" className="min-h-11 rounded-xl" disabled={isSubmitting}>
                    {isSubmitting ? "Extracting..." : "Run structured extraction"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 rounded-xl"
                    onClick={() => {
                      setPreviewText("");
                      setOptionalNotes("");
                      setFiles([]);
                      setResult(null);
                      setError(null);
                    }}
                    disabled={isSubmitting}
                  >
                    Reset
                  </Button>
                </div>
              </form>
            </SectionCard>

            <SectionCard
              title="Extracted Facts"
              description="These are structured facts only. They are not medical conclusions."
            >
              <div className="space-y-3">
                {result ? (
                  result.extractedFacts.map((fact) => <FactCard key={fact.label} fact={fact} />)
                ) : (
                  <p className="text-sm text-slate-500">Submit a request to see `extractedFacts`.</p>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Risk Items"
              description="Risks stay conservative and should be verified against the original document."
            >
              <div className="space-y-3">
                {result ? (
                  result.riskItems.map((risk) => <RiskCard key={risk.title} risk={risk} />)
                ) : (
                  <p className="text-sm text-slate-500">Submit a request to see `riskItems`.</p>
                )}
              </div>
            </SectionCard>

            <div className="grid gap-6 xl:grid-cols-2">
              <SectionCard
                title="Contraindications"
                description="These are extraction-time caution items, not executed actions."
              >
                <div className="space-y-3">
                  {result ? (
                    result.contraindications.length > 0 ? (
                      result.contraindications.map((item) => (
                        <DetailCard key={item.title} {...item} />
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No contraindication hint was extracted.</p>
                    )
                  ) : (
                    <p className="text-sm text-slate-500">Submit a request to see `contraindications`.</p>
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="Follow-up Hints"
                description="Follow-up timing stays as extracted context for later mapping work."
              >
                <div className="space-y-3">
                  {result ? (
                    result.followUpHints.map((item) => <DetailCard key={item.title} {...item} />)
                  ) : (
                    <p className="text-sm text-slate-500">Submit a request to see `followUpHints`.</p>
                  )}
                </div>
              </SectionCard>
            </div>
          </div>
        }
        aside={
          <div className="space-y-6">
            <SectionCard
              title="Current boundary"
              description="This page is intentionally extraction-only in T8."
            >
              <ul className="space-y-3 text-sm leading-6 text-slate-600">
                <li>No verified binary OCR or PDF parsing is claimed on the teacher page yet.</li>
                <li>No daycare action mapping is generated in T8.</li>
                <li>No writeback or escalation dispatch is triggered.</li>
                <li>`source`, `fallback`, and `liveReadyButNotVerified` are shown as-is for honesty.</li>
              </ul>
            </SectionCard>

            <SectionCard
              title="Request context"
              description="Useful context for validating the extraction request shape."
            >
              <div className="space-y-3 text-sm text-slate-600">
                <div className="rounded-2xl bg-white p-4">
                  <p className="font-semibold text-slate-900">Child</p>
                  <p className="mt-1">
                    {selectedChild ? `${selectedChild.name} · ${selectedChild.className}` : "No specific child"}
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="font-semibold text-slate-900">requestSource</p>
                  <p className="mt-1">{REQUEST_SOURCE}</p>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="font-semibold text-slate-900">Selected files</p>
                  <p className="mt-1">{files.length}</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Extraction status"
              description="The result flags stay explicit and conservative."
            >
              {result ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="info">{`source: ${result.source}`}</Badge>
                    <Badge variant="secondary">{`fileType: ${result.fileType}`}</Badge>
                    <Badge variant="outline">{`confidence: ${Math.round(result.confidence * 100)}%`}</Badge>
                    {renderBooleanBadge("fallback", result.fallback)}
                    {renderBooleanBadge("mock", result.mock)}
                    {renderBooleanBadge("liveReadyButNotVerified", result.liveReadyButNotVerified)}
                  </div>
                  <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-indigo-600" />
                      <p className="text-sm font-semibold text-slate-900">Summary</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{result.summary}</p>
                    <p className="mt-3 text-xs leading-5 text-slate-500">{result.disclaimer}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Submit a request to see bridge status flags.</p>
              )}
            </SectionCard>

            <SectionCard
              title="Why this is conservative"
              description="This is the core honesty model for T8."
            >
              <div className="space-y-3">
                <div className="rounded-3xl border border-amber-100 bg-amber-50/60 p-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-semibold text-slate-900">Text-only fallback today</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    The current page forwards file metadata and optional text hints. If you need a real OCR
                    walkthrough later, T9/T10 can consume a stronger binary/file-url contract.
                  </p>
                </div>
                <div className="rounded-3xl border border-slate-100 bg-white p-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-slate-700" />
                    <p className="text-sm font-semibold text-slate-900">No premature action mapping</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    T8 stops at facts, risks, contraindications, and follow-up hints, so downstream contracts can
                    evolve separately.
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>
        }
      />
    </RolePageShell>
  );
}
