"use client";

import Link from "next/link";
import { AlertTriangle, BookOpenCheck, BrainCircuit, MessageSquareText, PencilLine, ShieldCheck, UsersRound } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import {
  AssistantEntryCard,
  InlineLinkButton,
  MetricGrid,
  RolePageShell,
  RoleSplitLayout,
  SectionCard,
} from "@/components/role-shell/RoleScaffold";
import { Badge } from "@/components/ui/badge";
import { buildTeacherHomeViewModel } from "@/lib/view-models/role-home";
import { useApp } from "@/lib/store";

const TODAY_TEXT = new Date().toLocaleDateString("zh-CN", {
  month: "long",
  day: "numeric",
  weekday: "long",
});

export default function TeacherHomePage() {
  const { currentUser, visibleChildren, presentChildren, healthCheckRecords, growthRecords, guardianFeedbacks } = useApp();
  const viewModel = buildTeacherHomeViewModel({
    visibleChildren,
    presentChildren,
    healthCheckRecords,
    growthRecords,
    guardianFeedbacks,
  });

  if (visibleChildren.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <EmptyState
          icon={<UsersRound className="h-6 w-6" />}
          title="当前教师账号还没有班级可见数据"
          description="请先使用示例教师账号，或为普通教师账号关联班级与儿童。"
        />
      </div>
    );
  }

  return (
    <RolePageShell
      badge={`教师首页 · ${currentUser.className ?? "当前班级"} · ${TODAY_TEXT}`}
      title="今天先处理最紧急的儿童，再把家长沟通和录入路径走顺"
      description="教师首页只保留高频任务：异常儿童、未晨检、待复查、待沟通家长和快捷录入入口。移动端优先看任务，PC 端补充摘要。"
      actions={
        <>
          <InlineLinkButton href="/teacher/agent" label="进入教师 AI 助手" variant="premium" />
          <InlineLinkButton href="/teacher/agent?action=communication" label="一键生成家长沟通建议" />
        </>
      }
    >
      <RoleSplitLayout
        main={
          <div className="space-y-6">
            <MetricGrid
              items={viewModel.heroStats.map((item, index) => ({
                ...item,
                tone: index === 0 ? "amber" : index === 1 ? "sky" : index === 2 ? "indigo" : "emerald",
              }))}
            />

            <SectionCard title="今日异常儿童" description="优先处理晨检异常，避免高频事项被淹没。">
              <div className="space-y-3">
                {viewModel.todayAbnormalChildren.length > 0 ? (
                  viewModel.todayAbnormalChildren.map((item) => (
                    <div key={item.record.id} className="rounded-3xl border border-rose-100 bg-rose-50/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{item.child.name}</p>
                        <Badge variant="warning">需优先处理</Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        体温 {item.record.temperature}℃ · {item.record.mood} · {item.record.handMouthEye}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">今日暂未发现异常晨检儿童。</p>
                )}
              </div>
            </SectionCard>

            <div className="grid gap-6 xl:grid-cols-2">
              <SectionCard title="未完成晨检" description="先补基础记录，后续 AI 建议才可靠。">
                <div className="space-y-3">
                  {viewModel.uncheckedMorningChecks.length > 0 ? (
                    viewModel.uncheckedMorningChecks.map((child) => (
                      <div key={child.id} className="rounded-3xl border border-slate-100 bg-white p-4">
                        <p className="text-sm font-semibold text-slate-900">{child.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{child.className} · 今日待晨检</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">今日出勤儿童都已完成晨检。</p>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="待复查名单" description="把需要继续观察的儿童压缩到一个列表。">
                <div className="space-y-3">
                  {viewModel.pendingReviews.length > 0 ? (
                    viewModel.pendingReviews.map((item) => (
                      <div key={item.record.id} className="rounded-3xl border border-slate-100 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">{item.child.name}</p>
                          <Badge variant="secondary">{item.record.category}</Badge>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.record.followUpAction ?? item.record.description}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">当前没有待复查名单。</p>
                  )}
                </div>
              </SectionCard>
            </div>

            <SectionCard title="今日待沟通家长" description="把真正需要今天同步的家长挑出来。">
              <div className="space-y-3">
                {viewModel.parentsToCommunicate.length > 0 ? (
                  viewModel.parentsToCommunicate.map((item) => (
                    <div key={item.child.id} className="rounded-3xl border border-slate-100 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{item.child.name}</p>
                        <Badge variant="info">建议沟通</Badge>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.reason}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">当前没有必须立即沟通的家长对象。</p>
                )}
              </div>
            </SectionCard>

            <SectionCard title="快捷录入入口" description="保持业务主路径直达，不让老师来回找页面。">
              <div className="grid gap-3 sm:grid-cols-3">
                <Link href="/health" className="rounded-3xl border border-slate-100 bg-white p-4 text-sm font-semibold text-slate-900 shadow-sm">
                  <ShieldCheck className="mb-3 h-5 w-5 text-sky-500" />
                  去晨检录入
                </Link>
                <Link href="/growth" className="rounded-3xl border border-slate-100 bg-white p-4 text-sm font-semibold text-slate-900 shadow-sm">
                  <BookOpenCheck className="mb-3 h-5 w-5 text-indigo-500" />
                  去成长观察
                </Link>
                <Link href="/diet" className="rounded-3xl border border-slate-100 bg-white p-4 text-sm font-semibold text-slate-900 shadow-sm">
                  <PencilLine className="mb-3 h-5 w-5 text-emerald-500" />
                  去饮食录入
                </Link>
              </div>
            </SectionCard>
          </div>
        }
        aside={
          <div className="space-y-6">
            <AssistantEntryCard
              title="进入教师 AI 助手"
              description="老师进入后直接看到班级上下文、异常摘要和可一键生成的沟通建议。"
              href="/teacher/agent"
              buttonLabel="进入教师 AI 助手"
            >
              <ul className="space-y-3 text-sm leading-6 text-slate-600">
                <li>当前班级：{currentUser.className ?? "当前班级"}</li>
                <li>当前任务：异常处理、复查、家长沟通</li>
                <li>推荐入口：家长沟通建议 / 今日跟进行动</li>
              </ul>
            </AssistantEntryCard>

            <SectionCard title="沟通建议预览" description="首页直接露出一条可演示的沟通方向。">
              <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-5">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4 text-indigo-600" />
                  <p className="text-sm font-semibold text-slate-900">家长沟通建议</p>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{viewModel.communicationPreview}</p>
              </div>
            </SectionCard>

            <SectionCard title="老师今日顺序" description="移动端一进来先处理这三件事。">
              <ol className="space-y-3 text-sm text-slate-600">
                <li className="flex items-center gap-3"><AlertTriangle className="h-4 w-4 text-amber-500" />先看异常儿童</li>
                <li className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-sky-500" />补齐未完成晨检</li>
                <li className="flex items-center gap-3"><BrainCircuit className="h-4 w-4 text-indigo-500" />再生成家长沟通建议</li>
              </ol>
            </SectionCard>
          </div>
        }
      />
    </RolePageShell>
  );
}
