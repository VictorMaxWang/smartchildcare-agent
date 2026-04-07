# SmartChildcare Agent 当前状态账本

更新基准：`2026-04-07`

本文件用于给后续线程快速同步当前代码事实、比赛口径和风险边界，不用于夸大 staging 或 vivo live 状态。

## 一屏结论

- Teacher 主线已基本闭环：
  - `T2` / `T2.5` / `T4A` / `T4C` / `T5` 可按录屏主线组织
  - `T4B` 属于“代码层接入 + 有 smoke / test 基础”，不写成 live fully verified
- 当前最强展示位：高风险儿童一键会诊
- 当前第二展示位：Admin 决策区 / 风险优先级 / 会诊 trace 面板
- Parent 趋势线已具展示能力：
  - `T10` backend 已完成（代码层）
  - `T11` 展示层已完成
- Parent 微绘本已具展示能力：
  - `/parent/storybook`
  - `StoryBookViewer`
  - `parent-storybook` route / service / tests 已存在
  - 但图像 / 配音 / 上游 live 仍有 fallback 边界
- `T7A` 仍是 backend-ready，不是 UI-ready
- `T13` 当前口径应写成：进行中，焦点是 demo-script / docs / README / 主链联调检查
- staging 仍不能写成 fully healthy / fully switched

## 当前最推荐的演示顺序

1. Teacher 语音入口主线：`/teacher`
2. 高风险会诊主线：`/teacher/high-risk-consultation`
3. Admin 决策区主线：`/admin`
4. Parent 趋势线 / 微绘本主线：`/parent` -> `/parent/storybook` -> `/parent/agent`

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
| `T9` | Admin 决策卡 / 风险优先级 / trace 面板 | 已完成（展示层） | 第二展示位已成形，不扩写成 T9C 已彻底打通 |
| `T10` | Parent 趋势问答 backend | 已完成（代码层） | 支持 7 / 14 / 30 天聚合；结果质量仍受 snapshot / fallback 约束 |
| `T11` | TrendLineChart + Parent 对话界面集成 | 已完成（展示层） | 当前已具展示能力，是家长侧补强线 |
| `T12` | Parent 微绘本 wow factor | 已具展示能力 | `/parent/storybook` 与 storybook route / service / tests 已存在；可展示但未 fully live |
| `T13` | 收尾整合第一阶段 | 进行中 | 当前聚焦 demo-script / docs / README / 主链联调检查 |

## 当前最该保守写的边界

- 不要把 staging 写成 `fully healthy / fully switched`
- 不要把 `vivo_llm` / `vivo_asr` 写成 fully live
- 不要把高风险会诊现状写成完整 `T8` 全量交付
- 不要把 Admin 第二展示位扩写成 `T9C` 低层字段与远端聚合 fully 打通
- 不要把 Parent trend 写成无需 brain 的本地能力
- 不要把 Parent storybook 写成图像 / 配音上游 fully live

## 当前推荐优先级

1. 保持 Teacher 主线录屏稳定
2. 继续把高风险会诊作为最强 Agent workflow 展示位
3. 用 Admin 决策区承接会诊结果，形成第二展示位
4. 用 Parent 微绘本 + 趋势线补足 wow factor 与行动闭环
5. 把 `T13A` 的文档资产做成可交接基座
6. staging / TLS / S1.1 继续后置到有 SSH 的线程里执行

## 验证快照

### 已运行

- `npm run lint`
  - 结果：通过
  - 备注：1 个现存 warning，`lib/agent/teacher-agent.ts` 的 `PromptMemoryContext` 未使用
- `npm run build`
  - 结果：通过
- 定向 pytest
  - 结果：32 项通过
  - 覆盖：Teacher voice / 高风险会诊 / Admin consultation feed / Parent trend / Parent storybook / story image / vivo tts

### 本轮未做

- staging 远端验收
- TLS / S1.1 收口
- 真实 vivo live provider 最终验收
- T9C 低层字段联调

## staging 当前真实状态

- 可保守确认：
  - 已有局部远端链路证据
  - DNS 已解析到 `api-staging.smartchildcareagent.cn`
  - 已看到与 vivo / memory 相关的局部返回证据
- 仍未完成：
  - 域名 / TLS 最终打通
  - 新 health schema 对外可见
  - 真 SSE 验证闭环
  - release remote proxy 真验收

因此，当前所有外部口径只能写成“staging 正在收口”，不能写成 fully healthy / fully switched。

## 与并行线程的边界

- 当前不要抢 `T9C` 低层接线主战场
- 当前不要顺手改 deployment / TLS / S1.1
- 当前不要把 `T7A backend-ready` 误写成 UI-ready
- 当前不要把 `T12` 重新降回“未开始”

## 后续线程建议先读

1. `AGENTS.md`
2. `docs/current-status-ledger.md`
3. `docs/competition-architecture.md`
4. `docs/demo-script.md`
5. `docs/agent-workflows.md`
6. `docs/competition-pitch.md`
