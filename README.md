# SmartChildcare Agent

面向托育场景的移动端优先 AI 助手 / Multi-Agent 比赛原型。

SmartChildcare Agent 当前服务于 vivo AIGC 创新赛的演示与答辩目标。它不是“托育后台 + AI 插件”，而是围绕教师、家长、园长三端，把 `记录 -> 分析 -> 建议 -> 干预 -> 反馈 -> 复查` 做成可录屏、可答辩、可继续交接的 Agent 工作流。

## 当前最适合录屏的 4 条主线

### 1. Teacher 语音入口主线
- 起点：`/teacher`
- 关键页面：`/teacher` -> 全局语音入口 -> `/teacher/agent`
- AI 在做什么：ASR / transcript -> understanding -> T5 draft seed -> 草稿确认
- 画面重点：语音层、结构化草稿、warnings、草稿源
- 诚实口径：Teacher 语音入口已具演示闭环；ASR live upstream 仍未 fully verified

### 2. 高风险会诊主线
- 起点：`/teacher/high-risk-consultation`
- 关键页面：`/teacher/high-risk-consultation`
- AI 在做什么：memory context 合并、多 Agent 分阶段推理、输出 summary / 48 小时复查 / intervention card
- 画面重点：stage 推进、summary card、follow-up card、intervention card、`providerTrace`、`memoryMeta`
- 诚实口径：这是当前最强 Agent workflow；`next-stream-fallback` 或 demo trace 不代表远端 brain 全链路已验收

### 3. Admin 决策区主线
- 起点：`/admin`
- 关键页面：`/admin`，必要时进入 `/admin/agent`
- AI 在做什么：把 consultation 结果压缩成优先级、决策卡、派单和 explainability 线索
- 画面重点：`RiskPriorityBoard`、source badge、优先级条目、Agent 入口
- 诚实口径：这是第二展示位；不代表 T9C 低层接线或远端聚合已 fully 打通

### 4. Parent 趋势线 / 微绘本主线
- 起点：`/parent`
- 关键页面：`/parent` -> `/parent/storybook?child=...` -> `/parent/agent?child=...`
- AI 在做什么：把成长亮点 / 会诊 / 干预卡整理成 3 幕故事，同时完成 7 / 14 / 30 天趋势聚合与解释
- 画面重点：`StoryBookViewer`、scene 状态、`trendLabel`、`source`、`dataQuality`、`warnings`、`TrendLineChart`
- 诚实口径：微绘本已具 wow factor 和展示链路，但图像 / 配音与上游 live 仍有 fallback 边界；趋势查询必须走 FastAPI brain

## 本地运行

### 前端

```powershell
npm install
npm run dev
```

默认地址：`http://127.0.0.1:3000`

### 后端

```powershell
py -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

建议在同一终端会话里设置：

```powershell
$env:BRAIN_API_BASE_URL = "http://127.0.0.1:8000"
```

### 环境变量

- 只允许通过环境变量使用 `VIVO_APP_ID` / `VIVO_APP_KEY`
- 不要把真实值写入代码、README、日志、截图或示例文件
- 本仓库默认沿用 `backend/app/providers/vivo_*` 作为服务端接入落点

## 最小验证命令

```powershell
npm run lint
npm run build
$env:PYTHONPATH = "backend"
py -m pytest backend/tests/test_teacher_voice_understand.py backend/tests/test_high_risk_consultation_stream.py backend/tests/test_admin_consultation_feed.py backend/tests/test_parent_trend_service.py backend/tests/test_parent_storybook_service.py backend/tests/test_parent_storybook_endpoint.py backend/tests/test_story_image_provider.py backend/tests/test_vivo_tts_provider.py -q
```

### 2026-04-07 本地验证基线

- `npm run lint`：通过，1 个现存 warning
- `npm run build`：通过
- 定向 pytest：32 项通过

当前已确认覆盖：
- Teacher voice
- 高风险会诊
- Admin consultation feed
- Parent trend
- Parent storybook
- story image provider
- vivo tts

## Real Chain 与 Fallback 边界

- `vivo_llm` / `vivo_asr`
  - 可写成“代码层接入 + smoke / test 基础已具备”
  - 不可写成 fully live / fully verified
- Teacher voice
  - 支持 best-effort fallback
  - fallback 只说明结构化草稿链路能跑通
- 高风险会诊
  - 可通过 `?trace=debug` 查看 `providerTrace` 与 `memoryMeta`
  - debug case / demo trace 不等于远端真实链路验收
- Admin feed
  - `/api/ai/high-risk-consultation/feed` 自身会返回 unavailable
  - UI 层会根据本地 consultation 做展示级 fallback
- Parent trend
  - `/api/ai/parent-trend-query` 必须走 FastAPI brain
  - Next 本地 fallback 被明确禁用
- Parent storybook
  - `/api/ai/parent-storybook` 支持 `next-json-fallback`
  - story image / audio 默认允许 mock / asset / fallback
- staging
  - 不能写成 fully healthy / fully switched
  - 当前只能保守写成“已有局部远端链路证据，仍在收口”

## 推荐阅读

- [AGENTS.md](./AGENTS.md)
- [docs/current-status-ledger.md](./docs/current-status-ledger.md)
- [docs/competition-architecture.md](./docs/competition-architecture.md)
- [docs/demo-script.md](./docs/demo-script.md)
- [docs/competition-pitch.md](./docs/competition-pitch.md)
- [docs/agent-workflows.md](./docs/agent-workflows.md)
- [docs/teacher-voice-smoke.md](./docs/teacher-voice-smoke.md)
- [docs/teacher-consultation-qa.md](./docs/teacher-consultation-qa.md)
- [docs/parent-trend-smoke.md](./docs/parent-trend-smoke.md)
