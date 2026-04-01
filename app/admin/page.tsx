"use client";

import { ClipboardCheck, ShieldAlert, TrendingUp, Workflow } from "lucide-react";
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
import { buildAdminHomeViewModel } from "@/lib/view-models/role-home";
import { INSTITUTION_NAME, useApp } from "@/lib/store";

const TODAY_TEXT = new Date().toLocaleDateString("zh-CN", {
  month: "long",
  day: "numeric",
  weekday: "long",
});

export default function AdminHomePage() {
  const {
    visibleChildren,
    attendanceRecords,
    healthCheckRecords,
    growthRecords,
    guardianFeedbacks,
    getAdminBoardData,
    getWeeklyDietTrend,
    getSmartInsights,
  } = useApp();

  if (visibleChildren.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <EmptyState
          icon={<ShieldAlert className="h-6 w-6" />}
          title="当前园长账号还没有可展示的机构数据"
          description="请先使用示例园长账号，或为普通管理员账号初始化机构数据。"
        />
      </div>
    );
  }

  const home = buildAdminHomeViewModel({
    institutionName: INSTITUTION_NAME,
    visibleChildren,
    attendanceRecords,
    healthCheckRecords,
    growthRecords,
    guardianFeedbacks,
    adminBoardData: getAdminBoardData(),
    weeklyTrend: getWeeklyDietTrend(),
    smartInsights: getSmartInsights(),
  });

  return (
    <RolePageShell
      badge={`园长首页 · ${INSTITUTION_NAME} · ${TODAY_TEXT}`}
      title="先看机构级风险，再决定今天要推动哪几件整改事项"
      description="园长首页不做重后台大屏，而是聚焦风险儿童数、周趋势、反馈完成率、待处理事项和 AI 周报入口，适合双端演示。"
      actions={
        <>
          <InlineLinkButton href="/admin/agent" label="进入园所运营 AI 助手" variant="premium" />
          <InlineLinkButton href="/admin/agent?action=weekly-report" label="打开 AI 周报入口" />
        </>
      }
    >
      <RoleSplitLayout
        main={
          <div className="space-y-6">
            <MetricGrid
              items={home.heroStats.map((item, index) => ({
                ...item,
                tone: index === 0 ? "amber" : index === 1 ? "emerald" : index === 2 ? "sky" : "indigo",
              }))}
            />

            <SectionCard
              title="今日重点风险儿童数"
              description="把园长最需要先过目的机构问题放在最前面。"
              actions={<Badge variant="warning">重点关注</Badge>}
            >
              <div className="rounded-3xl bg-amber-50 p-5">
                <p className="text-sm text-amber-700">当前命中机构级重点风险的儿童数量</p>
                <p className="mt-3 text-4xl font-bold text-slate-900">{home.riskChildrenCount}</p>
              </div>
            </SectionCard>

            <div className="grid gap-6 xl:grid-cols-2">
              <SectionCard title="本周趋势摘要" description="保留 AI 周报式摘要，但不做复杂报表。">
                <div className="rounded-3xl border border-slate-100 bg-white p-5">
                  <p className="text-sm leading-7 text-slate-600">{home.weeklySummary}</p>
                </div>
              </SectionCard>

              <SectionCard title="家长反馈完成率" description="让园长快速判断协同链路是否畅通。">
                <div className="rounded-3xl bg-emerald-50 p-5">
                  <p className="text-sm text-emerald-700">今日反馈完成率</p>
                  <p className="mt-3 text-4xl font-bold text-slate-900">{home.feedbackCompletionRate}%</p>
                </div>
              </SectionCard>
            </div>

            <SectionCard title="待处理事项" description="保留最关键的整改事项，不展开过多表格。">
              <div className="space-y-3">
                {home.pendingItems.length > 0 ? (
                  home.pendingItems.map((item) => (
                    <div key={item} className="rounded-3xl border border-slate-100 bg-white p-4">
                      <p className="text-sm leading-6 text-slate-700">{item}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">当前没有新增待处理事项，机构状态相对稳定。</p>
                )}
              </div>
            </SectionCard>
          </div>
        }
        aside={
          <div className="space-y-6">
            <AssistantEntryCard
              title="进入园所运营 AI 助手"
              description="把 AI 周报、重点儿童汇总和待整改提取统一到一个入口。"
              href="/admin/agent"
              buttonLabel="进入园所运营 AI 助手"
            >
              <ul className="space-y-3 text-sm leading-6 text-slate-600">
                <li>当前服务对象：{INSTITUTION_NAME}</li>
                <li>当前任务：看风险、推整改、做周报</li>
                <li>推荐操作：先生成周报，再提取待整改事项</li>
              </ul>
            </AssistantEntryCard>

            <SectionCard title="AI 周报入口" description="适合作为 PC 演示时的辅助摘要区。">
              <div className="space-y-3">
                {home.weeklyHighlights.map((item) => (
                  <div key={item} className="rounded-3xl border border-slate-100 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <TrendingUp className="mt-0.5 h-4 w-4 text-indigo-500" />
                      <p className="text-sm leading-6 text-slate-700">{item}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="园长今日顺序" description="入口页强调机构级处理顺序。">
              <ol className="space-y-3 text-sm text-slate-600">
                <li className="flex items-center gap-3"><ShieldAlert className="h-4 w-4 text-amber-500" />先看重点风险儿童</li>
                <li className="flex items-center gap-3"><ClipboardCheck className="h-4 w-4 text-emerald-500" />再看反馈完成率和待处理事项</li>
                <li className="flex items-center gap-3"><Workflow className="h-4 w-4 text-indigo-500" />最后进入 AI 助手生成周报与整改清单</li>
              </ol>
            </SectionCard>
          </div>
        }
      />
    </RolePageShell>
  );
}
