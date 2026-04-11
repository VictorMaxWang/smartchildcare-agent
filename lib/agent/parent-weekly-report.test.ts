import assert from "node:assert/strict";
import test from "node:test";

import { buildParentWeeklyReportSnapshot } from "./parent-weekly-report.ts";
import type { ParentAgentChildContext } from "./parent-agent.ts";

function createContext(
  overrides: Partial<ParentAgentChildContext> = {}
): ParentAgentChildContext {
  const base: ParentAgentChildContext = {
    today: "2026-04-11",
    child: {
      id: "child-1",
      name: "Mia",
      birthDate: "2022-06-01",
      gender: "女",
      allergies: ["花生"],
      heightCm: 98,
      weightKg: 15,
      guardians: [{ name: "Lin", relation: "妈妈", phone: "13800000000" }],
      institutionId: "inst-1",
      className: "Sun Class",
      specialNotes: "需要午睡前安抚",
      avatar: "/demo/mia.png",
      parentUserId: "parent-1",
    },
    smartInsights: [
      {
        id: "insight-warning",
        title: "补水偏少",
        description: "最近一周补水主动性偏弱",
        level: "warning",
        tags: ["hydration"],
      },
      {
        id: "insight-info",
        title: "午睡更稳定",
        description: "最近几天午睡节奏更平稳",
        level: "info",
        tags: ["sleep"],
      },
    ],
    todayMeals: [],
    weeklyMeals: [
      {
        id: "meal-1",
        childId: "child-1",
        date: "2026-04-08",
        meal: "午餐",
        foods: [{ id: "food-1", name: "米饭", category: "主食", amount: "1份" }],
        intakeLevel: "适中",
        preference: "正常",
        waterMl: 120,
        nutritionScore: 88,
        recordedBy: "teacher-1",
        recordedByRole: "教师",
      },
      {
        id: "meal-2",
        childId: "child-1",
        date: "2026-04-10",
        meal: "午餐",
        foods: [{ id: "food-2", name: "西兰花", category: "蔬果", amount: "1份" }],
        intakeLevel: "适中",
        preference: "偏好",
        waterMl: 140,
        nutritionScore: 90,
        recordedBy: "teacher-1",
        recordedByRole: "教师",
      },
    ],
    weeklyHealthChecks: [
      {
        id: "health-1",
        childId: "child-1",
        date: "2026-04-08",
        temperature: 37.5,
        mood: "有点烦躁",
        handMouthEye: "正常",
        isAbnormal: true,
        checkedBy: "teacher-1",
        checkedByRole: "教师",
      },
      {
        id: "health-2",
        childId: "child-1",
        date: "2026-04-10",
        temperature: 36.7,
        mood: "稳定",
        handMouthEye: "正常",
        isAbnormal: false,
        checkedBy: "teacher-1",
        checkedByRole: "教师",
      },
    ],
    weeklyGrowthRecords: [
      {
        id: "growth-1",
        childId: "child-1",
        createdAt: "2026-04-09 10:00",
        recorder: "teacher-1",
        recorderRole: "教师",
        category: "情绪表现",
        tags: ["午睡前"],
        description: "午睡前需要更多安抚",
        needsAttention: true,
        followUpAction: "继续记录午睡前情绪",
        reviewStatus: "待复查",
      },
      {
        id: "growth-2",
        childId: "child-1",
        createdAt: "2026-04-10 11:00",
        recorder: "teacher-1",
        recorderRole: "教师",
        category: "睡眠情况",
        tags: ["午睡"],
        description: "入睡速度较前一周更稳定",
        needsAttention: false,
      },
    ],
    attentionGrowthRecords: [
      {
        id: "growth-1",
        childId: "child-1",
        createdAt: "2026-04-09 10:00",
        recorder: "teacher-1",
        recorderRole: "教师",
        category: "情绪表现",
        tags: ["午睡前"],
        description: "午睡前需要更多安抚",
        needsAttention: true,
        followUpAction: "继续记录午睡前情绪",
        reviewStatus: "待复查",
      },
    ],
    pendingReviews: [
      {
        id: "growth-1",
        childId: "child-1",
        createdAt: "2026-04-09 10:00",
        recorder: "teacher-1",
        recorderRole: "教师",
        category: "情绪表现",
        tags: ["午睡前"],
        description: "午睡前需要更多安抚",
        needsAttention: true,
        followUpAction: "继续记录午睡前情绪",
        reviewStatus: "待复查",
      },
    ],
    weeklyFeedbacks: [
      {
        id: "feedback-1",
        childId: "child-1",
        date: "2026-04-10",
        status: "在家已配合",
        content: "昨晚入睡更顺利",
        sourceWorkflow: "parent-agent",
        executionStatus: "completed",
        executed: true,
        childReaction: "愿意配合",
        improved: true,
        freeNote: "晚饭后情绪更稳",
        createdBy: "parent-1",
        createdByRole: "家长",
      },
    ],
    latestFeedback: {
      id: "feedback-1",
      childId: "child-1",
      date: "2026-04-10",
      status: "在家已配合",
      content: "昨晚入睡更顺利",
      sourceWorkflow: "parent-agent",
      executionStatus: "completed",
      executed: true,
      childReaction: "愿意配合",
      improved: true,
      freeNote: "晚饭后情绪更稳",
      createdBy: "parent-1",
      createdByRole: "家长",
    },
    weeklyTrend: {
      balancedRate: 72,
      vegetableDays: 4,
      proteinDays: 5,
      stapleDays: 5,
      hydrationAvg: 138,
      monotonyDays: 1,
    },
    task: {
      id: "task-1",
      title: "睡前安抚",
      description: "睡前保持固定安抚节奏",
      durationText: "10分钟",
      tag: "今晚任务",
    },
    taskCheckIns: [],
    teacherSuggestionSummary: "老师建议继续观察午睡前情绪变化",
    currentInterventionCard: null,
    activeTask: undefined,
    taskTimeline: [],
    focusReasons: ["补水偏少", "本周有 1 项待复查观察记录"],
    observationDefaults: ["今晚是否比前几天更容易安静入睡"],
  };

  return {
    ...base,
    ...overrides,
  };
}

test("buildParentWeeklyReportSnapshot maps parent context into weekly report snapshot", () => {
  const snapshot = buildParentWeeklyReportSnapshot(createContext());

  assert.equal(snapshot.role, "parent");
  assert.equal(snapshot.institutionName, "Sun Class");
  assert.equal(snapshot.periodLabel, "近7天");
  assert.deepEqual(snapshot.overview, {
    visibleChildren: 1,
    attendanceRate: 60,
    mealRecordCount: 2,
    healthAbnormalCount: 1,
    growthAttentionCount: 1,
    pendingReviewCount: 1,
    feedbackCount: 1,
  });
  assert.deepEqual(snapshot.diet, {
    balancedRate: 72,
    hydrationAvg: 138,
    monotonyDays: 1,
    vegetableDays: 4,
    proteinDays: 5,
  });
  assert.equal(snapshot.topAttentionChildren.length, 1);
  assert.equal(snapshot.topAttentionChildren[0]?.childName, "Mia");
  assert.equal(snapshot.topAttentionChildren[0]?.attentionCount, 2);
  assert.ok(snapshot.highlights.some((item) => item.includes("本周已形成 1 次家园反馈")));
  assert.ok(snapshot.highlights.some((item) => item.includes("最近一次家庭反馈显示孩子已有稳定改善")));
  assert.ok(snapshot.risks.some((item) => item.includes("补水偏少")));
});

test("buildParentWeeklyReportSnapshot keeps honest defaults when parent context is sparse", () => {
  const snapshot = buildParentWeeklyReportSnapshot(
    createContext({
      smartInsights: [],
      weeklyMeals: [],
      weeklyHealthChecks: [],
      weeklyGrowthRecords: [],
      attentionGrowthRecords: [],
      pendingReviews: [],
      weeklyFeedbacks: [],
      latestFeedback: undefined,
      focusReasons: [],
      teacherSuggestionSummary: undefined,
    })
  );

  assert.equal(snapshot.overview.attendanceRate, 0);
  assert.equal(snapshot.overview.mealRecordCount, 0);
  assert.equal(snapshot.overview.feedbackCount, 0);
  assert.equal(snapshot.topAttentionChildren.length, 0);
  assert.deepEqual(snapshot.risks, []);
  assert.deepEqual(snapshot.highlights, ["本周已汇总园内观察与家庭反馈，适合继续做家园共育复盘"]);
});
