"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart,
  ClipboardCheck,
  HeartPulse,
  MessageSquare,
  Monitor,
  Thermometer,
  Users,
  Wifi,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AnimatedNumber from "@/components/AnimatedNumber";
import EmptyState from "@/components/EmptyState";
import ScrollReveal from "@/components/ScrollReveal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildRecentLocalDateRange, getLocalToday } from "@/lib/date";
import { useApp } from "@/lib/store";

export default function InstitutionMonitorPage() {
  const { visibleChildren, getTodayAttendance, healthCheckRecords, guardianFeedbacks, growthRecords } = useApp();

  const todayStr = getLocalToday();
  const totalChildren = visibleChildren.length;
  const attendanceToday = getTodayAttendance();
  const presentCount = attendanceToday.filter((record) => record.isPresent).length;
  const presentRate = totalChildren > 0 ? Math.round((presentCount / totalChildren) * 100) : 0;
  const todayHealthChecks = healthCheckRecords.filter((record) => record.date === todayStr);
  const abnormalCount = todayHealthChecks.filter((record) => record.isAbnormal).length;
  const todayFeedbacks = guardianFeedbacks.filter((record) => record.date === todayStr);

  const [envTemp, setEnvTemp] = useState(24.5);

  useEffect(() => {
    const timer = setInterval(() => {
      setEnvTemp((prev) => Number((prev + (Math.random() - 0.5) * 0.2).toFixed(1)));
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const growthAlerts = useMemo(
    () =>
      growthRecords
        .filter((record) => record.needsAttention)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 5),
    [growthRecords]
  );

  const healthTrendData = useMemo(() => {
    return buildRecentLocalDateRange(7).map((date) => {
      const records = healthCheckRecords.filter((record) => record.date === date);
      const avgTemp =
        records.length > 0
          ? records.reduce((sum, record) => sum + record.temperature, 0) / records.length
          : 36.5;

      return {
        date: date.slice(5),
        AvgTemp: Number(avgTemp.toFixed(1)),
      };
    });
  }, [healthCheckRecords]);

  const interventionData = [
    { category: "午睡入睡", before: 45, after: 20, unit: "分钟" },
    { category: "偏食拒食", before: 8, after: 2, unit: "次/周" },
    { category: "大动作达标", before: 60, after: 85, unit: "%" },
    { category: "情绪崩溃", before: 5, after: 1, unit: "次/周" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-8 page-enter">
      <div className="flex w-full flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-indigo-100 p-3">
            <Monitor className="h-8 w-8 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">机构端监控大屏</h1>
            <p className="mt-1 text-sm text-slate-500">全局掌控在园幼儿健康、成长情况及家园共育干预成果</p>
            <div className="section-divider mt-5" />
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-slate-600">IoT网关在线</span>
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Wifi className="h-3.5 w-3.5 text-indigo-400" />
            智能手环活跃: {totalChildren}/{totalChildren}
          </div>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Thermometer className="h-3.5 w-3.5 text-orange-400" />
            实时室温: {envTemp}°C
          </div>
        </div>
      </div>

      <ScrollReveal>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="kpi-accent card-hover relative overflow-hidden border border-indigo-100 border-l-4 border-l-indigo-300 bg-linear-to-br from-indigo-50 to-white shadow-sm">
            <div className="absolute right-0 top-0 p-4 opacity-[0.07]">
              <Users className="h-20 w-20" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">在园总人数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-indigo-900">
                <AnimatedNumber value={totalChildren} />
              </div>
              <p className="mt-1 text-xs font-medium text-indigo-600/80">全机构注册幼儿</p>
            </CardContent>
          </Card>

          <Card className="kpi-accent card-hover relative overflow-hidden border border-emerald-100 border-l-4 border-l-emerald-300 bg-linear-to-br from-emerald-50 to-white shadow-sm">
            <div className="absolute right-0 top-0 p-4 opacity-[0.07]">
              <ClipboardCheck className="h-20 w-20" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">今日出勤率</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-emerald-700">
                <AnimatedNumber value={presentRate} suffix="%" />
              </div>
              <p className="mt-1 text-xs font-medium text-emerald-600/80">实到 {presentCount} 人</p>
            </CardContent>
          </Card>

          <Card className="kpi-accent card-hover relative overflow-hidden border border-rose-100 border-l-4 border-l-rose-300 bg-linear-to-br from-rose-50 to-white shadow-sm">
            <div className="absolute right-0 top-0 p-4 opacity-[0.07]">
              <AlertTriangle className="h-20 w-20" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">晨检异常预警</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-rose-600">
                <AnimatedNumber value={abnormalCount} />
              </div>
              <p className="mt-1 text-xs font-medium text-rose-500/80">今日健康预警人数</p>
            </CardContent>
          </Card>

          <Card className="kpi-accent card-hover relative overflow-hidden border border-amber-100 border-l-4 border-l-amber-300 bg-linear-to-br from-amber-50 to-white shadow-sm">
            <div className="absolute right-0 top-0 p-4 opacity-[0.07]">
              <MessageSquare className="h-20 w-20" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">今日家园反馈</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-amber-600">
                <AnimatedNumber value={todayFeedbacks.length} />
              </div>
              <p className="mt-1 text-xs font-medium text-amber-600/80">家长通过在线端提交</p>
            </CardContent>
          </Card>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-slate-200 shadow-none">
            <CardHeader className="pb-4">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="h-5 w-5 text-indigo-500" />
                    AI 智慧干预效果对比分析
                  </CardTitle>
                  <CardDescription className="mt-1">上周报告生成个性化干预建议执行后的机构幼儿整体指标变化</CardDescription>
                </div>
                <Badge className="w-fit shrink-0 border-none bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                  干预效果显著
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={interventionData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="category" axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} tickLine={false} dy={10} />
                    <YAxis axisLine={false} tick={{ fill: "#64748B", fontSize: 12 }} tickLine={false} dx={-10} />
                    <Tooltip
                      cursor={{ fill: "#F8FAFC" }}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #E2E8F0",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px", fontSize: "12px" }} />
                    <Bar dataKey="before" name="干预前 (上周)" fill="#94A3B8" radius={[6, 6, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="after" name="干预后 (本周)" fill="#6366F1" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-none">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg text-slate-800">机构近七日健康均温监测</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={healthTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} dy={10} />
                    <YAxis
                      domain={["dataMin - 0.2", "dataMax + 0.2"]}
                      axisLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      tickLine={false}
                      dx={-10}
                    />
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #E2E8F0" }} />
                    <Area type="monotone" dataKey="AvgTemp" name="平均体温 (℃)" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorTemp)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="flex h-full flex-col border-rose-100 bg-white object-cover shadow-none">
            <CardHeader className="rounded-t-xl border-b border-rose-100/60 bg-rose-50/50 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base text-rose-800">
                  <AlertTriangle className="h-5 w-5" />
                  重点预警名单
                </CardTitle>
                <div className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {growthAlerts.length}
                </div>
              </div>
              <CardDescription className="mt-1 text-xs text-rose-700/70">需要教师二次复查干预的成长记录</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              <div className="divide-y divide-slate-100">
                {growthAlerts.map((alert) => {
                  const child = visibleChildren.find((item) => item.id === alert.childId);
                  return (
                    <div key={alert.id} className="p-5 transition-colors hover:bg-slate-50/80">
                      <div className="mb-2 flex items-start justify-between">
                        <div className="text-sm font-semibold text-slate-800">
                          {child?.name || "未知"}
                          <span className="ml-2 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-400">
                            {alert.category}
                          </span>
                        </div>
                        <Badge variant="outline" className="border-rose-200 bg-rose-50 text-[10px] text-rose-600">
                          待复查
                        </Badge>
                      </div>
                      <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">{alert.description}</p>

                      {alert.followUpAction ? (
                        <div className="relative mt-3 flex flex-col gap-1 rounded-lg border border-slate-100 bg-white p-2.5 text-xs text-slate-600 shadow-sm before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[3px] before:rounded-r-md before:bg-indigo-400 before:content-['']">
                          <span className="ml-2 font-semibold text-indigo-900">建议干预措施：</span>
                          <span className="ml-2 line-clamp-2 leading-relaxed">{alert.followUpAction}</span>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {growthAlerts.length === 0 ? (
                  <div className="p-5">
                    <EmptyState
                      icon={<HeartPulse className="h-6 w-6" />}
                      title="目前没有重点预警名单"
                      description="当前成长与健康数据整体平稳，暂时无需教师额外复查。"
                    />
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
