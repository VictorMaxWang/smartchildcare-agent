import assert from "node:assert/strict";
import test from "node:test";
import { routeIntentRequest } from "./intent-router.ts";
import type { IntentRouterIntent } from "./types.ts";

test("routeIntentRequest covers required supported intents", () => {
  const cases: Array<{
    name: string;
    payload: Parameters<typeof routeIntentRequest>[0];
    intent: IntentRouterIntent;
    workflow: string;
    page: string;
    optionalKind: string | null;
  }> = [
    {
      name: "teacher record observation",
      payload: { message: "请帮我记录观察并跟进", roleHint: "teacher", childId: "c-1" },
      intent: "record_observation",
      workflow: "teacher.react.run",
      page: "/teacher/agent",
      optionalKind: "teacher-react-run",
    },
    {
      name: "teacher parent draft",
      payload: { message: "给家长发一条沟通草稿", roleHint: "teacher", childId: "c-2" },
      intent: "generate_parent_draft",
      workflow: "teacher.agent.communication",
      page: "/teacher/agent",
      optionalKind: "teacher-agent-run",
    },
    {
      name: "teacher consultation",
      payload: { message: "这个孩子需要高风险会诊", roleHint: "teacher", childId: "c-3" },
      intent: "start_consultation",
      workflow: "teacher.consultation.high-risk",
      page: "/teacher/high-risk-consultation",
      optionalKind: "teacher-consultation-run",
    },
    {
      name: "teacher weekly report",
      payload: { message: "帮我出本周观察周报", sourcePage: "/teacher/agent" },
      intent: "ask_weekly_report",
      workflow: "teacher.agent.weekly-summary",
      page: "/teacher/agent",
      optionalKind: "teacher-agent-run",
    },
    {
      name: "parent trend",
      payload: { message: "最近一周饮食趋势怎么样", roleHint: "parent", childId: "c-4" },
      intent: "query_trend",
      workflow: "parent.trend.query",
      page: "/parent/agent",
      optionalKind: "parent-trend-query",
    },
    {
      name: "parent tonight action",
      payload: { message: "今晚家庭行动我该做什么", roleHint: "parent", childId: "c-5" },
      intent: "view_tonight_action",
      workflow: "parent.agent.suggestions",
      page: "/parent/agent",
      optionalKind: "parent-agent-run",
    },
    {
      name: "parent storybook",
      payload: { message: "打开今晚的睡前故事绘本", childId: "c-6" },
      intent: "ask_storybook",
      workflow: "parent.storybook",
      page: "/parent/storybook",
      optionalKind: "parent-storybook-run",
    },
    {
      name: "admin priority",
      payload: { message: "今天机构优先级 top 3 是什么", roleHint: "admin" },
      intent: "view_priority",
      workflow: "admin.agent.daily-priority",
      page: "/admin/agent",
      optionalKind: "admin-agent-run",
    },
    {
      name: "admin weekly report",
      payload: { message: "生成本周运营周报", roleHint: "admin" },
      intent: "ask_weekly_report",
      workflow: "admin.agent.weekly-ops-report",
      page: "/admin/agent",
      optionalKind: "admin-agent-run",
    },
  ];

  cases.forEach((item) => {
    const result = routeIntentRequest(item.payload);
    assert.equal(result.intent, item.intent, item.name);
    assert.equal(result.targetWorkflow, item.workflow, item.name);
    assert.equal(result.targetPage, item.page, item.name);
    assert.equal(result.optionalPayload?.kind ?? null, item.optionalKind, item.name);
    assert.ok(result.previewCard.title.length > 0, `${item.name} preview title`);
    assert.ok(result.deeplink.startsWith(item.page), `${item.name} deeplink`);
  });
});

test("routeIntentRequest prefers roleHint over inferred role", () => {
  const result = routeIntentRequest({
    message: "打开今晚的睡前故事绘本",
    roleHint: "teacher",
    childId: "c-9",
  });

  assert.equal(result.detectedRole, "teacher");
  assert.equal(result.intent, "unknown");
  assert.equal(result.targetWorkflow, "");
  assert.equal(result.optionalPayload, null);
});

test("routeIntentRequest returns structured unknown fallback", () => {
  const result = routeIntentRequest({
    message: "随便聊聊今天怎么样",
  });

  assert.equal(result.detectedRole, "unknown");
  assert.equal(result.intent, "unknown");
  assert.equal(result.targetPage, "/");
  assert.equal(result.deeplink, "/");
  assert.equal(result.optionalPayload, null);
  assert.ok(result.previewCard.badges.includes("unknown-intent"));
});
