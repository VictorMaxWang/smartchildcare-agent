# SmartChildcare Agent 当前状态账本

更新基准：`2026-04-07`

本文件用于给后续线程快速同步当前代码事实、比赛口径、fallback 边界与 freeze 前剩余人工事项，不用于夸大 staging 或 vivo live 状态。

## 一屏结论

- Teacher 主线已基本闭环，可按录屏主线组织：
  - `T2` / `T2.5` / `T4A` / `T4C` / `T5`
  - `T4B` 仍只写“代码层接入 + smoke / test 基础”
- 当前第一展示位：高风险儿童一键会诊
- 当前第二展示位：Admin 决策区 / 风险优先级 / 会诊 trace 面板
- Parent 趋势线已具展示能力：
  - `T10` backend 已完成（代码层）
  - `T11` 展示层已完成
- Parent 微绘本已具展示能力：
  - `/parent/storybook`
  - `StoryBookViewer`
  - `parent-storybook` route / service / tests 已存在
  - 图像 / 配音 / 上游 live 仍有 fallback 边界
- `T7A` 仍是 backend-ready，不是 UI-ready
- `T13B` 当前目标是最终 freeze 前 docs / demo-script / checklist / README 收口
- staging 仍不能写成 `fully healthy / fully switched`

## 最终推荐演示顺序

1. Teacher 语音主线：`/teacher`
2. 高风险会诊主线：`/teacher/high-risk-consultation`
3. Admin 决策区主线：`/admin`
4. Parent 首页：`/parent`
5. Parent 微绘本主线：`/parent/storybook?child=c-1`
6. Parent 趋势线主线：`/parent/agent?child=c-1`

## 状态标签含义

- `已完成`：主目标已在仓库中落地，可作为当前阶段既有事实
- `已完成（代码层）`：代码与测试 / smoke 已具基础，但不等于 staging / live 已最终验收
- `已完成（展示层）`：页面与交互已可演示，但远端 / 上游链路仍需保守表述
- `已具展示能力`：页面、服务链路和文档事实已足以录屏，但尚未到 fully live
- `部分具备基础`：已有强基础或金链路，不等于该任务全量完成
- `进行中`：作为当前阶段收口工作持续推进

## T0-T13 任务地图

| ID | 核心目标 | 当前状态 | 当前口径 |
| --- | --- | --- | --- |
| `T0` | 文档底座与长期协作规则 | 已完成 | `AGENTS.md` 与比赛架构文档已建立 |
| `T1` | SSE / 结构化事件 / 流式 UI 基础 | 已完成 | consultation stream 与 agent stream 已可演示 |
| `T2` | Teacher 语音入口 UI 壳 | 已完成 | 全局语音入口已落地 |
| `T2.5` | Teacher 真机 / 浏览器硬化 | 已完成 | 已有手工 smoke 口径，不等于 live upstream fully verified |
| `T3` | 记忆层 schema / snapshot / trace 基础 | 已完成 | memory hub 与 repository 已落地 |
| `T3.5` | 记忆层接入主工作流 | 进行中 | consultation / follow-up / weekly report 已开始消费 memory context |
| `T4A` | teacher voice understanding 抽象 / Router / Prompt Chaining | 已完成 | backend 理解链已落地 |
| `T4B` | vivo ASR transport 接入 | 已完成（代码层） | 有真实 transport + tests；live upstream 仍未 fully verified |
| `T4C` | Teacher 上传结果接到 understanding response | 已完成 | 可产出结构化 seed / warnings / nextAction |
| `T5A` | Teacher 草稿确认流过渡阶段 | 已完成 | 作为过渡阶段已完成其作用 |
| `T5` | `draft -> confirm -> persist` 主接线 | 已完成 | Teacher 主线可录屏，但仍不写成 fully verified |
| `T6` | Tool layer + ReAct runner + trace | 已完成 | 后端 agent 基础设施已具演示能力 |
| `T7` | Evaluator-Optimizer / Reflexion 总体能力 | 部分具备基础 | 不写成完整闭环已完成 |
| `T7A` | Parent message reflexion backend-first | 已完成（代码层） | backend-ready，不是 UI-ready |
| `T8` | 高风险会诊 Multi-Agent backend | 部分具备基础 | 主链已强可演示，但不等于完整 T8 fully done |
| `T9` | Admin 决策卡 / 风险优先级 / trace 面板 | 已完成（展示层） | 第二展示位已成形，不扩写成 `T9D` / `T9C` 已彻底打通 |
| `T10` | Parent 趋势问答 backend | 已完成（代码层） | 支持 7 / 14 / 30 天聚合；结果质量仍受 snapshot / fallback 约束 |
| `T11` | TrendLineChart + Parent 对话界面集成 | 已完成（展示层） | 当前已具展示能力，是家长侧补强线 |
| `T12` | Parent 微绘本 wow factor | 已具展示能力 | `/parent/storybook` 与 storybook route / service / tests 已存在；可展示但未 fully live |
| `T13B` | 最终 freeze 前收尾整合 | 进行中 | 当前聚焦 docs / demo-script / checklist / README 收口与保守口径统一 |

## 真实 live / fallback / 赛前人工再验

| 链路 | 当前可确认的真实状态 | fallback / degraded | 赛前最好人工再验 |
| --- | --- | --- | --- |
| Teacher voice | 语音入口、上传、understanding、草稿保存链路已具演示能力 | `next-json-fallback` / ASR best-effort fallback | 真录音授权、结果弹层、草稿保存、fallback badge |
| 高风险会诊 | consultation 页面、SSE、trace 面板、结果卡已具强展示能力 | `next-stream-fallback`、demo trace、fixture | 3 个 stage 顺序、`providerTrace`、`memoryMeta`、`fastapi-brain` 与 fallback 区分 |
| Admin feed | 决策区、优先级条目、Agent 承接已具展示能力 | feed unavailable 时使用展示层 local fallback | source badge、优先级条目、`/admin/agent` 承接 |
| Parent trend | FastAPI brain 路径、趋势卡、图表、`source` / `dataQuality` / `warnings` 已有真实代码落点 | backend `demo_snapshot` 数据降级；Next 本地 fallback 禁用 | 趋势快问、结果卡字段、图表状态、反馈入口 |
| Parent storybook | page、route、service、viewer、media provider 已具展示能力 | `next-json-fallback`、rule / asset / mock / media fallback | 3 幕切换、image/audio 状态、provider / fallback 标识 |
| vivo provider | LLM / ASR / storybook provider 已有代码层接入与 tests/smoke 基础 | mock / fallback 仍是产品级安全网 | 不要口头扩写成 fully live |
| staging | 已有局部远端链路证据 | 仍处最终收口阶段 | 不在本线程；需其他线程用 SSH / TLS / remote proxy 再验 |

## 当前最该保守写的边界

- 不要把 staging 写成 `fully healthy / fully switched`
- 不要把 `vivo_llm` / `vivo_asr` / `vivo_tts` / story image 写成 fully live
- 不要把高风险会诊现状写成完整 `T8` 全量交付
- 不要把 Admin 第二展示位扩写成 `T9D` / `T9C` 主战场已完成
- 不要把 Parent trend 写成无需 brain 的本地能力
- 不要把 Parent storybook 写成图像 / 配音上游 fully live

## 当前推荐优先级

1. 保持 Teacher 主线录屏稳定
2. 继续把高风险会诊作为最强 Agent workflow 展示位
3. 用 Admin 决策区承接会诊结果，形成第二展示位
4. 用 Parent 微绘本 + 趋势线补足 wow factor 与行动闭环
5. 把 T13B 的 docs / demo-script / checklist 做成可交接基座
6. 把 staging / TLS / S1.1 留给有 SSH 的线程继续执行

## 验证快照

### 本轮已确认

- `npm run lint`
  - 结果：通过
  - 备注：1 个既有 warning，`lib/agent/teacher-agent.ts` 的 `PromptMemoryContext` 未使用
- `npm run build`
  - 当前状态：通过
  - 备注：`parent-storybook/media` 路由冲突已收敛为单一路由；当前构建可完成
- 定向 pytest
  - 当前状态：`28` 项通过，`4` 项失败
  - 失败集中在 `backend/tests/test_story_image_provider.py`
  - 覆盖：Teacher voice / 高风险会诊 / Admin consultation feed / Parent trend / Parent storybook / story image / vivo tts

### 本轮不做

- staging 远端验收
- TLS / S1.1 收口
- 真实 vivo live provider 最终验收
- `T9D` / `T12C` 主战场联调

## Freeze 前还剩下的几件事

1. 完成本轮 README / docs / demo-script / checklist 收口
2. 补一轮 auth / cookie smoke，并用最新 demo checklist 走一次 Parent storybook 全流程
3. 将 `story_image_provider` 的 4 个失败测试交给对应线程处理
4. 在上述问题修复后顺序复跑 `npm run build`
5. 按固定顺序做一次浏览器 walkthrough
6. 按 `docs/freeze-checklists.md` 做一次录屏前检查
7. 将 staging / TLS / SSH / 真实上游最终验收交给对应线程

## 与并行线程的边界

- 当前不要抢 `T9D` / `T9C` 低层接线主战场
- 当前不要顺手改 deployment / TLS / S1.1
- 当前不要把 `T7A backend-ready` 误写成 UI-ready
- 当前不要把 `T12` 重新降回“未开始”

## 后续线程建议先读

1. `AGENTS.md`
2. `docs/current-status-ledger.md`
3. `docs/competition-architecture.md`
4. `docs/agent-workflows.md`
5. `docs/demo-script.md`
6. `docs/competition-pitch.md`
7. `docs/freeze-checklists.md`
