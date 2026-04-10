import type {
  AiRiskLevel,
  ConsultationFinding,
  ConsultationParticipant,
  ConsultationResult,
  ConsultationTriggerType,
  DirectorDecisionCard,
  HighRiskAgentView,
} from "@/lib/ai/types";
import { getLocalToday, shiftLocalDate } from "@/lib/date";

type DemoConsultationSeed = {
  consultationId: string;
  childId: string;
  childName: string;
  className: string;
  daysAgo: number;
  riskLevel: AiRiskLevel;
  status: DirectorDecisionCard["status"];
  shouldEscalateToAdmin: boolean;
  ownerRole: "teacher" | "parent" | "admin";
  ownerName: string;
  triggerReason: string;
  summary: string;
  schoolActions: string[];
  homeActions: string[];
  followUp48h: string[];
  observationPoints: string[];
  keyFindings: string[];
  healthSignal: string;
  mealSignal: string;
  familySignal: string;
  schoolSignal: string;
};

type DemoFeedItem = {
  consultationId: string;
  childId: string;
  generatedAt: string;
  riskLevel: AiRiskLevel;
  triggerReason: string;
  triggerReasons: string[];
  summary: string;
  directorDecisionCard: DirectorDecisionCard;
  status: DirectorDecisionCard["status"];
  ownerName: string;
  ownerRole: "teacher" | "parent" | "admin";
  dueAt: string;
  whyHighPriority: string;
  todayInSchoolActions: string[];
  tonightAtHomeActions: string[];
  followUp48h: string[];
  syncTargets: string[];
  shouldEscalateToAdmin: boolean;
};

const DEMO_CONSULTATION_SEEDS: DemoConsultationSeed[] = [
  {
    consultationId: "consultation-c-16",
    childId: "c-16",
    childName: "高子墨",
    className: "晨曦班",
    daysAgo: 0,
    riskLevel: "high",
    status: "pending",
    shouldEscalateToAdmin: true,
    ownerRole: "admin",
    ownerName: "园长王老师",
    triggerReason: "环境切换后的情绪崩溃仍在反复，且同伴参与度持续偏低。",
    summary: "情绪敏感样本需要保留园内安抚流程，并把今晚家庭反馈和 48 小时复查接成同一条线。",
    schoolActions: ["今日园内动作：午休前继续使用图片预告卡和慢呼吸安抚流程。", "离园前补齐两段情绪过渡观察记录，避免只看结果不看触发点。"] ,
    homeActions: ["今晚家庭任务：只守住固定睡前顺序，不追求立刻入睡。", "睡前 20 分钟反馈一次孩子是否因突发声音明显紧张。"] ,
    followUp48h: ["48 小时复查：回看情绪触发频次是否下降，并决定是否继续保留园长跟进。"] ,
    observationPoints: ["午休前情绪波动", "环境切换接受度", "睡前安抚持续时长"],
    keyFindings: ["情绪波动与环境切换高度相关", "需要家园两端使用同一套安抚节奏"],
    healthSignal: "晨检体温正常，但午休前情绪波动明显。",
    mealSignal: "进餐可完成，但在环境切换后饮水主动性下降。",
    familySignal: "家庭反馈提到近两晚对突发声音更敏感。",
    schoolSignal: "园内观察显示户外转室内时最容易崩溃。",
  },
  {
    consultationId: "consultation-c-15",
    childId: "c-15",
    childName: "马若曦",
    className: "向阳班",
    daysAgo: 0,
    riskLevel: "high",
    status: "pending",
    shouldEscalateToAdmin: true,
    ownerRole: "teacher",
    ownerName: "向阳班主班老师",
    triggerReason: "补水持续偏低，并叠加饮食规避与过敏替代餐管理。",
    summary: "补水风险已经连续多天出现，需要把园内饮水提醒、家庭晚间补水和 48 小时复查一起挂上。",
    schoolActions: ["今日园内动作：半小时饮水提醒继续执行，并记录每次主动饮水量。", "午后加餐后再补一次水杯刻度照片，供家长晚间对照。"] ,
    homeActions: ["今晚家庭任务：晚饭后完成一杯温水补水，并反馈喝水阻力。", "睡前补一条是否出现口渴、嘴唇干燥或拒水情况。"] ,
    followUp48h: ["48 小时复查：对照园内与家庭补水记录，确认是否回到合理区间。"] ,
    observationPoints: ["主动饮水次数", "加餐后喝水量", "晚间补水配合度"],
    keyFindings: ["补水偏低已持续多日", "需要家庭晚间补水反馈来闭环"],
    healthSignal: "晨检无发热，但嘴唇偏干，老师多次提醒后才补水。",
    mealSignal: "午餐可完成，水杯刻度下降缓慢。",
    familySignal: "家长反馈回家后也需要频繁提醒才喝水。",
    schoolSignal: "园内记录显示下午两点后饮水明显放缓。",
  },
  {
    consultationId: "consultation-c-14",
    childId: "c-14",
    childName: "郑浩宇",
    className: "晨曦班",
    daysAgo: 1,
    riskLevel: "high",
    status: "in_progress",
    shouldEscalateToAdmin: true,
    ownerRole: "teacher",
    ownerName: "晨曦班主班老师",
    triggerReason: "午睡入睡困难与晚间作息波动没有稳定改善，白天疲惫和易躁重复出现。",
    summary: "睡眠样本不能只看单次好转，需要保留 48 小时复查点，避免过早下结论。",
    schoolActions: ["今日园内动作：午睡前减少高刺激活动，保留固定白噪音和靠窗安静床位。", "午休后补一条醒后情绪和精力状态记录。"] ,
    homeActions: ["今晚家庭任务：21:00 前关闭屏幕并执行固定洗漱-故事-关灯顺序。", "若再次晚睡，请直接在离园反馈里说明卡在哪个环节。"] ,
    followUp48h: ["48 小时复查：回看午睡时长、醒后情绪和晚间入睡时间是否一起改善。"] ,
    observationPoints: ["午睡入睡时长", "醒后情绪", "晚间上床时间"],
    keyFindings: ["午睡问题与晚间作息波动叠加", "白天疲惫已影响情绪稳定"],
    healthSignal: "晨间持续困倦，活动前段精力不足。",
    mealSignal: "进餐完成度尚可，但疲惫时进餐速度明显变慢。",
    familySignal: "家长反馈前一晚再次超过 22:30 才入睡。",
    schoolSignal: "午睡 25 分钟后仍未入睡，醒后情绪烦躁。",
  },
  {
    consultationId: "consultation-c-8",
    childId: "c-8",
    childName: "黄嘉豪",
    className: "向阳班",
    daysAgo: 1,
    riskLevel: "medium",
    status: "pending",
    shouldEscalateToAdmin: true,
    ownerRole: "teacher",
    ownerName: "向阳班配班老师",
    triggerReason: "午睡前分离焦虑与家庭反馈缺口叠加，适合作为连续闭环样本。",
    summary: "分离焦虑样本已经有改善苗头，但仍需要园内记录和今晚家庭回传一起看，才能判断是否真正稳定。",
    schoolActions: ["今日园内动作：维持固定接园话术和安抚玩具，不临时更换照护人。", "离园前补一条午休前哭闹时长和恢复方式。"] ,
    homeActions: ["今晚家庭任务：睡前只做一轮短时分离练习，不要额外加难度。", "完成后反馈孩子是更快平静，还是再次黏附家长。"] ,
    followUp48h: ["48 小时复查：看入园分离时长和晚间分离练习反应是否同步缩短。"] ,
    observationPoints: ["入园哭闹时长", "午睡前黏附程度", "家庭短时分离练习反应"],
    keyFindings: ["分离焦虑有改善但不稳定", "家庭反馈缺口会直接影响判断"],
    healthSignal: "晨检正常，但午休前黏附老师更明显。",
    mealSignal: "饮食完成度基本正常，紧张时会暂时停下勺子。",
    familySignal: "最近两天晚间分离练习反馈不完整。",
    schoolSignal: "午睡前哭闹时长虽下降，但仍需要老师近身陪伴。",
  },
];

function buildGeneratedAt(daysAgo: number, hour: number, minute: number) {
  const now = new Date();
  now.setDate(now.getDate() - daysAgo);
  now.setHours(hour, minute, 0, 0);
  return now.toISOString();
}

function buildParticipants(): ConsultationParticipant[] {
  return [
    { id: "health-agent", label: "Health Agent" },
    { id: "diet-agent", label: "Diet Agent" },
    { id: "coparenting-agent", label: "Parent Agent" },
    { id: "execution-agent", label: "Execution Agent" },
    { id: "coordinator", label: "Coordinator" },
  ];
}

function buildFinding(
  agentId: ConsultationParticipant["id"],
  title: string,
  riskExplanation: string,
  signal: string,
  action: string,
  observationPoint: string
): ConsultationFinding {
  return {
    agentId,
    title,
    riskExplanation,
    signals: [signal],
    actions: [action],
    observationPoints: [observationPoint],
    evidence: [signal],
  };
}

function buildAgentView(
  role: HighRiskAgentView["role"],
  title: string,
  summary: string,
  signal: string,
  action: string,
  observationPoint: string
): HighRiskAgentView {
  return {
    role,
    title,
    summary,
    signals: [signal],
    actions: [action],
    observationPoints: [observationPoint],
    evidence: [signal],
  };
}

function buildTriggerTypes(seed: DemoConsultationSeed): ConsultationTriggerType[] {
  const triggerTypes: ConsultationTriggerType[] = ["multi-risk"];
  if (seed.riskLevel === "high") {
    triggerTypes.push("continuous-abnormality");
  }
  if (seed.shouldEscalateToAdmin) {
    triggerTypes.push("admin-priority");
  }
  return triggerTypes;
}

function buildDirectorDecisionCard(seed: DemoConsultationSeed): DirectorDecisionCard {
  return {
    title: "重点会诊决策卡",
    reason: seed.triggerReason,
    recommendedOwnerRole: seed.ownerRole,
    recommendedOwnerName: seed.ownerName,
    recommendedAt: buildGeneratedAt(seed.daysAgo, 18, 0),
    status: seed.status,
  };
}

function buildFeedItem(seed: DemoConsultationSeed): DemoFeedItem {
  const directorDecisionCard = buildDirectorDecisionCard(seed);

  return {
    consultationId: seed.consultationId,
    childId: seed.childId,
    generatedAt: buildGeneratedAt(seed.daysAgo, 17, 20),
    riskLevel: seed.riskLevel,
    triggerReason: seed.triggerReason,
    triggerReasons: [seed.triggerReason, `${seed.childName} 的园内观察与家庭反馈需要继续闭环。`],
    summary: seed.summary,
    directorDecisionCard,
    status: seed.status,
    ownerName: seed.ownerName,
    ownerRole: seed.ownerRole,
    dueAt: directorDecisionCard.recommendedAt,
    whyHighPriority: seed.triggerReason,
    todayInSchoolActions: seed.schoolActions,
    tonightAtHomeActions: seed.homeActions,
    followUp48h: seed.followUp48h,
    syncTargets: [
      "教师端结果卡",
      "家长端今晚任务",
      ...(seed.shouldEscalateToAdmin ? ["园长端决策卡"] : []),
    ],
    shouldEscalateToAdmin: seed.shouldEscalateToAdmin,
  };
}

function buildConsultationResult(seed: DemoConsultationSeed): ConsultationResult {
  const feedItem = buildFeedItem(seed);

  return {
    consultationId: feedItem.consultationId,
    triggerReason: seed.triggerReason,
    triggerType: buildTriggerTypes(seed),
    triggerReasons: feedItem.triggerReasons,
    participants: buildParticipants(),
    childId: seed.childId,
    riskLevel: seed.riskLevel,
    agentFindings: [
      buildFinding(
        "health-agent",
        "晨检与情绪状态需继续联动观察",
        seed.healthSignal,
        seed.healthSignal,
        seed.schoolActions[0],
        seed.observationPoints[0]
      ),
      buildFinding(
        "diet-agent",
        "饮食和补水记录仍需纳入判断",
        seed.mealSignal,
        seed.mealSignal,
        seed.schoolActions[1] ?? seed.schoolActions[0],
        seed.observationPoints[1] ?? seed.observationPoints[0]
      ),
      buildFinding(
        "coparenting-agent",
        "需要家庭端回传今晚状态",
        seed.familySignal,
        seed.familySignal,
        seed.homeActions[0],
        seed.observationPoints[2] ?? seed.observationPoints[0]
      ),
      buildFinding(
        "execution-agent",
        "园内执行和离园前同步必须保留",
        seed.schoolSignal,
        seed.schoolSignal,
        seed.schoolActions[0],
        seed.observationPoints[0]
      ),
    ],
    summary: seed.summary,
    keyFindings: seed.keyFindings,
    healthAgentView: buildAgentView(
      "HealthObservationAgent",
      "Health Agent",
      seed.healthSignal,
      seed.healthSignal,
      seed.schoolActions[0],
      seed.observationPoints[0]
    ),
    dietBehaviorAgentView: buildAgentView(
      "DietBehaviorAgent",
      "Diet Agent",
      seed.mealSignal,
      seed.mealSignal,
      seed.schoolActions[1] ?? seed.schoolActions[0],
      seed.observationPoints[1] ?? seed.observationPoints[0]
    ),
    parentCommunicationAgentView: buildAgentView(
      "ParentCommunicationAgent",
      "Parent Agent",
      seed.familySignal,
      seed.familySignal,
      seed.homeActions[0],
      seed.observationPoints[2] ?? seed.observationPoints[0]
    ),
    inSchoolActionAgentView: buildAgentView(
      "InSchoolActionAgent",
      "Execution Agent",
      seed.schoolSignal,
      seed.schoolSignal,
      seed.schoolActions[0],
      seed.observationPoints[0]
    ),
    todayInSchoolActions: seed.schoolActions,
    tonightAtHomeActions: seed.homeActions,
    followUp48h: seed.followUp48h,
    parentMessageDraft: `今晚请先执行：${seed.homeActions[0]} 做完后补一条孩子反应，明天老师继续承接。`,
    directorDecisionCard: buildDirectorDecisionCard(seed),
    explainability: [
      { label: "关键发现", detail: seed.keyFindings[0] ?? seed.triggerReason },
      { label: "闭环原因", detail: seed.triggerReason },
    ],
    evidenceItems: [],
    nextCheckpoints: seed.followUp48h,
    coordinatorSummary: {
      finalConclusion: seed.summary,
      riskLevel: seed.riskLevel,
      problemDefinition: seed.triggerReason,
      schoolAction: seed.schoolActions[0],
      homeAction: seed.homeActions[0],
      observationPoints: seed.observationPoints,
      reviewIn48h: seed.followUp48h[0],
      shouldEscalateToAdmin: seed.shouldEscalateToAdmin,
    },
    schoolAction: seed.schoolActions[0],
    homeAction: seed.homeActions[0],
    observationPoints: seed.observationPoints,
    reviewIn48h: seed.followUp48h[0],
    shouldEscalateToAdmin: seed.shouldEscalateToAdmin,
    continuityNotes: [`Demo recovery hotfix seed for ${seed.childName}.`],
    memoryMeta: {
      backend: "demo-seed",
      degraded: false,
      usedSources: ["demo-seed"],
      errors: [],
      matchedSnapshotIds: [],
      matchedTraceIds: [],
    },
    source: "mock",
    provider: "demo-seed",
    model: "demo-consultation-v1",
    providerTrace: {
      provider: "demo-seed",
      source: "demo-fallback",
      realProvider: false,
    },
    traceMeta: {
      childName: seed.childName,
      className: seed.className,
      keyFindings: seed.keyFindings,
    },
    realProvider: false,
    fallback: true,
    generatedAt: feedItem.generatedAt,
  };
}

function byPriorityAndRecency(left: DemoConsultationSeed, right: DemoConsultationSeed) {
  const leftRisk = left.riskLevel === "high" ? 0 : left.riskLevel === "medium" ? 1 : 2;
  const rightRisk = right.riskLevel === "high" ? 0 : right.riskLevel === "medium" ? 1 : 2;
  if (leftRisk !== rightRisk) {
    return leftRisk - rightRisk;
  }
  return left.daysAgo - right.daysAgo;
}

export function buildDemoConsultationResults(limit = DEMO_CONSULTATION_SEEDS.length) {
  return [...DEMO_CONSULTATION_SEEDS]
    .sort(byPriorityAndRecency)
    .slice(0, limit)
    .map(buildConsultationResult);
}

export function buildDemoConsultationFeedItems(options?: {
  limit?: number;
  escalatedOnly?: boolean;
}) {
  const limit = options?.limit ?? DEMO_CONSULTATION_SEEDS.length;
  const escalatedOnly = options?.escalatedOnly ?? false;

  return [...DEMO_CONSULTATION_SEEDS]
    .filter((seed) => (escalatedOnly ? seed.shouldEscalateToAdmin : true))
    .sort(byPriorityAndRecency)
    .slice(0, limit)
    .map(buildFeedItem);
}

export function buildDemoConsultationSummary() {
  return {
    generatedAt: buildGeneratedAt(0, 18, 30),
    today: getLocalToday(),
    reviewWindowEnd: shiftLocalDate(getLocalToday(), 2),
  };
}
