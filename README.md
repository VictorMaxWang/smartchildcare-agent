# SmartChildcare Agent

面向托育场景的移动端优先 AI 助手 / Multi-Agent 比赛原型。

SmartChildcare Agent 当前服务于 vivo AIGC 创新赛的演示、答辩与 freeze 前交接目标。它不是“托育后台 + AI 插件”，而是围绕教师、家长、园长三端，把 `记录 -> 分析 -> 建议 -> 干预 -> 反馈 -> 复查` 收束成可录屏、可答辩、可继续交接的 Agent 工作流。

所有涉及 vivo 能力接入的表述，都以官方文档为唯一准绳：

- [vivo 官方文档入口](https://aigc.vivo.com.cn/#/document/index?id=1746)

仅允许通过环境变量使用 `VIVO_APP_ID` / `VIVO_APP_KEY`。不要把真实值写入代码、README、日志、截图或示例文件。

## Freeze-Final 5 条展示路径

### 1. Teacher 语音主线
- 起点：`/teacher`
- 关键页面：`/teacher` -> 全局语音入口 -> `/teacher/agent`
- AI 在做什么：ASR / transcript -> understanding -> T5 draft seed -> 草稿确认
- 画面重点：语音层状态、结构化草稿、warnings、草稿源
- 保守口径：Teacher 语音入口已具演示闭环；ASR live upstream 仍未 fully verified

### 2. 高风险会诊主线
- 起点：`/teacher/high-risk-consultation`
- 关键页面：`/teacher/high-risk-consultation`
- AI 在做什么：合并 memory context，按 stage 推进多 Agent 会诊，输出 summary / 48 小时复查 / intervention card
- 画面重点：stage 推进、summary card、follow-up card、intervention card、`providerTrace`、`memoryMeta`
- 保守口径：这是当前最强 Agent workflow；`next-stream-fallback` 或 demo trace 不代表远端 brain 全链路已验收

### 3. Admin 决策区主线
- 起点：`/admin`
- 关键页面：`/admin`，必要时进入 `/admin/agent`
- AI 在做什么：把 consultation 结果压缩成优先级、决策卡、派单和 explainability 线索
- 画面重点：`RiskPriorityBoard`、source badge、优先级条目、Agent 入口
- 保守口径：这是第二展示位；不代表 `T9D` / `T9C` 或远端聚合已 fully 打通

### 4. Parent 趋势线主线
- 起点：`/parent/agent?child=c-1`
- 关键页面：`/parent/agent?child=c-1`
- AI 在做什么：把 7 / 14 / 30 天趋势聚合成可解释回答，并把家长带到今晚行动与反馈闭环
- 画面重点：`trendLabel`、`source`、`dataQuality`、`warnings`、`TrendLineChart`
- 保守口径：趋势查询必须走 FastAPI brain；`demo_snapshot` 属于 backend 数据降级，不是前端伪造数据

### 5. Parent 微绘本主线
- 起点：`/parent/storybook?child=c-1`
- 关键页面：`/parent` -> `/parent/storybook?child=c-1`
- AI 在做什么：把成长亮点、会诊上下文与今晚任务整理成 3 幕睡前微绘本
- 画面重点：`StoryBookViewer`、scene 状态、image/audio 状态、provider / fallback 标识
- 保守口径：微绘本已具 wow factor 和展示链路，但图像 / 配音与上游 live 仍有 fallback 边界

## 固定录屏顺序

1. `/teacher`
2. `/teacher/high-risk-consultation`
3. `/admin`
4. `/parent`
5. `/parent/storybook?child=c-1`
6. `/parent/agent?child=c-1`

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

## 最小验证命令

```powershell
npm run lint
npm run build
$env:PYTHONPATH = "backend"
py -m pytest backend/tests/test_teacher_voice_understand.py backend/tests/test_high_risk_consultation_stream.py backend/tests/test_admin_consultation_feed.py backend/tests/test_parent_trend_service.py backend/tests/test_parent_storybook_service.py backend/tests/test_parent_storybook_endpoint.py backend/tests/test_story_image_provider.py backend/tests/test_vivo_tts_provider.py -q
```

### 2026-04-07 当前验证基线

- `npm run lint`：通过，1 个既有 warning
- `npm run build`：通过
- 定向 pytest：通过
  - 结果：`28` 项通过，`4` 项失败
  - 失败集中在 `backend/tests/test_story_image_provider.py`

## Real Chain 与 Fallback 边界

- `vivo_llm` / `vivo_asr` / storybook provider
  - 可写成“代码层接入 + smoke / test 基础已具备”
  - 不可写成 fully live / fully verified
- Teacher voice
  - 支持 best-effort fallback
  - fallback 只说明结构化草稿链路可演示
- 高风险会诊
  - 可通过 `?trace=debug` 查看 `providerTrace` 与 `memoryMeta`
  - debug case / demo trace 不等于远端真实链路验收
- Admin feed
  - `/api/ai/high-risk-consultation/feed` 不可用时，UI 会复用本地 consultation 做展示级 fallback
  - 不应扩写成远端聚合已 fully 打通
- Parent trend
  - `/api/ai/parent-trend-query` 必须走 FastAPI brain
  - Next 本地 fallback 被明确禁用
- Parent storybook
  - `/api/ai/parent-storybook` 支持 `next-json-fallback`
  - story image / audio 默认允许 mock / asset / fallback
- staging
  - 不能写成 fully healthy / fully switched
  - 当前只能保守写成“已有局部远端链路证据，仍在收口”

## 当前 Freeze 风险

- 当前仓库存在与 T13B 无关的代码问题，会影响 freeze 前最终验证：
  - `npm run lint` 仍有 1 个既有 warning：`lib/agent/teacher-agent.ts` 中 `PromptMemoryContext` 未使用
- 本线程不修复这些业务代码问题，只在文档中如实记录并保留给对应线程处理

## Freeze-Final 文档入口

- [AGENTS.md](./AGENTS.md)
- [docs/current-status-ledger.md](./docs/current-status-ledger.md)
- [docs/competition-architecture.md](./docs/competition-architecture.md)
- [docs/agent-workflows.md](./docs/agent-workflows.md)
- [docs/demo-script.md](./docs/demo-script.md)
- [docs/competition-pitch.md](./docs/competition-pitch.md)
- [docs/freeze-checklists.md](./docs/freeze-checklists.md)
- [docs/teacher-voice-smoke.md](./docs/teacher-voice-smoke.md)
- [docs/teacher-consultation-qa.md](./docs/teacher-consultation-qa.md)
- [docs/parent-trend-smoke.md](./docs/parent-trend-smoke.md)
