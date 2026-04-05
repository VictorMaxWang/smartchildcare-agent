#!/usr/bin/env node

const baseUrl = String(process.env.AI_SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const endpoint = `${baseUrl}/api/ai/parent-trend-query`;
const loginEndpoint = `${baseUrl}/api/auth/demo-login`;
const smokeCase = String(process.env.TREND_SMOKE_CASE || "both").toLowerCase();
const timeoutMs = Number(process.env.TREND_SMOKE_TIMEOUT_MS || 15000);
const demoAccountId = process.env.TREND_SMOKE_DEMO_ACCOUNT_ID || "u-admin";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(response) {
  const rawText = await response.text();
  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error(`non-json response: ${rawText.slice(0, 200)}`);
  }
}

async function loginAndGetCookie() {
  const response = await fetchWithTimeout(loginEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId: demoAccountId }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`demo login failed: ${response.status} ${text.slice(0, 200)}`);
  }

  const cookie = response.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("demo login succeeded but set-cookie header is missing");
  }

  return cookie.split(";")[0];
}

async function postTrend(cookie, payload) {
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify(payload),
  });

  const data = await readJson(response);
  return { status: response.status, data };
}

function assertCoreFields(result, label) {
  assert(Array.isArray(result.data?.series), `${label}: missing series`);
  assert(typeof result.data?.trendLabel === "string", `${label}: missing trendLabel`);
  assert(typeof result.data?.explanation === "string", `${label}: missing explanation`);
  assert(result.data?.dataQuality && typeof result.data.dataQuality === "object", `${label}: missing dataQuality`);
  assert(Array.isArray(result.data?.warnings), `${label}: missing warnings`);
}

function printSummary(label, result) {
  console.log(`\n=== ${label} ===`);
  console.log(`status: ${result.status}`);
  console.log(`source: ${result.data?.source ?? "(missing)"}`);
  console.log(`fallback: ${String(result.data?.fallback ?? "(missing)")}`);
  console.log(`trendLabel: ${result.data?.trendLabel ?? "(missing)"}`);
  console.log(
    `observedDays: ${result.data?.dataQuality?.observedDays ?? "(missing)"} / ${result.data?.windowDays ?? "(missing)"}`
  );
  console.log(`warnings: ${Array.isArray(result.data?.warnings) ? result.data.warnings.length : 0}`);
}

function buildSuccessPayload() {
  return {
    question: "这周饮食情况有改善吗？",
    childId: "child-1",
    appSnapshot: {
      children: [
        {
          id: "child-1",
          name: "安安",
          nickname: "安宝",
          institutionId: "inst-test",
          className: "小一班",
        },
      ],
      attendance: [],
      meals: [
        {
          id: "meal-1",
          childId: "child-1",
          date: "2026-03-29",
          meal: "lunch",
          foods: ["rice", "vegetable", "protein"],
          intakeLevel: "low",
          preference: "dislike",
          waterMl: 90,
          nutritionScore: 56,
          aiEvaluation: { summary: "只吃主食，蔬菜和蛋白接受度偏低。" },
        },
        {
          id: "meal-2",
          childId: "child-1",
          date: "2026-03-30",
          meal: "lunch",
          foods: ["rice", "vegetable", "protein"],
          intakeLevel: "low",
          preference: "dislike",
          waterMl: 100,
          nutritionScore: 58,
          aiEvaluation: { summary: "饮食结构仍偏单一。" },
        },
        {
          id: "meal-3",
          childId: "child-1",
          date: "2026-03-31",
          meal: "lunch",
          foods: ["rice", "vegetable", "protein"],
          intakeLevel: "medium",
          preference: "neutral",
          waterMl: 110,
          nutritionScore: 60,
          aiEvaluation: { summary: "开始接受部分蔬菜。" },
        },
        {
          id: "meal-4",
          childId: "child-1",
          date: "2026-04-01",
          meal: "lunch",
          foods: ["rice", "vegetable", "protein"],
          intakeLevel: "medium",
          preference: "neutral",
          waterMl: 140,
          nutritionScore: 74,
          aiEvaluation: { summary: "进餐主动性提升。" },
        },
        {
          id: "meal-5",
          childId: "child-1",
          date: "2026-04-02",
          meal: "lunch",
          foods: ["rice", "vegetable", "protein"],
          intakeLevel: "good",
          preference: "neutral",
          waterMl: 150,
          nutritionScore: 80,
          aiEvaluation: { summary: "蔬菜接受度继续改善。" },
        },
        {
          id: "meal-6",
          childId: "child-1",
          date: "2026-04-03",
          meal: "lunch",
          foods: ["rice", "vegetable", "protein"],
          intakeLevel: "good",
          preference: "accept",
          waterMl: 170,
          nutritionScore: 84,
          aiEvaluation: { summary: "午餐基本吃完。" },
        },
        {
          id: "meal-7",
          childId: "child-1",
          date: "2026-04-04",
          meal: "lunch",
          foods: ["rice", "vegetable", "protein"],
          intakeLevel: "high",
          preference: "accept",
          waterMl: 180,
          nutritionScore: 88,
          aiEvaluation: { summary: "当天饮食完成度高，喝水稳定。" },
        },
      ],
      growth: [],
      feedback: [],
      health: [],
      taskCheckIns: [],
      interventionCards: [],
      consultations: [],
      mobileDrafts: [],
      reminders: [],
      updatedAt: "2026-04-04T00:00:00Z",
    },
  };
}

function buildFallbackPayload() {
  return {
    question: "最近两周睡眠情况稳定吗？",
    childId: "c-11",
  };
}

async function runSuccessCase(cookie) {
  const result = await postTrend(cookie, buildSuccessPayload());
  printSummary("Trend success", result);

  assert(result.status === 200, `success case returned ${result.status}`);
  assertCoreFields(result, "success case");
  assert(result.data.source === "request_snapshot", "success case: source should be request_snapshot");
  assert(result.data.fallback === false, "success case: fallback should be false");
  assert(result.data.dataQuality.fallbackUsed === false, "success case: fallbackUsed should be false");
}

async function runFallbackCase(cookie) {
  const result = await postTrend(cookie, buildFallbackPayload());
  printSummary("Trend fallback", result);

  assert(result.status === 200, `fallback case returned ${result.status}`);
  assertCoreFields(result, "fallback case");
  assert(result.data.source === "demo_snapshot", "fallback case: source should be demo_snapshot");
  assert(result.data.fallback === true, "fallback case: fallback should be true");
  assert(result.data.dataQuality.fallbackUsed === true, "fallback case: fallbackUsed should be true");
  assert(result.data.dataQuality.observedDays === 0, "fallback case: observedDays should be 0");
  assert(result.data.dataQuality.coverageRatio === 0, "fallback case: coverageRatio should be 0");
  assert(result.data.dataQuality.sparse === true, "fallback case: sparse should be true");
  assert(result.data.comparison?.direction === "insufficient", "fallback case: direction should be insufficient");
  assert(result.data.trendLabel !== "改善", "fallback case: trendLabel should not pretend to be 改善");
  assert(result.data.warnings.length > 0, "fallback case: warnings should be present");
}

async function main() {
  console.log(`Trend smoke target: ${endpoint}`);
  console.log(`Trend smoke mode: ${smokeCase}`);

  try {
    const cookie = await loginAndGetCookie();

    if (smokeCase === "success" || smokeCase === "both") {
      await runSuccessCase(cookie);
    }

    if (smokeCase === "fallback" || smokeCase === "both") {
      await runFallbackCase(cookie);
    }

    console.log("\n[OK] Parent trend smoke passed.");
  } catch (error) {
    console.error("\n[FAIL] Parent trend smoke failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
