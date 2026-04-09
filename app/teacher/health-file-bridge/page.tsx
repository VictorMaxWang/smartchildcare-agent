"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowLeft,
  FileText,
  ShieldPlus,
  Stethoscope,
  Upload,
} from "lucide-react";
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
  HealthFileBridgeActionItem,
  HealthFileBridgeFact,
  HealthFileBridgeFile,
  HealthFileBridgeFollowUpItem,
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
  { value: UNSPECIFIED_FILE_KIND_VALUE, label: "未指定文件类型" },
  { value: "health-note", label: "健康说明 / 诊疗备注" },
  { value: "lab-report", label: "检验 / 化验报告" },
  { value: "prescription", label: "处方 / 用药说明" },
  { value: "discharge-note", label: "出院 / 复查单" },
  { value: "other", label: "其他外部健康文件" },
];

function formatBytes(value?: number) {
  if (!value || value <= 0) return "未知大小";
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

function ActionItemCard({ item }: { item: HealthFileBridgeActionItem | HealthFileBridgeFollowUpItem }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
        <Badge variant="outline">{`owner: ${item.ownerRole}`}</Badge>
        {"timing" in item ? <Badge variant="secondary">{item.timing}</Badge> : null}
        {"due" in item ? <Badge variant="secondary">{item.due}</Badge> : null}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
      <p className="mt-2 text-xs text-slate-400">{item.source}</p>
    </div>
  );
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
          title="当前账号没有可绑定的幼儿"
          description="T7 健康文件桥接 skeleton 需要至少一个教师可见幼儿，用于演示园外健康资料到园内动作的桥接。"
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
      setError("请至少选择 1 个图片或 PDF 文件。");
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
        headers: {
          "Content-Type": "application/json",
        },
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
          "健康文件桥接请求失败。";
        throw new Error(message);
      }

      setResult(body as HealthFileBridgeResponse);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "健康文件桥接请求失败。"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <RolePageShell
      badge={`教师入口 · T7 skeleton · ${currentUser.className ?? "当前班级"}`}
      title="把园外健康文件桥接成园内可执行动作"
      description="这轮只交付最小可运行 skeleton：接收图片 / PDF 元信息和手填摘要，输出园内动作、家庭今晚动作、跟进计划、升级建议和写回建议。当前不执行真实 OCR、不执行真实 writeback，也不验证 live escalation。"
      actions={
        <>
          <Button asChild variant="outline" className="min-h-11 rounded-xl">
            <Link href="/teacher/home" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              返回教师工作台
            </Link>
          </Button>
          <InlineLinkButton href="/teacher/agent" label="进入教师 AI 助手" variant="premium" />
        </>
      }
    >
      <RoleSplitLayout
        main={
          <div className="space-y-6">
            <SectionCard
              title="桥接请求"
              description="上传文件只采集元信息；如果要模拟 OCR 或家长补充摘要，请直接填到下方文本框。"
            >
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900">绑定幼儿</p>
                    <Select value={childId} onValueChange={setChildId}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择幼儿" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_CHILD_VALUE}>暂不绑定具体幼儿</SelectItem>
                        {visibleChildren.map((child) => (
                          <SelectItem key={child.id} value={child.id}>
                            {child.name} · {child.className}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900">资料来源角色</p>
                    <Select
                      value={sourceRole}
                      onValueChange={(value) => setSourceRole(value as HealthFileBridgeSourceRole)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择来源角色" />
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
                    <p className="text-sm font-semibold text-slate-900">文件类型</p>
                    <Select value={fileKind} onValueChange={setFileKind}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择文件类型" />
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
                    <p className="text-sm font-semibold text-slate-900">上传图片 / PDF</p>
                    <Input type="file" accept="image/*,.pdf" multiple onChange={handleFileChange} />
                    <p className="text-xs leading-5 text-slate-500">
                      当前只采集文件名、mime type、大小等元信息，便于演示 skeleton 主路径。
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">外部文件摘要 / OCR 占位文本</p>
                  <Textarea
                    value={previewText}
                    onChange={(event) => setPreviewText(event.target.value)}
                    placeholder="例如：家长上传复查单，写有体温 38.1、建议明早复测；或：处方提示继续雾化、注意过敏史。"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">教师补充说明</p>
                  <Textarea
                    value={optionalNotes}
                    onChange={(event) => setOptionalNotes(event.target.value)}
                    placeholder="补充这次桥接想解决的园内动作，例如：今天到园后先看体温、午睡前复查、离园时同步家长。"
                  />
                </div>

                <div className="rounded-3xl border border-slate-100 bg-slate-50/80 p-4">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-indigo-500" />
                    <p className="text-sm font-semibold text-slate-900">本次文件元信息</p>
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
                      <p className="text-sm text-slate-500">尚未选择文件。</p>
                    )}
                  </div>
                </div>

                {error ? <p className="text-sm text-rose-600">{error}</p> : null}

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" variant="premium" className="min-h-11 rounded-xl" disabled={isSubmitting}>
                    {isSubmitting ? "桥接中..." : "生成健康文件桥接结果"}
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
                    清空表单
                  </Button>
                </div>
              </form>
            </SectionCard>

            <SectionCard
              title="提取到的事实"
              description="只输出桥接所需事实，不解释为医疗诊断。"
            >
              <div className="space-y-3">
                {result ? (
                  result.extractedFacts.map((fact) => <FactCard key={fact.label} fact={fact} />)
                ) : (
                  <p className="text-sm text-slate-500">提交后会在这里展示 `extractedFacts`。</p>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="风险项"
              description="提醒教师今天需要关注什么，但不把外部文件直接当作结论。"
            >
              <div className="space-y-3">
                {result ? (
                  result.riskItems.map((risk) => <RiskCard key={risk.title} risk={risk} />)
                ) : (
                  <p className="text-sm text-slate-500">提交后会在这里展示 `riskItems`。</p>
                )}
              </div>
            </SectionCard>

            <div className="grid gap-6 xl:grid-cols-2">
              <SectionCard
                title="园内今天动作"
                description="给老师的 same-day bridge actions。"
              >
                <div className="space-y-3">
                  {result ? (
                    result.schoolTodayActions.map((item) => (
                      <ActionItemCard key={item.title} item={item} />
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">提交后会在这里展示 `schoolTodayActions`。</p>
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="家庭今晚动作"
                description="把文件内容桥接成家长今晚可执行的补充动作。"
              >
                <div className="space-y-3">
                  {result ? (
                    result.familyTonightActions.map((item) => (
                      <ActionItemCard key={item.title} item={item} />
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">提交后会在这里展示 `familyTonightActions`。</p>
                  )}
                </div>
              </SectionCard>
            </div>

            <SectionCard
              title="跟进计划"
              description="面向 T8/T9/T10 扩展的 follow-up skeleton。"
            >
              <div className="space-y-3">
                {result ? (
                  result.followUpPlan.map((item) => <ActionItemCard key={item.title} item={item} />)
                ) : (
                  <p className="text-sm text-slate-500">提交后会在这里展示 `followUpPlan`。</p>
                )}
              </div>
            </SectionCard>
          </div>
        }
        aside={
          <div className="space-y-6">
            <SectionCard
              title="当前边界"
              description="本页只验证 T7 skeleton 的主路径，不宣称完成闭环。"
            >
              <ul className="space-y-3 text-sm leading-6 text-slate-600">
                <li>只接文件元信息和手填摘要，不执行真实 OCR。</li>
                <li>输出目标是园内动作、家庭动作、跟进和升级建议，不做医疗解释。</li>
                <li>`writebackSuggestion` 只给 draft 结构，不触发真实写回。</li>
                <li>`escalationSuggestion` 只给建议，不触发真实会诊链路。</li>
              </ul>
            </SectionCard>

            <SectionCard
              title="本次上下文"
              description="帮助老师确认这次桥接绑定的对象和入口。"
            >
              <div className="space-y-3 text-sm text-slate-600">
                <div className="rounded-2xl bg-white p-4">
                  <p className="font-semibold text-slate-900">绑定幼儿</p>
                  <p className="mt-1">{selectedChild ? `${selectedChild.name} · ${selectedChild.className}` : "未绑定具体幼儿"}</p>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="font-semibold text-slate-900">requestSource</p>
                  <p className="mt-1">{REQUEST_SOURCE}</p>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="font-semibold text-slate-900">已选文件</p>
                  <p className="mt-1">{files.length} 个</p>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="桥接结果状态"
              description="强制暴露 source / fallback / mock / liveReadyButNotVerified。"
            >
              {result ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="info">{`source: ${result.source}`}</Badge>
                    {renderBooleanBadge("fallback", result.fallback)}
                    {renderBooleanBadge("mock", result.mock)}
                    {renderBooleanBadge("liveReadyButNotVerified", result.liveReadyButNotVerified)}
                  </div>
                  <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-indigo-600" />
                      <p className="text-sm font-semibold text-slate-900">summary</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{result.summary}</p>
                    <p className="mt-3 text-xs leading-5 text-slate-500">{result.disclaimer}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">提交后会在这里展示 bridge status flags。</p>
              )}
            </SectionCard>

            <SectionCard
              title="升级建议"
              description="仅为结构化占位，不代表系统已发起升级流程。"
            >
              {result ? (
                <div className="rounded-3xl border border-amber-100 bg-amber-50/60 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldPlus className="h-4 w-4 text-amber-600" />
                    <p className="text-sm font-semibold text-slate-900">{result.escalationSuggestion.level}</p>
                    <Badge variant={result.escalationSuggestion.shouldEscalate ? "warning" : "secondary"}>
                      {result.escalationSuggestion.shouldEscalate ? "shouldEscalate" : "no escalation"}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{result.escalationSuggestion.reason}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{result.escalationSuggestion.nextStep}</p>
                  <p className="mt-2 text-xs text-slate-400">{result.escalationSuggestion.source}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">提交后会在这里展示 `escalationSuggestion`。</p>
              )}
            </SectionCard>

            <SectionCard
              title="写回建议"
              description="只提供未来 T10 可接入的 writeback draft。"
            >
              {result ? (
                <div className="rounded-3xl border border-slate-100 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{result.writebackSuggestion.destination}</Badge>
                    <Badge variant="outline">{result.writebackSuggestion.status}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{result.writebackSuggestion.summary}</p>
                  <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 p-3 text-xs leading-6 text-slate-100">
                    {JSON.stringify(result.writebackSuggestion.payload, null, 2)}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-slate-500">提交后会在这里展示 `writebackSuggestion`。</p>
              )}
            </SectionCard>
          </div>
        }
      />
    </RolePageShell>
  );
}
