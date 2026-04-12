# SmartChildcare Agent 当前状态账本

更新基准：`2026-04-12`

本文件是**当前阶段、稳定 walkthrough、任务状态与验证边界的主账本**。如果它与其他文档冲突，统一按下面优先级处理：

`代码事实 > current-status-ledger > competition-architecture > README / 旧任务地图 / 旧描述`

## 一屏结论

- 当前真实阶段：**5 条比赛展示路径已形成稳定演示基线，仓库正从旧 `T0-T13 / freeze 收口账本` 切换到 `T1-T31` 并行推进控制面。**
- 当前最稳定比赛主路径：`/teacher` -> `/teacher/high-risk-consultation` -> `/admin` -> `/parent` -> `/parent/storybook?child=c-1` -> `/parent/agent?child=c-1`
- 当前第一展示位：高风险会诊
- 当前第二展示位：Admin 决策区 / 风险优先级 / 会诊 trace 面板
- T19 当前事实：Admin 第二展示位已优先展示结构化 `evidenceItems` 证据链，Teacher trace stage 仅补最小证据预览；兼容摘要 fallback 仍保留，walkthrough / 录屏仍待补
- Parent storybook：已具展示能力，不再允许写回“未开始”
- Parent trend：已具展示能力，但仍必须保留 `source`、`dataQuality`、`warnings`
- 前后端 36 人 demo 基线：代码已落地，但仍缺统一 walkthrough / 录屏再验
- T7 health-file-bridge：`/teacher/health-file-bridge`、`/api/ai/health-file-bridge` 与 backend schema/service skeleton 已落地；OCR / writeback / live escalation 仍未验证
- T24/T25 Teacher Copilot：backend contract 与 `/teacher/agent` UI 已合入；仍缺人工 walkthrough
- T26/T27 Weekly Report V2：Teacher / Admin / Parent 三角色都已接到同源 `/api/ai/weekly-report`；`/teacher/agent`、`/admin`、`/parent` 均新增轻量周报预览入口，其中 Admin 首页预览与 `/admin/agent?action=weekly-report` 完整工作区分工明确；当前状态仍是 `Done-code-only`，未写成 fully live 或 Demo-ready
- T11 Care Mode：`/parent` 与 `/parent/agent` 已新增 `普通模式 / 关怀模式` 前端切换层，状态优先级为 `?care=1|0 > localStorage > false`；关怀模式首屏已收敛为大字摘要、最短主按钮与最小反馈入口，复杂次级信息后置到“更多内容”，当前状态为 `Done-code-only`
- T12 Parent Voice Phase 1：`/parent` 与 `/parent/agent` 已补 browser-first 一键播报与最小语音反馈入口；当前口径只能写成 `Done-code-only (Phase 1 browser-first)`，不能写成真实后端 TTS / ASR 已接通
- T28 Admin 质量驾驶舱 metrics engine：backend-only 聚合链路已落地，`POST /api/v1/agents/metrics/admin-quality` 可稳定输出 8 个 named metrics 与 `source / fallback / confidence / coverage`
- T29 Admin 质量驾驶舱 UI：`/admin` 已新增第二层治理区，位于风险优先级与 TOP 3 之后、风险儿童/班级区之前；仍需完整 walkthrough / 录屏再验
- staging 与 vivo provider：仍必须保守表达，不写成 `fully healthy`、`fully switched` 或 `fully live`

## 最稳定 Walkthrough

1. `/teacher`
2. `/teacher/high-risk-consultation`
3. `/admin`
4. `/parent`
5. `/parent/storybook?child=c-1`
6. `/parent/agent?child=c-1`

如果 README、demo script、QA checklist 与本顺序冲突，以本账本为准并同步修正。

## 状态标签

并行任务控制面统一使用以下状态：

- `Planned`
  - 已登记，尚未开始
- `In Progress`
  - 已有线程实际推进
- `Done-code-only`
  - 代码或数据单侧已落地，但还未完成跨层对齐或演示级验证
- `Demo-ready`
  - 已完成必要 walkthrough / 录屏 / 真机再验，可进入稳定展示面
- `Done`
  - 已完成并完成所需文档回写

## Parallel Program Overview

### 当前收口阶段

- 当前主任务不是继续写旧 `T0-T13`，而是把仓库升级为能支持 `T1-T31` 多线程推进的控制平面
- 当前主分支已回到 `code-ready`，可继续推进 `T1-T31` 的功能线程；docs 与功能实现都按 shared contract 收口
- 旧 freeze 任务仍保留历史价值，但不再充当当前主任务表

### Wave A｜快收口 / 低风险高收益

- 任务：`T1`、`T2`、`T3`、`T4`、`T5`、`T6`
- 特征：以演示密度、数据基线、可信度修复、trace 可读性收口为主
- 当前最重要事实：`T2/T3` 前后端 36 人 demo 基线已落地；`T4` 的 seed matrix / QA 文档也已合入，但仍缺统一 walkthrough / child QA / 录屏再验

### Wave B｜新增亮点第一批

- 任务：`T7`、`T8`、`T9`、`T10`、`T11`、`T12`、`T13`、`T14`
- 特征：新增亮点与产品感延长线
- 主增量：外部健康文件桥接、关怀模式、统一意图入口

### Wave C｜闭环与治理增强

- 任务：`T15`、`T16`、`T17`、`T18`、`T19`、`T20`、`T21`
- 特征：让反馈、证据链、任务闭环、升级规则真正形成可追踪环

### Wave D｜纵深化与比赛加分层

- 任务：`T22`、`T23`、`T24`、`T25`、`T26`、`T27`、`T28`、`T29`、`T30`、`T31`
- 特征：年龄分层、Teacher Copilot、行动化周报、质量治理、需求洞察、信任透明

## Wave 依赖与并行原则

| Wave | 任务范围 | 依赖关系 | 并行性 |
| --- | --- | --- | --- |
| `A` | `T1-T6` | `T4` 依赖 `T2/T3`；`T6` 依赖 `T5` | `T1`、`T5` 强并行；`T2/T3` 可并行 |
| `B` | `T7-T14` | `T7 -> T8 -> T9 -> T10`；`T11 -> T12`；`T13 -> T14` | 链间可并行，链内顺序推进 |
| `C` | `T15-T21` | `T15 -> T16 -> T17`；`T18 -> T19`；`T20 -> T21` | 链间可并行，链内顺序推进 |
| `D` | `T22-T31` | `T22 -> T23`；`T24 -> T25`；`T26 -> T27`；`T28 -> T29`；`T31` 放在 `T18/T19` 与 `T30` 接口稳定后 | 多链并行，按共享 contract 收口 |

并行推进时遵守：

- 同一条依赖链不要倒序推进
- 一个任务只要变更状态、依赖、并行性，就必须回写 `docs/task-registry.md`
- 一个任务只要改变当前阶段、稳定 walkthrough、主展示位、验证边界，就必须回写本账本
- 一个任务只要改变 lane 映射或 shared contract，就必须回写 `docs/competition-architecture.md`
- docs-only 任务不改业务代码；在 `T1-T31` 里，`T4` 是明确的 docs-only 任务

## T1-T31 精简表

回写缩写说明：

- `TR` = `docs/task-registry.md`
- `L` = `docs/current-status-ledger.md`
- `A` = `docs/competition-architecture.md`
- `G` = `AGENTS.md`

详细字段、问题定义、建议触达模块、推荐 subagents 与验收标准，统一以 `docs/task-registry.md` 为准。

| ID | 任务名 | 当前状态 | Lane | 前置依赖 | 并行 | 再验 | 回写 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `T1` | 桌面端会诊 Trace 摘要重排 | `Done-code-only` | 收口与体验修复 | - | 高 | 桌面 walkthrough / 录屏 | `TR+L+A` |
| `T2` | 前端 36 人 demo 数据扩充 | `Done-code-only` | Demo 数据与演示准备 | - | 中高 | walkthrough / 录屏 | `TR+L` |
| `T3` | 后端 demo snapshot 扩充到 36 人 | `Done-code-only` | Demo 数据与演示准备 | - | 中 | 接口 smoke / walkthrough | `TR+L` |
| `T4` | 36 人 demo seed 矩阵与 QA 文档 | `Done-code-only` | Demo 数据与演示准备 | `T2`、`T3` | 中 | 录屏 child QA | `TR+L` |
| `T5` | 饮水量字段全链路审计 | `Done-code-only` | 收口与体验修复 | - | 高 | 否 | `TR+L+A` |
| `T6` | 饮水量展示降级 / 状态化表达 | `Done-code-only` | 收口与体验修复 | `T5` | 中 | walkthrough / 录屏 | `TR+L+A` |
| `T7` | 外部健康文件桥接：上传入口 + schema 骨架 | `Done-code-only` | 外部健康文件桥接 | - | 中 | walkthrough | `TR+A` |
| `T8` | 外部健康文件桥接：OCR / 多模态抽取 | `Planned` | 外部健康文件桥接 | `T7` | 中 | 样例文件 walkthrough | `TR+A` |
| `T9` | 外部健康文件桥接：专业信息 -> 托育动作映射 | `Planned` | 外部健康文件桥接 | `T8` | 中 | walkthrough / trace 检查 | `TR+A` |
| `T10` | 外部健康文件桥接：写回主系统闭环 | `Planned` | 外部健康文件桥接 | `T7`、`T8`、`T9` | 低中 | walkthrough / 录屏 | `TR+L+A` |
| `T11` | 关怀模式 / 祖辈模式：大字卡片 + 简化交互 | `Done-code-only` | 关怀模式 / 祖辈模式 | - | 高 | walkthrough / 录屏 | `TR+A` |
| `T12` | 关怀模式：一键播报 + 一键语音反馈 | `Done-code-only (Phase 1 browser-first)` | 关怀模式 / 祖辈模式 | `T11` | 中 | 真机 / 录屏 | `TR+A` |
| `T13` | 统一意图入口：后端路由器 | `Planned` | 统一意图入口 | - | 高 | contract smoke | `TR+A` |
| `T14` | 统一意图入口：前端超级入口 + deeplink 卡 | `Done-code-only` | 统一意图入口 | `T13` | 中 | walkthrough / 录屏 | `TR+L+A` |
| `T15` | 家长反馈结构化回流：schema / store / normalize | `Done-code-only` | 家长反馈闭环 | - | 中 | schema / store smoke | `TR+A` |
| `T16` | Parent 结构化反馈填写器 | `Done-code-only` | 家长反馈闭环 | `T15` | 中 | walkthrough / 真机 | `TR+A` |
| `T17` | 家长反馈写回 memory / trend / weekly report / consultation | `Done-code-only` | 家长反馈闭环 | `T15`、`T16` | 中 | walkthrough / trace 检查 | `TR+L+A` |
| `T18` | 会诊证据链 contract | `Done-code-only` | 会诊可解释性增强 | - | 中 | contract smoke | `TR+A` |
| `T19` | 会诊证据链 UI | `Done-code-only` | 会诊可解释性增强 | `T18` | 中 | walkthrough / 录屏 | `TR+L+A` |
| `T20` | 48 小时干预任务实体与生命周期 | `Planned` | 干预执行与升级 | - | 中 | workflow smoke | `TR+A` |
| `T21` | 自动升级规则 | `Planned` | 干预执行与升级 | `T20` | 中 | walkthrough / trace 检查 | `TR+L+A` |
| `T22` | 年龄分层照护引擎：共享策略层 | `Done (shared policy + Trend/Parent Weekly)` | 年龄分层照护 | - | 中 | contract smoke | `TR+A` |
| `T23` | 年龄分层照护引擎接入主链路 | `Done-code-only (Phase 1)` | 年龄分层照护 | `T22` | 中 | walkthrough / 录屏 | `TR+L+A` |
| `T24` | Teacher Copilot：backend 能力包 | `Done-code-only` | Teacher Copilot | - | 中 | service smoke | `TR+A` |
| `T25` | Teacher Copilot：UI 接入 | `Done-code-only` | Teacher Copilot | `T24` | 中 | walkthrough / 录屏 | `TR+L+A` |
| `T26` | Weekly Report V2：三版本行动化 schema / generator | `Done-code-only` | Actionized Weekly Report | - | 中 | generator smoke | `TR+A` |
| `T27` | Weekly Report V2：前端接入 | `Done-code-only` | Actionized Weekly Report | `T26` | 中 | walkthrough / 录屏 | `TR+L+A` |
| `T28` | Admin 质量驾驶舱：metrics engine | `Done-code-only` | Admin 质量治理 | - | 中 | aggregation smoke | `TR+A` |
| `T29` | Admin 质量驾驶舱：UI | `Done-code-only` | Admin 质量治理 | `T28` | 中 | walkthrough / 录屏 | `TR+L+A` |
| `T30` | 需求洞察引擎 | `Done-code-only` | 需求洞察与信任透明 | - | 中 | aggregation smoke / walkthrough | `TR+A` |
| `T31` | 信任透明层 | `Planned` | 需求洞察与信任透明 | `T18`、`T19`、`T30` | 中低 | walkthrough / 录屏 | `TR+L+A` |

## 当前验证边界

这些边界继续视为强约束：

- 不要把 staging 写成 `fully healthy` / `fully switched`
- 不要把 `vivo_llm`、`vivo_asr`、`vivo_tts`、`story image` 写成 fully live
- 不要把高风险会诊现状写成完整 `T8` 全量交付
- 不要把 Admin 第二展示位扩写成 `T9D` / `T9C` 主战场已完成
- 不要把 Parent trend 写成无需 FastAPI brain 的本地完整能力
- 不要把 Parent storybook 写成图像 / 配音上游 fully live

## 当前已确认的代码事实

- 角色页真实存在：`/teacher`、`/teacher/agent`、`/teacher/health-file-bridge`、`/teacher/high-risk-consultation`、`/admin`、`/parent`、`/parent/storybook`、`/parent/agent`
- Teacher voice、health-file-bridge、consultation、Admin feed、Parent trend、Parent storybook、follow-up、weekly-report 等 route 已存在
- 高风险会诊结果、Admin consultation feed、consultation trace view model 已共同消费结构化 `evidenceItems`；Admin `ConsultationTraceCard` 已优先展示结构化 evidence chain，Teacher `TraceStepCard` 已补最小结构化证据预览；旧 `keyFindings` / `explainability` / `providerTrace` / `memoryMeta` / `evidenceHighlights` / stage legacy evidence 仍保留兼容
- Teacher Copilot UI 已接到 `/teacher/agent` 的草稿确认区与结果卡；`/teacher` 继续保持轻入口，不新增第二套 Teacher 页面
- Parent storybook 页面、route、service、viewer、tests 已存在，当前已具展示能力
- `GuardianFeedback`、`InterventionCard`、`ReminderItem`、`TaskCheckInRecord` 等 shared contract 锚点已存在
- 前端 `lib/store.tsx` 与后端 `build_demo_snapshot()` 都已落到 36 人 demo 基线；统一 walkthrough / child QA / 录屏再验仍待补齐
- `T19` 已把 Admin `ConsultationTraceCard` 接到结构化 `evidenceItems` 证据链 UI，并在 Teacher `TraceStepCard` 补了最小结构化证据预览；旧 `evidenceHighlights` / `explainability` / stage legacy evidence 仍保留为兼容 fallback
- `T7` 已落地 `/teacher/health-file-bridge` 页面、`/api/ai/health-file-bridge` 桥接与 backend `health_file_bridge` schema/service skeleton；当前仍是 skeleton，不宣称 OCR / writeback / escalation 已闭环
- `T6` 已把主视角补水表达收敛到状态化文案；底层 hydration 数据仍保留给趋势、聚合与风险判断链路
- `T26` 已把 weekly report shared contract 扩到 `schemaVersion / role / sections / primaryAction`，并保持旧 `summary / highlights / risks / nextWeekActions / trendPrediction` 字段兼容；`T27` 已把 Teacher / Admin / Parent 轻量预览分别接到 `/teacher/agent`、`/admin`、`/parent`，显式展示 `role / source / periodLabel / disclaimer`，并保留 `/admin/agent?action=weekly-report` 作为完整工作区；当前仍缺完整 walkthrough / 录屏复验，不升 `Demo-ready`
- `T28` 已落地 `backend/app/schemas/admin_quality_metrics.py`、`backend/app/services/admin_quality_metrics_engine.py`、`backend/app/services/orchestrator.py` 与 `POST /api/v1/agents/metrics/admin-quality`；当前输出 8 个 named metrics，并携带 `window / sourceSummary / source / fallback / warnings`
- `T29` 已在 `/admin` 主列挂入独立质量驾驶舱区块，通过 `app/api/ai/admin-quality-metrics/route.ts` 薄代理与 `components/admin/AdminQualityMetricsPanel.tsx` 展示 8 个指标；UI 显式保留 `source / fallback / confidence / coverage`，不把 demo/proxy 指标包装成真实机构经营结论
- `T30` 已落地 `backend/app/services/demand_insight_engine.py`、`backend/app/schemas/demand_insight.py` 与 `/api/v1/agents/insights/demand`；当前稳定输出 `topConcernTopics`、`consultationTriggerHeat`、`actionDifficultyTopics`、`weakFeedbackSegments`、`recurringIssueClusters`，并附带 `window / sourceSummary / dataQuality / source / fallback / warnings`
- `T30` 当前主数据链路来自 `backend/app/db/childcare_repository.py` 的 `children / feedback / growth / health / meals / taskCheckIns / interventionCards / reminders`，叠加 memory snapshots 里的 `consultation-result`；`weekly-report-result` 与 `parent-follow-up-result` 仅作为辅助来源统计或弱信号，不宣称真实机构运营洞察
- `T23` Phase 1 已把 shared `ageBandContext` 真正接进 `lib/agent/intervention-card.ts`、`lib/agent/parent-agent.ts`、`lib/agent/teacher-agent.ts` 三条主链，Parent / Teacher / Intervention 的建议重点、今晚动作、明天观察点与 48h 复盘开始体现 `0-12m`、`12-24m`、`24-36m` 的真实差异。
- `T23` 本轮仍是 logic-first / code-only 收口：`app/parent/page.tsx`、`app/parent/agent/page.tsx`、`app/parent/storybook/page.tsx`、Admin / Teacher 首页布局、Storybook 页面 walkthrough 均未纳入本阶段，不应表述为年龄分层 UI 已全面完成。

- 本轮 post-merge integration sweep 与 `T19` 的本地静态与定向测试已通过：`npm run lint`、`npm run build`、`npx --yes tsx --test lib/consultation/evidence-display.test.ts lib/consultation/normalize-result.test.ts lib/consultation/trace-view-model.test.ts lib/agent/admin-consultation-feed.test.ts lib/agent/health-file-bridge.test.ts`、`npx --yes tsx --test lib/teacher-copilot/normalize.test.ts`、`py -m pytest backend/tests/test_teacher_voice_understand.py backend/tests/test_health_file_bridge_service.py backend/tests/test_health_file_bridge_endpoint.py backend/tests/test_admin_consultation_feed.py backend/tests/test_high_risk_consultation_stream.py backend/tests/test_agents_mock.py backend/tests/test_parent_trend_service.py backend/tests/test_childcare_repository.py -q`；`/teacher/high-risk-consultation`、`/admin`、`/admin/agent`、`/teacher/agent`、`/teacher/health-file-bridge`、`/parent/agent` 的页面级 HTTP / 浏览器 walkthrough 仍未计为已通过
- 本轮 `T30` backend aggregation smoke 已通过：`py -m pytest backend/tests/test_demand_insight_engine.py backend/tests/test_admin_consultation_feed.py backend/tests/test_childcare_repository.py backend/tests/test_orchestrator_memory.py backend/tests/test_parent_trend_service.py backend/tests/test_high_risk_consultation_stream.py -q`；`/api/v1/agents/insights/demand` 的 API smoke 已纳入 `backend/tests/test_demand_insight_engine.py`，但 Admin / T31 页面级消费 walkthrough 仍未计为已通过

## 历史 Freeze 构建记录（附录，不是当前主任务表）

下面这些编号只保留历史背景价值，不再作为当前并行主表：

| 历史项 | 当前地位 | 使用方式 |
| --- | --- | --- |
| `T0-T13` | freeze 构建阶段历史记录 | 只用于回看系统是如何形成当前 5 条主路径 |
| `T7A` | 反馈闭环与家长消息反思的历史锚点 | 只能当 `T15-T17` 的既有基础，不当当前主任务 |
| `T13B` | docs / demo-script / checklist 收尾历史项 | 只解释本轮控制面重构起点 |
| `S1.1` | staging 运维收口项 | 不属于 `T1-T31`；交给 staging / ops 线程 |

后续线程启动时，请先读：

1. `docs/current-status-ledger.md`
2. `docs/competition-architecture.md`
3. `docs/task-registry.md`
4. `AGENTS.md`
