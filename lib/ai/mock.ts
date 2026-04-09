import type {
  AiFollowUpPayload,
  AiFollowUpResponse,
  AiSuggestionResponse,
  ChildSuggestionSnapshot,
  InstitutionSuggestionSnapshot,
  WeeklyReportRole,
  WeeklyReportResponse,
  WeeklyReportSnapshot,
} from "@/lib/ai/types";
import { buildActionizedWeeklyReportResponse, normalizeWeeklyReportRole } from "@/lib/ai/weekly-report";
import { getHydrationDisplayState } from "@/lib/hydration-display";

function riskFromSnapshot(snapshot: ChildSuggestionSnapshot): "low" | "medium" | "high" {
  const { health, meals, growth } = snapshot.summary;
  const score =
    health.abnormalCount * 2 +
    health.handMouthEyeAbnormalCount * 2 +
    growth.pendingReviewCount * 2 +
    growth.attentionCount +
    (meals.hydrationAvg < 120 ? 2 : 0) +
    (meals.balancedRate < 50 ? 2 : 0) +
    meals.allergyRiskCount;

  if (score >= 8) return "high";
  if (score >= 4) return "medium";
  return "low";
}

export function buildMockAiSuggestion(snapshot: ChildSuggestionSnapshot): AiSuggestionResponse {
  const riskLevel = riskFromSnapshot(snapshot);
  const { child, summary } = snapshot;
  const hydrationDisplay = getHydrationDisplayState(summary.meals.hydrationAvg);

  return {
    riskLevel,
    summary:
      `${child.name} 近 7 天在饮食、成长和家园反馈上已形成连续记录，` +
      `${hydrationDisplay.tone === "warning" ? "当前补水状态需要继续关注，" : "补水整体较稳定，"}` +
      `${summary.growth.attentionCount > 0 ? "且存在需要持续跟进的成长观察项，" : "成长记录整体平稳，"}` +
      "建议围绕作息、饮水和家园协同继续做更细化的个性化跟进。",
    highlights: [
      `${child.name} 近 7 天共完成 ${summary.meals.recordCount} 条膳食记录，数据连续性较好。`,
      `成长观察记录 ${summary.growth.recordCount} 条，重点关注项 ${summary.growth.attentionCount} 条。`,
      `家园反馈 ${summary.feedback.count} 条，沟通链路保持畅通。`,
    ].slice(0, 3),
    concerns: [
      summary.health.abnormalCount > 0
        ? `近 7 天发现 ${summary.health.abnormalCount} 次健康异常记录，建议加强晨检复盘。`
        : "近 7 天未见明显健康异常，可继续保持当前节奏。",
      hydrationDisplay.tone === "warning"
        ? `近 7 天补水状态为${hydrationDisplay.statusLabel}，建议提升日间补水提醒频次。`
        : `近 7 天补水状态为${hydrationDisplay.statusLabel}，可继续保持当前节奏。`,
      summary.growth.pendingReviewCount > 0
        ? `仍有 ${summary.growth.pendingReviewCount} 条成长记录待复查，建议本周完成闭环。`
        : "成长观察复查状态整体较好。",
    ].slice(0, 3),
    actions: [
      "继续按日记录晨检、饮食、成长观察，保证数据不断档。",
      "对需关注项在 48 小时内补充家园反馈，形成执行闭环。",
      "若连续出现发热或手口眼异常，请及时通知监护人并就医评估。",
    ],
    actionPlan: {
      schoolActions: [
        "今天园内在晨检和午睡前后继续记录情绪、饮水和进食情况，避免遗漏关键时段。",
        "今天离园前由老师补齐需关注记录，并标注是否已有改善。",
      ],
      familyActions: [
        "今晚家庭同步反馈入睡时间、饮水和情绪状态，帮助判断园内建议是否有效。",
        "今晚若孩子对某类食物明显抗拒，可记录替代食材接受情况后再反馈。",
      ],
      reviewActions: ["48 小时后结合新记录复盘一次，如关注项连续增加则升级为重点跟踪。"],
    },
    trendPrediction: riskLevel === "high" ? "up" : riskLevel === "medium" ? "stable" : "down",
    disclaimer: "本建议由本地规则生成，仅用于托育观察与家园沟通参考，不构成医疗诊断。",
    source: "mock",
  };
}

export function buildMockInstitutionSuggestion(snapshot: InstitutionSuggestionSnapshot): AiSuggestionResponse {
  const topItems = snapshot.priorityTopItems.slice(0, 3);
  const topRisk = topItems[0];

  return {
    riskLevel:
      topItems.some((item) => item.priorityLevel === "P1")
        ? "high"
        : topItems.some((item) => item.priorityLevel === "P2")
          ? "medium"
          : "low",
    summary:
      topRisk
        ? `${snapshot.institutionName} 近7天数据已经足以支撑机构级判断，当前最高优先级是${topRisk.targetName}。建议园长先推动${topRisk.recommendedAction}，再同步复盘高风险班级和家长协同薄弱点，避免只看指标不落动作。`
        : `${snapshot.institutionName} 当前整体趋势较稳，但仍建议园长每天先看机构优先级列表，再检查待派单事项和家长反馈缺口，保持机构级动作连续性。`,
    highlights: [
      `重点儿童 ${snapshot.riskChildren.length} 名`,
      `高风险班级 ${snapshot.riskClasses.length} 个`,
      `待处理通知事件 ${snapshot.pendingDispatches.length} 条`,
    ],
    concerns:
      topItems.length > 0
        ? topItems.map((item) => `${item.targetName}：${item.reason}`)
        : ["当前暂无进入机构优先级主列表的事项。"],
    actions:
      topItems.length > 0
        ? topItems.map((item) => `${item.recommendedAction}（${item.recommendedDeadline}前）`)
        : ["继续保持晨检、待复查和反馈闭环的每日巡检。"],
    actionPlan: {
      schoolActions: topItems.slice(0, 2).map((item) => item.recommendedAction),
      familyActions: snapshot.feedbackRiskItems.slice(0, 2).map((item) => `联系${item.childName}家长补充反馈并说明执行情况。`),
      reviewActions: ["今日放学前复盘TOP3优先事项执行状态。"],
    },
    trendPrediction: topItems.some((item) => item.priorityLevel === "P1") ? "up" : "stable",
    disclaimer: "本建议由本地 mock 结果生成，仅用于托育运营演示与机构决策辅助。",
    source: "mock",
  };
}

export function buildMockAiFollowUp(payload: AiFollowUpPayload): AiFollowUpResponse {
  if ("institutionName" in payload.snapshot) {
    return buildMockInstitutionFollowUp(payload, payload.snapshot);
  }

  const childName = payload.snapshot.child.name;

  return {
    answer:
      `针对“${payload.suggestionTitle}”，建议把关注点放到最具体的时段和动作上。` +
      `${childName} 当前已有近 7 天连续数据，适合先做小步调整，再比较执行前后的变化。` +
      `如果你这次追问的是“${payload.question}”，今晚最重要的是先做一件明确的家庭动作，并把结果反馈回来。`,
    keyPoints: [
      "优先看建议对应场景是否固定出现，而不是只看单次表现。",
      "如果涉及饮水、作息或情绪，尽量记录具体时间点和持续时长。",
      "家庭反馈越具体，下一轮建议越容易个性化。",
    ],
    nextSteps: [
      "今天园内先执行一项最直接的跟进行动，并留下一条结果记录。",
      "今晚家庭同步做一项配合动作，明早补一条反馈。",
      "48 小时内对比是否较前两天更稳定，再决定是否继续加码。",
    ],
    tonightTopAction: payload.currentInterventionCard?.tonightHomeAction ?? "今晚先完成一项家庭动作，再看孩子即时反应。",
    whyNow: "因为今晚的执行结果会直接进入下一轮 follow-up，上下轮建议才能形成闭环。",
    homeSteps: [
      payload.currentInterventionCard?.tonightHomeAction ?? "先按当前建议做一项家庭动作。",
      "执行后记录孩子反应和持续时间。",
      "明早把结果反馈给老师，供下一轮调整参考。",
    ],
    observationPoints: payload.currentInterventionCard?.observationPoints ?? [
      "情绪是否更稳定",
      "饮水或进食是否更主动",
      "入睡和晨起是否更顺",
    ],
    teacherObservation:
      payload.currentInterventionCard?.tomorrowObservationPoint ?? `${childName} 明日入园后的情绪、晨检状态和家庭反馈是否一致。`,
    reviewIn48h: payload.currentInterventionCard?.reviewIn48h ?? "48 小时内对比今晚和明早表现，再决定是否继续加码。",
    recommendedQuestions: [
      "我做完之后应该怎么反馈？",
      "如果今晚没改善，明天要不要继续做？",
      "老师明天会继续看什么？",
    ],
    disclaimer: "本建议由本地规则生成，仅用于托育观察与家园沟通参考，不构成医疗诊断。",
    source: "mock",
  };
}

export function buildMockInstitutionFollowUp(
  payload: AiFollowUpPayload,
  snapshot: InstitutionSuggestionSnapshot
): AiFollowUpResponse {
  const focusText = payload.question.trim();
  const topItems = snapshot.priorityTopItems.slice(0, 3);
  const focusedItems =
    focusText.includes("儿童")
      ? snapshot.priorityTopItems.filter((item) => item.targetType === "child").slice(0, 3)
      : focusText.includes("班级")
        ? snapshot.priorityTopItems.filter((item) => item.targetType === "class").slice(0, 3)
        : focusText.includes("家长")
          ? snapshot.priorityTopItems.filter((item) => item.targetType === "family").slice(0, 3)
          : topItems;
  const primary = focusedItems[0] ?? topItems[0];

  return {
    answer:
      primary
        ? `针对“${focusText}”，当前最值得先推进的是${primary.targetName}。这类事项已经同时影响机构风险识别和闭环效率，园长最好先派单、再盯执行，再在当天收尾时复盘是否需要扩大整改范围。`
        : `针对“${focusText}”，当前没有新的高优先级增量，更适合先把已有派单和反馈闭环压实。`,
    keyPoints:
      focusedItems.length > 0
        ? focusedItems.map((item) => `${item.targetName}｜${item.priorityLevel}｜${item.reason}`)
        : [`重点儿童 ${snapshot.riskChildren.length} 名`, `高风险班级 ${snapshot.riskClasses.length} 个`],
    nextSteps: [
      primary
        ? `先给${primary.recommendedOwnerName ?? primary.recommendedOwnerRole ?? "责任人"}下发${primary.targetName}的整改动作。`
        : "先核对TOP3是否都已经有责任人。",
      snapshot.pendingDispatches[0]
        ? `同步跟进派单“${snapshot.pendingDispatches[0].title}”的当前状态。`
        : "放学前检查是否需要为TOP事项补充派单。",
      "复盘机构级动作是否真的推动了儿童、班级和家庭闭环。",
    ],
    disclaimer: "本建议由本地 mock 结果生成，仅用于托育运营演示与机构决策辅助。",
    source: "mock",
  };
}

export function buildMockWeeklyReport(
  snapshot: WeeklyReportSnapshot,
  role?: WeeklyReportRole
): WeeklyReportResponse {
  const resolvedRole = role ?? normalizeWeeklyReportRole(snapshot.role) ?? "admin";
  return buildActionizedWeeklyReportResponse({
    role: resolvedRole,
    snapshot,
    summary:
      `${snapshot.periodLabel}整体运营较稳定，出勤率约 ${snapshot.overview.attendanceRate}%，` +
      `共沉淀 ${snapshot.overview.mealRecordCount} 条餐食记录和 ${snapshot.overview.feedbackCount} 条家园反馈。` +
      `${snapshot.overview.pendingReviewCount > 0 ? `当前仍有 ${snapshot.overview.pendingReviewCount} 项待复查，` : "重点事项基本完成闭环，"}` +
      "下周建议继续聚焦重点儿童的饮水、情绪和成长跟踪。",
    highlights: [
      "本周饮食、成长和反馈记录连续性较好，适合做趋势复盘。",
      `膳食均衡率约 ${snapshot.diet.balancedRate}%，班级整体执行情况较稳定。`,
      "家园协同链路保持畅通，适合继续推进精细化干预。",
    ],
    risks: snapshot.risks.length > 0 ? snapshot.risks.slice(0, 3) : ["少数幼儿仍存在饮水或蔬果摄入不足风险。"],
    nextWeekActions: [
      "对待复查幼儿安排固定复盘时点，避免关注项积压。",
      "继续针对低饮水和低蔬果儿童做分层提醒与家庭反馈闭环。",
      "把本周高频风险转成下周班级日常巡查清单。",
    ],
    trendPrediction:
      snapshot.overview.healthAbnormalCount > 0 || snapshot.overview.pendingReviewCount > 2 ? "up" : "stable",
    disclaimer: "本建议由本地规则生成，仅用于托育观察与家园沟通参考，不构成医疗诊断。",
    source: "mock",
  });
}
