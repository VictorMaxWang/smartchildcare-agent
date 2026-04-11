import type { ParentAgentChildContext } from "@/lib/agent/parent-agent";
import type { WeeklyReportSnapshot } from "@/lib/ai/types";

function uniqueTexts(items: Array<string | undefined>, limit = 4) {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const normalized = item?.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }

  return result;
}

function getTopGrowthCategory(context: ParentAgentChildContext) {
  const categoryCounts = context.weeklyGrowthRecords.reduce<Map<string, number>>((acc, item) => {
    acc.set(item.category, (acc.get(item.category) ?? 0) + 1);
    return acc;
  }, new Map<string, number>());

  return Array.from(categoryCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0];
}

function buildSchoolActivityRate(context: ParentAgentChildContext) {
  const activeDates = new Set<string>();

  context.weeklyHealthChecks.forEach((item) => activeDates.add(item.date));
  context.weeklyMeals.forEach((item) => activeDates.add(item.date));
  context.weeklyGrowthRecords.forEach((item) => activeDates.add(item.createdAt.slice(0, 10)));

  if (activeDates.size === 0) return 0;
  return Math.min(100, Math.round((activeDates.size / 5) * 100));
}

export function buildParentWeeklyReportSnapshot(context: ParentAgentChildContext): WeeklyReportSnapshot {
  const weeklyHealthAbnormalCount = context.weeklyHealthChecks.filter((item) => item.isAbnormal).length;
  const topGrowthCategory = getTopGrowthCategory(context);
  const attentionCount = context.attentionGrowthRecords.length + weeklyHealthAbnormalCount;

  const highlights = uniqueTexts(
    [
      context.latestFeedback?.improved === true ? "最近一次家庭反馈显示孩子已有稳定改善" : undefined,
      context.weeklyFeedbacks.length > 0 ? `本周已形成 ${context.weeklyFeedbacks.length} 次家园反馈` : undefined,
      topGrowthCategory ? `本周变化主要集中在${topGrowthCategory}` : undefined,
      context.weeklyMeals.length > 0 ? `本周已记录 ${context.weeklyMeals.length} 条饮食与补水线索` : undefined,
      context.teacherSuggestionSummary,
      ...context.smartInsights.filter((item) => item.level !== "warning").map((item) => item.title),
    ],
    4
  );

  const risks = uniqueTexts(
    [
      ...context.smartInsights.filter((item) => item.level === "warning").map((item) => item.title),
      ...context.focusReasons,
      context.pendingReviews.length > 0 ? `仍有 ${context.pendingReviews.length} 项观察待继续跟进` : undefined,
      context.latestFeedback?.improved === false ? "上一次家庭行动后改善仍不稳定" : undefined,
    ],
    4
  );

  return {
    institutionName: context.child.className || "家园协同",
    periodLabel: "近7天",
    role: "parent",
    overview: {
      visibleChildren: 1,
      attendanceRate: buildSchoolActivityRate(context),
      mealRecordCount: context.weeklyMeals.length,
      healthAbnormalCount: weeklyHealthAbnormalCount,
      growthAttentionCount: context.attentionGrowthRecords.length,
      pendingReviewCount: context.pendingReviews.length,
      feedbackCount: context.weeklyFeedbacks.length,
    },
    diet: {
      balancedRate: context.weeklyTrend.balancedRate,
      hydrationAvg: context.weeklyTrend.hydrationAvg,
      monotonyDays: context.weeklyTrend.monotonyDays,
      vegetableDays: context.weeklyTrend.vegetableDays,
      proteinDays: context.weeklyTrend.proteinDays,
    },
    topAttentionChildren:
      attentionCount > 0
        ? [
            {
              childName: context.child.name,
              attentionCount,
              hydrationAvg: context.weeklyTrend.hydrationAvg,
              vegetableDays: context.weeklyTrend.vegetableDays,
            },
          ]
        : [],
    highlights:
      highlights.length > 0
        ? highlights
        : ["本周已汇总园内观察与家庭反馈，适合继续做家园共育复盘"],
    risks,
  };
}
