"use client";

import { buildFallbackWeeklyReport } from "@/lib/ai/fallback";
import { getWeeklyTaskForChild } from "@/lib/mock/coparenting";
import type {
  AdminBoardData,
  AttendanceRecord,
  Child,
  GrowthRecord,
  GuardianFeedback,
  HealthCheckRecord,
  ParentFeed,
  SmartInsight,
  User,
  WeeklyDietTrend,
} from "@/lib/store";
import { getAgeBandFromBirthDate } from "@/lib/store";
import { getLocalToday, isDateWithinLastDays } from "@/lib/date";

export type ParentHomeViewModel = {
  child: Child;
  todaySummary: Array<{ label: string; value: string; tone: "info" | "success" | "warning" }>;
  aiReminder: SmartInsight;
  tonightTask: {
    title: string;
    description: string;
    durationText: string;
    tag: string;
  };
  pendingFeedback: {
    title: string;
    description: string;
    status: "pending" | "submitted";
  };
  weeklyTrend: Array<{ label: string; value: string }>;
  interventionPreview: {
    title: string;
    description: string;
  };
};

export type TeacherHomeViewModel = {
  todayAbnormalChildren: Array<{ child: Child; record: HealthCheckRecord }>;
  uncheckedMorningChecks: Child[];
  pendingReviews: Array<{ child: Child; record: GrowthRecord }>;
  parentsToCommunicate: Array<{ child: Child; reason: string }>;
  heroStats: Array<{ label: string; value: string }>;
  communicationPreview: string;
};

export type AdminHomeViewModel = {
  riskChildrenCount: number;
  weeklySummary: string;
  feedbackCompletionRate: number;
  pendingItems: string[];
  weeklyHighlights: string[];
  heroStats: Array<{ label: string; value: string }>;
};

export type TeacherAgentContext = {
  className: string;
  childCount: number;
  abnormalSummary: string[];
  pendingReviewSummary: string[];
  parentCommunicationSummary: string[];
};

export type AdminAgentContext = {
  institutionName: string;
  riskSummary: string[];
  feedbackCompletionRate: number;
  pendingItems: string[];
  weeklyHighlights: string[];
};

export type AgentReply = {
  answer: string;
  keyPoints: string[];
  nextSteps: string[];
};

export function buildParentHomeViewModel(feed?: ParentFeed | null): ParentHomeViewModel | null {
  if (!feed) return null;

  const ageBand = getAgeBandFromBirthDate(feed.child.birthDate);
  const task = getWeeklyTaskForChild(feed.child.id, ageBand);
  const aiReminder =
    feed.suggestions.find((item) => item.level === "warning") ??
    feed.suggestions[0] ?? {
      id: "parent-fallback-insight",
      title: "今日状态整体稳定",
      description: "继续保持规律饮水、睡前安抚和今晚反馈即可。",
      level: "info",
      tags: ["日常提醒"],
    };

  const pendingFeedback =
    feed.feedbacks.length === 0
      ? {
          title: "今晚反馈待提交",
          description: "离园后补充今晚在家状态，帮助老师判断建议是否有效。",
          status: "pending" as const,
        }
      : {
          title: "今日反馈已同步",
          description: `最近一次状态：${feed.feedbacks[0]?.status ?? "已提交"}，仍可继续补充细节。`,
          status: "submitted" as const,
        };

  const attentionCount = feed.suggestions.filter((item) => item.level === "warning").length;
  const interventionPreview =
    feed.suggestions[1] ??
    aiReminder;

  return {
    child: feed.child,
    todaySummary: [
      { label: "今日饮食记录", value: `${feed.todayMeals.length} 条`, tone: "info" },
      { label: "今日成长观察", value: `${feed.todayGrowth.length} 条`, tone: "success" },
      { label: "近 7 天饮水均值", value: `${feed.weeklyTrend.hydrationAvg} ml`, tone: "info" },
      { label: "当前关注项", value: `${attentionCount} 项`, tone: attentionCount > 0 ? "warning" : "success" },
    ],
    aiReminder,
    tonightTask: {
      title: task.title,
      description: task.description,
      durationText: task.durationText,
      tag: task.tag,
    },
    pendingFeedback,
    weeklyTrend: [
      { label: "膳食均衡率", value: `${feed.weeklyTrend.balancedRate}%` },
      { label: "蔬菜摄入天数", value: `${feed.weeklyTrend.vegetableDays} 天` },
      { label: "蛋白摄入天数", value: `${feed.weeklyTrend.proteinDays} 天` },
    ],
    interventionPreview: {
      title: interventionPreview.title,
      description: interventionPreview.description,
    },
  };
}

export function buildTeacherHomeViewModel(params: {
  visibleChildren: Child[];
  presentChildren: Child[];
  healthCheckRecords: HealthCheckRecord[];
  growthRecords: GrowthRecord[];
  guardianFeedbacks: GuardianFeedback[];
}): TeacherHomeViewModel {
  const today = getLocalToday();
  const childMap = new Map(params.visibleChildren.map((child) => [child.id, child] as const));

  const todayHealthChecks = params.healthCheckRecords.filter(
    (record) => record.date === today && childMap.has(record.childId)
  );

  const todayAbnormalChildren = todayHealthChecks
    .filter((record) => record.isAbnormal)
    .map((record) => ({
      child: childMap.get(record.childId)!,
      record,
    }))
    .slice(0, 5);

  const uncheckedMorningChecks = params.presentChildren.filter(
    (child) => !todayHealthChecks.some((record) => record.childId === child.id)
  );

  const pendingReviews = params.growthRecords
    .filter(
      (record) =>
        childMap.has(record.childId) &&
        record.reviewStatus === "待复查"
    )
    .sort((left, right) => (left.reviewDate ?? "9999-12-31").localeCompare(right.reviewDate ?? "9999-12-31"))
    .slice(0, 5)
    .map((record) => ({
      child: childMap.get(record.childId)!,
      record,
    }));

  const parentsToCommunicate = params.visibleChildren
    .map((child) => {
      const abnormalRecord = todayAbnormalChildren.find((item) => item.child.id === child.id);
      const pendingReview = pendingReviews.find((item) => item.child.id === child.id);
      const hasFeedbackToday = params.guardianFeedbacks.some(
        (item) => item.childId === child.id && item.date === today
      );

      if (abnormalRecord) {
        return { child, reason: `晨检异常：${abnormalRecord.record.mood} / ${abnormalRecord.record.handMouthEye}` };
      }
      if (pendingReview) {
        return { child, reason: "有待复查观察项，建议同步家长后续配合方式" };
      }
      if (!hasFeedbackToday) {
        return { child, reason: "今日尚未收到家长反馈，可提醒晚间补充情况" };
      }
      return null;
    })
    .filter((item): item is { child: Child; reason: string } => Boolean(item))
    .slice(0, 5);

  return {
    todayAbnormalChildren,
    uncheckedMorningChecks,
    pendingReviews,
    parentsToCommunicate,
    heroStats: [
      { label: "今日异常儿童", value: `${todayAbnormalChildren.length}` },
      { label: "未完成晨检", value: `${uncheckedMorningChecks.length}` },
      { label: "待复查名单", value: `${pendingReviews.length}` },
      { label: "待沟通家长", value: `${parentsToCommunicate.length}` },
    ],
    communicationPreview:
      todayAbnormalChildren.length > 0
        ? `优先沟通 ${todayAbnormalChildren[0].child.name} 的晨检情况，并同步园内观察与今晚家庭观察重点。`
        : "优先提醒待复查儿童家长补充今晚反馈，确保明日跟进建议更具体。",
  };
}

export function buildAdminHomeViewModel(params: {
  institutionName: string;
  visibleChildren: Child[];
  attendanceRecords: AttendanceRecord[];
  healthCheckRecords: HealthCheckRecord[];
  growthRecords: GrowthRecord[];
  guardianFeedbacks: GuardianFeedback[];
  adminBoardData: AdminBoardData;
  weeklyTrend: WeeklyDietTrend;
  smartInsights: SmartInsight[];
}): AdminHomeViewModel {
  const today = getLocalToday();
  const childMap = new Map(params.visibleChildren.map((child) => [child.id, child] as const));

  const parentLinkedChildren = params.visibleChildren.filter((child) => Boolean(child.parentUserId));
  const feedbackChildren = new Set(
    params.guardianFeedbacks
      .filter((record) => record.date === today && childMap.has(record.childId))
      .map((record) => record.childId)
  );

  const feedbackCompletionRate =
    parentLinkedChildren.length > 0
      ? Math.round((feedbackChildren.size / parentLinkedChildren.length) * 100)
      : 0;

  const riskChildIds = new Set<string>();
  params.adminBoardData.highAttentionChildren.forEach((item) => riskChildIds.add(item.childId));
  params.adminBoardData.lowHydrationChildren
    .filter((item) => item.hydrationAvg < 140)
    .forEach((item) => riskChildIds.add(item.childId));
  params.adminBoardData.lowVegTrendChildren
    .filter((item) => item.vegetableDays < 3)
    .forEach((item) => riskChildIds.add(item.childId));

  const weekAttendance = params.attendanceRecords.filter(
    (record) => childMap.has(record.childId) && isDateWithinLastDays(record.date, 7, today)
  );
  const weekPresent = weekAttendance.filter((record) => record.isPresent).length;
  const weekHealth = params.healthCheckRecords.filter(
    (record) => childMap.has(record.childId) && isDateWithinLastDays(record.date, 7, today)
  );
  const weekGrowth = params.growthRecords.filter(
    (record) =>
      childMap.has(record.childId) &&
      isDateWithinLastDays(record.createdAt.split(" ")[0], 7, today)
  );
  const weekFeedback = params.guardianFeedbacks.filter(
    (record) => childMap.has(record.childId) && isDateWithinLastDays(record.date, 7, today)
  );

  const weeklyReport = buildFallbackWeeklyReport({
    institutionName: params.institutionName,
    periodLabel: "最近 7 天",
    role: "机构管理员",
    overview: {
      visibleChildren: params.visibleChildren.length,
      attendanceRate: weekAttendance.length > 0 ? Math.round((weekPresent / weekAttendance.length) * 100) : 0,
      mealRecordCount: 0,
      healthAbnormalCount: weekHealth.filter((item) => item.isAbnormal).length,
      growthAttentionCount: weekGrowth.filter((item) => item.needsAttention).length,
      pendingReviewCount: weekGrowth.filter((item) => item.reviewStatus === "待复查").length,
      feedbackCount: weekFeedback.length,
    },
    diet: {
      balancedRate: params.weeklyTrend.balancedRate,
      hydrationAvg: params.weeklyTrend.hydrationAvg,
      monotonyDays: params.weeklyTrend.monotonyDays,
      vegetableDays: params.weeklyTrend.vegetableDays,
      proteinDays: params.weeklyTrend.proteinDays,
    },
    topAttentionChildren: params.adminBoardData.highAttentionChildren.map((item) => ({
      childName: item.childName,
      attentionCount: item.count,
      hydrationAvg:
        params.adminBoardData.lowHydrationChildren.find((entry) => entry.childId === item.childId)?.hydrationAvg ?? 0,
      vegetableDays:
        params.adminBoardData.lowVegTrendChildren.find((entry) => entry.childId === item.childId)?.vegetableDays ?? 0,
    })),
    highlights: params.smartInsights.filter((item) => item.level !== "warning").map((item) => item.title).slice(0, 4),
    risks: params.smartInsights.filter((item) => item.level === "warning").map((item) => item.title).slice(0, 4),
  });

  const pendingItems = [
    weekHealth.filter((item) => item.isAbnormal).length > 0
      ? `今日及近 7 天共有 ${weekHealth.filter((item) => item.isAbnormal).length} 条健康异常记录待追踪`
      : null,
    weekGrowth.filter((item) => item.reviewStatus === "待复查").length > 0
      ? `${weekGrowth.filter((item) => item.reviewStatus === "待复查").length} 条成长观察仍待复查`
      : null,
    feedbackCompletionRate < 80 ? `家长反馈完成率仅 ${feedbackCompletionRate}%，建议重点催办` : null,
  ].filter((item): item is string => Boolean(item));

  return {
    riskChildrenCount: riskChildIds.size,
    weeklySummary: weeklyReport.summary,
    feedbackCompletionRate,
    pendingItems,
    weeklyHighlights: weeklyReport.highlights,
    heroStats: [
      { label: "重点风险儿童", value: `${riskChildIds.size}` },
      { label: "家长反馈完成率", value: `${feedbackCompletionRate}%` },
      { label: "待处理事项", value: `${pendingItems.length}` },
      { label: "周重点亮点", value: `${weeklyReport.highlights.length}` },
    ],
  };
}

export function buildTeacherAgentContext(params: {
  currentUser: User;
  home: TeacherHomeViewModel;
}): TeacherAgentContext {
  return {
    className: params.currentUser.className ?? "当前班级",
    childCount:
      params.home.todayAbnormalChildren.length +
      params.home.uncheckedMorningChecks.length,
    abnormalSummary: params.home.todayAbnormalChildren.map(
      (item) => `${item.child.name}：${item.record.mood} / ${item.record.handMouthEye}`
    ),
    pendingReviewSummary: params.home.pendingReviews.map(
      (item) => `${item.child.name}：${item.record.followUpAction ?? item.record.description}`
    ),
    parentCommunicationSummary: params.home.parentsToCommunicate.map(
      (item) => `${item.child.name}：${item.reason}`
    ),
  };
}

export function buildAdminAgentContext(params: {
  institutionName: string;
  home: AdminHomeViewModel;
}): AdminAgentContext {
  return {
    institutionName: params.institutionName,
    riskSummary: [
      `当前重点风险儿童 ${params.home.riskChildrenCount} 人`,
      ...params.home.weeklyHighlights.slice(0, 2),
    ],
    feedbackCompletionRate: params.home.feedbackCompletionRate,
    pendingItems: params.home.pendingItems,
    weeklyHighlights: params.home.weeklyHighlights,
  };
}

export function buildTeacherAgentReply(
  context: TeacherAgentContext,
  action: "communication" | "follow-up" | "weekly-summary"
): AgentReply {
  if (action === "communication") {
    return {
      answer: `建议优先联系 ${context.parentCommunicationSummary[0]?.split("：")[0] ?? "重点儿童家长"}，先同步园内观察，再明确今晚需要家长配合观察的 1 到 2 个点，避免信息过多。`,
      keyPoints: [
        "先说客观观察，再给家庭配合建议",
        "把风险描述压缩到当日最关键的一个场景",
        "沟通结束前明确明早回传什么信息",
      ],
      nextSteps: [
        "按异常儿童优先级逐一沟通",
        "把沟通结果记录到成长观察或反馈链路",
        "明早根据家长反馈调整跟进动作",
      ],
    };
  }

  if (action === "follow-up") {
    return {
      answer: `今天班级里最需要推进的是未晨检和待复查两类事项。建议先补齐晨检，再对 ${context.pendingReviewSummary[0]?.split("：")[0] ?? "重点儿童"} 做一次复查记录，保证明日的 AI 建议有连续数据。`,
      keyPoints: [
        "先补齐基础记录，再做干预判断",
        "复查动作要和上一次观察点对应",
        "异常儿童和待沟通家长名单保持同步",
      ],
      nextSteps: [
        "30 分钟内补齐未晨检名单",
        "午睡前后完成重点儿童复查",
        "离园前同步家长今日跟进行动",
      ],
    };
  }

  return {
    answer: `本周班级观察重点集中在异常晨检、待复查和家长沟通闭环。整体建议是减少信息分散，把每个重点儿童都压缩成“今天发生了什么、今晚家长做什么、明天老师看什么”的三句结构。`,
    keyPoints: [
      "异常和复查儿童构成了本周主要工作量",
      "家长沟通越结构化，明日跟进越高效",
      "优先保留连续 7 天可复盘的数据链路",
    ],
    nextSteps: [
      "整理本周重点儿童清单",
      "统一一版家长沟通话术",
      "下周沿用同一记录节奏继续追踪",
    ],
  };
}

export function buildAdminAgentReply(
  context: AdminAgentContext,
  action: "weekly-report" | "risk-list" | "rectification"
): AgentReply {
  if (action === "weekly-report") {
    return {
      answer: `本周园所运营风险主要集中在重点儿童持续跟踪和家长反馈完成率两处。建议周报先讲风险数量与趋势，再讲闭环率和下周整改动作，保持展示逻辑简洁。`,
      keyPoints: [
        `当前家长反馈完成率 ${context.feedbackCompletionRate}%`,
        ...context.weeklyHighlights.slice(0, 2),
      ],
      nextSteps: [
        "把周报拆成风险、协同、整改三部分",
        "点名重点儿童名单但不展开过多细节",
        "列出下周一到两个最关键整改动作",
      ],
    };
  }

  if (action === "risk-list") {
    return {
      answer: `建议优先汇总“高关注频次、低饮水、低蔬菜摄入”三类儿童，形成园长每日过目名单。当前可先从 ${context.riskSummary[0]} 开始。`,
      keyPoints: [
        "名单按风险来源归类，方便后续派单",
        "同一儿童命中多项风险时优先级最高",
        "名单只保留需要今日处理的对象",
      ],
      nextSteps: [
        "生成今日重点儿童名单",
        "交由班级老师补充跟进状态",
        "晚间汇总反馈结果形成闭环",
      ],
    };
  }

  return {
    answer: `待整改事项建议围绕“反馈完成率偏低、复查项未闭环、健康异常追踪不足”三条展开。当前先把这些事项变成明确责任和时间节点，比继续堆砌指标更适合演示。`,
    keyPoints: [
      ...context.pendingItems.slice(0, 3),
    ],
    nextSteps: [
      "逐项指定负责人",
      "把整改时限压到下一个工作日",
      "下一轮 Agent 工作流直接挂在这些整改项上",
    ],
  };
}
