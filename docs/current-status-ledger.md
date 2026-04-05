# SmartChildcare Agent 当前状态账本

更新基准：`2026-04-05`

本文件的目标不是重复比赛叙事，而是让新的 Codex 线程在开始之前先读懂：
- `T0` 到 `T13` 的完整任务体系
- 哪些任务已完成，哪些只是代码层完成
- 哪些任务正在跑，哪些不要误重排
- 当前最优先主线是什么
- staging 当前真实状态到哪一步

## 1. 项目定位
项目名：`SmartChildcare Agent（智慧托育 AI 智能体系统）`
当前默认协作仓库：`VictorMaxWang/smartchildcare-agent`

请始终把它理解成：
- 不是普通托育管理后台。
- 而是一个移动端优先的托育 AI 助手 / Multi-Agent 产品。
- 面向托育机构、教师、家长、园长 / 管理员的多角色系统。
- 核心闭环是 `机构记录 -> 系统分析 -> AI 建议 / Agent 工作流 -> 家长反馈 -> 托育行动闭环`。
- 当前最优先比赛是“中国高校计算机大赛 - AIGC 创新赛（vivo 赞助）”。

所有文档口径都必须优先服务：
- 移动端优先
- AI 助手感
- Agent 化
- 工作流清晰
- 适合 vivo 场景和比赛叙事
- 适合录屏和答辩

## 2. 新线程建议阅读顺序
新线程默认先读：
1. `AGENTS.md`
2. `docs/current-status-ledger.md`
3. `docs/competition-architecture.md`
4. `docs/teacher-consultation-qa.md`
5. `docs/deployment-vps.md`
6. `docs/vps-smoke.md`

如果继续 Teacher 语音主线，额外优先读：
- `app/teacher/layout.tsx`
- `components/teacher/TeacherVoiceAssistantLayer.tsx`
- `components/teacher/VoiceAssistantFAB.tsx`
- `app/api/ai/teacher-voice-upload/route.ts`
- `app/api/ai/teacher-voice-understand/route.ts`
- `backend/app/services/teacher_voice_understand.py`
- `lib/mobile/voice-input.ts`

如果继续高风险会诊主线，额外优先读：
- `app/teacher/high-risk-consultation/page.tsx`
- `app/api/ai/high-risk-consultation/stream/route.ts`
- `components/consultation/*`
- `backend/tests/test_high_risk_consultation_stream.py`

## 3. 一屏结论
- Teacher 主线：`T2` 已完成，`T2.5` 已完成一轮真机 / 浏览器硬化，`T4A` 已完成，`T4B` 已完成（代码层，live upstream 仍未 fully verified），`T4C` 已完成，`T5A` 已作为过渡阶段完成其作用，`T5` 已完成主接线；当前已基本闭环，进入录屏 / 验收阶段
- 当前最强展示位：高风险儿童一键会诊
- 当前第二强展示位：Admin 决策区 / 风险优先级 / 会诊 trace 面板
- Parent 趋势问答 / TrendLineChart：`T10` backend 已完成（代码层），`T11` 展示层接入已完成，当前定位为家长侧补强展示线，不是当前第一主线
- `T7A`：已完成 backend-first 版本，当前为 backend-ready；不是 UI-ready；前端最小接入仍未完成
- 当前阶段关注项：Teacher 录屏 / 验收收口、高风险会诊展示、Admin 第二展示位稳态、Parent 补强线维护、`T7A` 前端最小接入待排期
- `S1.1` 尚未完成，需拿到 staging SSH 后手动执行
- 不要把 `T2`、`T4A`、`T4B`、`T6` 误写成未开始
- 不要把 staging 误写成 fully healthy / fully switched，或已完成对外验收

## 4. 状态标签含义
- `已完成`：主目标已经在仓库里落地，可作为当前阶段既有事实。
- `已完成（代码层）`：代码与测试 / smoke 已具基础，但不等于 staging / live 已最终验收。
- `进行中`：已经有入口、骨架或部分接线，但主链还没有闭环。
- `部分具备基础`：已有强基础或金链路，但不能等价成该任务全量完成。
- `未开始`：当前不应写成已实现，也不应误重排到最前。

## 5. 跨切任务与部署状态
| 任务 | 目标 | 当前状态 | 当前口径 | 关键证据 |
| --- | --- | --- | --- | --- |
| `P0` | vivo LLM 真接口接入 + 最小验证 | 已完成（代码层） | 代码层完成，不等于 staging 真切到 live provider | `backend/app/providers/vivo_llm.py`、`backend/tests/test_vivo_llm_provider.py`、`scripts/vivo_llm_smoke.py` |
| `S0` | strict observability、域名 / runbook / smoke 收口 | 已完成 | 代码侧与文档侧收口完成 | `docs/deployment-vps.md`、`docs/vps-smoke.md`、`scripts/release-check.mjs` |
| `S1` | 无 SSH 情况下的定位 / 修复命令 / 验收标准固化 | 已完成（文档 / runbook） | 远端重建与修复尚未真正执行 | `docs/deployment-vps.md`、`docs/teacher-consultation-qa.md` |
| `S1.1` | 拿到 SSH 后执行 backend 重建、Caddy reload / TLS 修复、release remote proxy 真验收 | 未开始 | 等待 staging SSH | `docs/deployment-vps.md`、`docs/vps-smoke.md` |
| `D2` | 项目状态账本增强 | 已完成 | 当前文档任务，只更新长期上下文，不改业务代码 | `AGENTS.md`、`docs/competition-architecture.md`、`docs/current-status-ledger.md` |

## 6. T0-T13 全量任务地图
| ID | 核心目标 | 当前状态 | 当前口径 | 关键证据 |
| --- | --- | --- | --- | --- |
| `T0` | 创建 `AGENTS.md` 和 `docs/competition-architecture.md`，固化比赛背景、架构原则、vivo 接入规则、Agent 设计原则 | 已完成 | 文档底座已建立 | `AGENTS.md`、`docs/competition-architecture.md` |
| `T1` | SSE 协议 + Generative UI 组件注册表 + 最小 demo | 已完成 | SSE、结构化事件与动态卡片基础已具备 | `app/api/ai/stream/route.ts`、`lib/bridge/use-agent-stream.ts`、`app/api/ai/high-risk-consultation/stream/route.ts` |
| `T2` | Teacher 端 `VoiceAssistantFAB` 语音球 UI 壳 | 已完成 | 录音、上传、结果弹层、草稿入口已落地 | `app/teacher/layout.tsx`、`components/teacher/TeacherVoiceAssistantLayer.tsx`、`components/teacher/VoiceAssistantFAB.tsx` |
| `T2.5` | Teacher 语音入口真机 / 浏览器硬化 | 已完成 | 已完成一轮 Android Chrome / iOS Safari 手工 smoke 与手势 / 权限 / fallback 硬化口径沉淀 | `docs/teacher-voice-smoke.md`、`components/teacher/TeacherVoiceAssistantLayer.tsx`、`components/teacher/VoiceAssistantFAB.tsx` |
| `T3` | MySQL 记忆层 schema + JSON Profile Memory + Trace 表 | 已完成 | `child_profile_memory`、snapshots、trace、repository / data access 基础已到位 | `backend/app/db/memory_store.py`、`backend/app/services/memory_service.py`、`backend/tests/test_memory_hub_repository.py` |
| `T3.5` | 记忆层正式接入主工作流 | 进行中 | consultation / follow-up / weekly report 已开始消费 memory context，但不是 fully unified memory platform | `backend/app/services/orchestrator.py`、`backend/app/services/memory_service.py` |
| `T4A` | ASR abstraction + Router Agent + Prompt Chaining + response schema | 已完成 | backend 理解链已落地 | `backend/app/services/teacher_voice_understand.py`、`backend/app/services/teacher_voice_router.py`、`backend/app/services/teacher_voice_prompt_chain.py`、`backend/tests/test_teacher_voice_understand.py` |
| `T4B` | 真实 vivo ASR transport 接入 | 已完成（代码层） | `vivo_asr` 已具备真实 transport + fallback provider 实现，但 live upstream 未 fully verified | `backend/app/providers/vivo_asr.py`、`backend/tests/test_vivo_asr_provider.py` |
| `T4C` | 把 `T2` 的上传结果接到 `T4` 的 understanding response | 已完成 | 上传结果已接到 understanding response，并可产出结构化 seed / warnings / nextAction；live upstream 仍按 `T4B` 口径保守表述 | `app/api/ai/teacher-voice-understand/route.ts`、`lib/mobile/teacher-voice-understand.ts`、`components/teacher/TeacherVoiceAssistantLayer.tsx` |
| `T5A` | Teacher 草稿确认流组件壳 + persist 过渡阶段 | 已完成 | 已作为过渡阶段完成其作用，不再作为当前主开发目标单列推进 | `components/teacher/TeacherDraftConfirmationPanel.tsx`、`lib/mobile/teacher-draft-records.ts`、`app/teacher/agent/page.tsx` |
| `T5` | `draft -> confirm -> persist` 主接线版 | 已完成 | Teacher Agent 页已接入确认面板、persist adapter 与 source draft state；完整录屏级 / 远端级验收仍待继续，不写成 fully verified | `app/teacher/agent/page.tsx`、`components/teacher/TeacherDraftConfirmationPanel.tsx`、`lib/mobile/teacher-draft-records.ts` |
| `T6` | Tool layer + ReAct runner + trace | 已完成 | 后端 agent 基础设施已具备可演示能力，通知仍未接真实发送通道 | `backend/app/tools/childcare_tools.py`、`backend/app/services/react_runner.py`、`backend/tests/test_react_runner.py` |
| `T7` | Evaluator-Optimizer / Reflexion（家长话术与干预卡） | 部分具备基础 | 总体仍未 UI-ready，不写成完整闭环已完成 | 当前仍处于 backend-first 向前端最小接入过渡阶段 |
| `T7A` | Parent message reflexion backend-first | 已完成（backend-first） | 已完成 backend-first 版本，当前为 backend-ready；不是 UI-ready；前端最小接入仍未完成 | `backend/app/api/v1/endpoints/agents.py`、`backend/app/services/parent_message_reflexion.py`、`backend/tests/test_parent_message_reflexion_service.py` |
| `T8` | 高风险儿童一键会诊 Multi-Agent backend | 部分具备基础 | 当前高风险会诊主链已有较强基础与金链路，但不要等同于完整 `T8` 全量版本已完成 | `app/teacher/high-risk-consultation/page.tsx`、`lib/agent/high-risk-consultation.ts`、`backend/tests/test_high_risk_consultation_stream.py` |
| `T9` | Admin 决策卡 + 风险优先级区 + 会诊 trace 面板 | 已完成（Admin 展示层） | `/admin` 与 `/admin/agent` 已接入共享决策卡、风险优先级区与会诊 trace 面板；仍不代表 staging / 远端链路已 fully healthy / fully switched | 园长侧叙事仍以现有首页 / agent 为主 |
| `T10` | Parent 趋势问答 backend（7/14/30 天时间窗聚合） | 已完成（代码层） | backend 已完成并支持 7 / 14 / 30 天聚合与 `request_snapshot` / `remote_snapshot`；但结果质量仍受 snapshot / fallback 约束，不写成 live 趋势能力已验收 | `backend/app/api/v1/endpoints/agents.py`、`backend/app/services/parent_trend_service.py`、`backend/tests/test_parent_trend_service.py` |
| `T11` | TrendLineChart + Parent 对话界面集成 | 已完成（Parent 展示层） | `/parent/agent` 已接入趋势快捷问答、TrendLineChart、fallback / warning / dataQuality 展示；当前已具展示能力，但仍属于家长侧补强线，不写成统一 live 趋势平台 | `app/parent/agent/page.tsx`、`components/parent/TrendLineChart.tsx`、`components/parent/ParentTrendResponseCard.tsx` |
| `T12` | 微绘本 pipeline + StoryBookViewer | 未开始 | 后续阶段 | 当前不要写成已具备 |
| `T13` | 集成联调 + README / demo-script / competition docs 收尾 | 未开始 | 最终收尾阶段 | 当前不要写成已开始大规模收尾 |

## 7. 当前并行线程与禁止误操作
### 当前阶段关注项
- Teacher 主线：`T2`、`T2.5`、`T4A`、`T4B`、`T4C`、`T5` 已基本闭环，`T5A` 已作为过渡阶段完成其作用；当前进入录屏 / 验收收口阶段
- 高风险会诊：继续作为当前最强 Agent 工作流展示位
- `T9`：Admin 决策区 / 风险优先级 / 会诊 trace 面板已完成展示层接入，作为第二展示位持续保持稳定
- Parent 趋势线：`T10` / `T11` 已具展示能力，当前作为家长侧补强线维护
- `T7A`：backend-ready，待前端最小接入，不写成 UI-ready
- `S1.1`：待拿到 staging SSH 后手动执行，不计入当前开发闭环

### 当前不要误重排 / 误重开
- 不要把 `T2` 当作未开始。
- 不要把 `T4A` / `T4B` 当作未开始。
- 不要把 `T6` 当作未开始。
- 不要把 `T5` 扩写成完整录屏级 / 远端级验收已完成。
- 不要把 staging 写成 fully healthy / fully switched。
- 不要把高风险会诊金链路写成完整 `T8` 已完成。
- 不要把 `T9` 扩写成“后端聚合接口、staging、远端 release proxy 都已联通验收”；当前完成的是 Admin 展示层与前端复用接线。
- 不要把 `T10` / `T11` 扩写成统一 live 趋势平台，也不要写成 staging / vivo 趋势链路已完成验收。

## 8. 当前推荐优先级
1. Teacher 主线录屏 / 验收收口：保持 `T2` 到 `T5` 现有闭环稳定，优先服务录屏与答辩
2. 高风险儿童一键会诊：继续作为当前最强 Agent 工作流展示位
3. Admin 决策区：保持第二展示位稳定，和高风险会诊一起构成园长侧答辩叙事
4. `S1.1`：拿到 staging SSH 后手动执行远端收口，不提前写成已完成
5. Parent 趋势问答：作为家长侧补强线维护，不提升为当前第一主线
6. `T7A`：后续如需继续推进，优先补前端最小接入，而不是把 backend-ready 误写成 UI-ready

## 9. staging 当前真实状态
### 当前可正式写入文档的保守表述
- DNS 已解析到 `api-staging.smartchildcareagent.cn`。
- 已看到远端 JSON 返回，以及 vivo / memory 相关链路的局部证据。
- 但以下仍未完成：
  - 域名 / TLS 最终打通
  - 新 health schema 对外可见
  - 真 SSE 验证闭环
  - release URL remote-brain-proxy 真验收
- 因此当前只能写成“已有局部远端链路证据”，不能写成 staging 已 fully healthy / fully switched。

### 当前外部可见状态的稳定写法
- 外部可见状态的瞬时观测值不应长期写成账本常量；如需确认最新公网症状，应回看部署 runbook 与 smoke 文档。
- 如果后续线程需要看具体命令、返回值或最新公网症状，请回到：
  - `docs/deployment-vps.md`
  - `docs/vps-smoke.md`
  - `docs/teacher-consultation-qa.md`
- 当前账本只保留一个稳定结论：公开可见入口仍不足以证明 staging 已 fully healthy / fully switched；是否稳定命中 live provider 继续保守表述。

## 10. vivo 能力当前口径
- 只允许通过环境变量使用 `VIVO_APP_ID` / `VIVO_APP_KEY`。
- `vivo_llm`：代码层真实接口接入与最小验证已完成；staging/live 是否真命中上游仍需保守表述。
- `vivo_asr`：真实 transport + fallback provider 实现已接入；live upstream 未在真实密钥 + 真实音频样本下 fully verified。
- `vivo_ocr` / `vivo_tts`：当前仍以 stub / mock / 预留入口为主。
- 所有 vivo 相关事实都必须以官方文档为准：[vivo 官方文档入口](https://aigc.vivo.com.cn/#/document/index?id=1746)。

## 11. 新线程接手建议
### 如果继续 Teacher 语音主线
- Teacher 语音主线一次只收口一个点：先做录屏 / 验收收口，再决定是否继续补局部细节，不要重新把 `T4C` / `T5A` 当成并行主开发线。
- `T4C` 关注：`components/teacher/TeacherVoiceAssistantLayer.tsx`、`lib/mobile/teacher-voice-understand.ts`、`backend/app/services/teacher_voice_understand.py`
- `T5` 收口关注：`app/teacher/agent/page.tsx`、`components/teacher/TeacherDraftConfirmationPanel.tsx`、`lib/mobile/teacher-draft-records.ts`、`lib/mobile/voice-input.ts`

### 如果继续高风险会诊主线
- 先读 `docs/teacher-consultation-qa.md`
- 再读 `app/teacher/high-risk-consultation/page.tsx`
- 再读 `backend/tests/test_high_risk_consultation_stream.py`

### 如果继续 staging / deployment
- 先读 `docs/deployment-vps.md`
- 再读 `docs/vps-smoke.md`
- 再读 `scripts/release-check.mjs`
- 当前默认前提：没有 SSH 就只做定位和 runbook，不写“远端已修好”
