# SmartChildcare Agent 当前状态账本

更新基准：`2026-04-04`

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
- 当前最优先主线：`T2 -> T4C -> T5/T5A`
- 当前最强展示位：高风险儿童一键会诊
- 当前第二强展示位：Admin 决策区 / 风险优先级 / 会诊 trace 面板
- Parent 时光穿梭机 / 微绘本：后续增强，不是当前主攻线
- 当前并行线程：`T4C`、`T5A`、`D2`
- `S1.1` 尚未启动，等待 staging SSH
- 不要把 `T2`、`T4A`、`T4B`、`T6` 误写成未开始
- 不要把 `T5A` 误写成完整 `T5` 已完成
- 不要把 staging 误写成 fully healthy / fully switched

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
| `T3` | MySQL 记忆层 schema + JSON Profile Memory + Trace 表 | 已完成 | `child_profile_memory`、snapshots、trace、repository / data access 基础已到位 | `backend/app/db/memory_store.py`、`backend/app/services/memory_service.py`、`backend/tests/test_memory_hub_repository.py` |
| `T3.5` | 记忆层正式接入主工作流 | 进行中 | consultation / follow-up / weekly report 已开始消费 memory context，但不是 fully unified memory platform | `backend/app/services/orchestrator.py`、`backend/app/services/memory_service.py` |
| `T4A` | ASR abstraction + Router Agent + Prompt Chaining + response schema | 已完成 | backend 理解链已落地 | `backend/app/services/teacher_voice_understand.py`、`backend/app/services/teacher_voice_router.py`、`backend/app/services/teacher_voice_prompt_chain.py`、`backend/tests/test_teacher_voice_understand.py` |
| `T4B` | 真实 vivo ASR transport 接入 | 已完成（代码层） | `vivo_asr` 已具备真实 transport + fallback provider 实现，但 live upstream 未 fully verified | `backend/app/providers/vivo_asr.py`、`backend/tests/test_vivo_asr_provider.py` |
| `T4C` | 把 `T2` 的上传结果接到 `T4` 的 understanding response | 进行中 | 前端已能调用 understanding route 并拿到结构化结果；最终真闭环仍在收口 | `app/api/ai/teacher-voice-understand/route.ts`、`lib/mobile/teacher-voice-understand.ts`、`components/teacher/TeacherVoiceAssistantLayer.tsx` |
| `T5A` | Teacher 草稿确认流组件壳 + persist 抽象版 | 进行中 | 草稿种子与 persist adapter 已开始出现，但完整 confirm / edit / persist 体验未闭环 | `lib/mobile/voice-input.ts`、`backend/app/tools/childcare_tools.py`、`backend/app/services/react_runner.py` |
| `T5` | `draft -> confirm -> persist` 最终真接线版 | 未完成 | 当前不能写成已完成 | `lib/mobile/voice-input.ts`、`components/teacher/TeacherVoiceAssistantLayer.tsx` |
| `T6` | Tool layer + ReAct runner + trace | 已完成 | 后端 agent 基础设施已具备可演示能力，通知仍未接真实发送通道 | `backend/app/tools/childcare_tools.py`、`backend/app/services/react_runner.py`、`backend/tests/test_react_runner.py` |
| `T7` | Evaluator-Optimizer / Reflexion（家长话术与干预卡） | 未开始 | 属后续阶段 | 当前无正式交付路径，保持为 roadmap |
| `T8` | 高风险儿童一键会诊 Multi-Agent backend | 部分具备基础 | 当前高风险会诊主链已有较强基础与金链路，但不要等同于完整 `T8` 全量版本已完成 | `app/teacher/high-risk-consultation/page.tsx`、`lib/agent/high-risk-consultation.ts`、`backend/tests/test_high_risk_consultation_stream.py` |
| `T9` | Admin 决策卡 + 风险优先级区 + 会诊 trace 面板 | 已完成（Admin 展示层） | `/admin` 与 `/admin/agent` 已接入共享决策卡、风险优先级区与会诊 trace 面板；仍不代表 staging / 远端链路已 fully healthy | 园长侧叙事仍以现有首页 / agent 为主 |
| `T10` | Parent 趋势问答 backend（7/14/30 天时间窗聚合） | 未开始 | 后续阶段 | 当前不要写成已具备 |
| `T11` | TrendLineChart + Parent 对话界面集成 | 未开始 | 后续阶段 | 当前不要写成已具备 |
| `T12` | 微绘本 pipeline + StoryBookViewer | 未开始 | 后续阶段 | 当前不要写成已具备 |
| `T13` | 集成联调 + README / demo-script / competition docs 收尾 | 未开始 | 最终收尾阶段 | 当前不要写成已开始大规模收尾 |

## 7. 当前并行线程与禁止误操作
### 当前正在并行的线程
- `T4C`：`T2 -> T4` glue
- `T5A`：Teacher 草稿确认流组件壳 + persist 抽象
- `D2`：当前状态账本增强
- `T9`：Admin 决策区 / 风险优先级 / 会诊 trace 面板已完成展示层接入，作为高风险会诊后的第二强展示位
- `S1.1`：尚未启动，等待 SSH

### 当前不要误重排 / 误重开
- 不要把 `T2` 当作未开始。
- 不要把 `T4A` / `T4B` 当作未开始。
- 不要把 `T6` 当作未开始。
- 不要把 `T5A` 写成完整 `T5` 已完成。
- 不要把 staging 写成 fully healthy。
- 不要把高风险会诊金链路写成完整 `T8` 已完成。
- 不要把 `T9` 扩写成“后端聚合接口、staging、远端 release proxy 都已联通验收”；当前完成的是 Admin 展示层与前端复用接线。

## 8. 当前推荐优先级
1. 主线 1：`T2 -> T4C -> T5/T5A`
2. 主线 2：高风险儿童一键会诊继续作为当前最强 Agent 工作流展示位
3. 主线 3：Admin 决策区继续作为第二强展示位，和高风险会诊一起构成园长侧答辩叙事
4. 主线 4：拿到 staging SSH 后执行 `S1.1`
5. Parent 时光穿梭机 / 微绘本、Evaluator / Reflexion、README / demo-script 收尾全部后置

## 9. staging 当前真实状态
### 当前可正式写入文档的保守表述
- DNS 已解析到 `api-staging.smartchildcareagent.cn`。
- 远端 JSON + live vivo + memory 有证据。
- 但以下仍未完成：
  - 域名 / TLS 最终打通
  - 新 health schema 对外可见
  - 真 SSE 验证闭环
  - release URL remote-brain-proxy 真验收
- 因此当前不能把 staging 写成 fully healthy / fully switched。

### 当前外部可见状态的稳定写法
- 本轮做过一次公开只读核验，结论是“外部可见状态仍未收口”，但这类观测值是高时效信息，不应当长期写成账本常量。
- 如果后续线程需要看具体命令、返回值或最新公网症状，请回到：
  - `docs/deployment-vps.md`
  - `docs/vps-smoke.md`
  - `docs/teacher-consultation-qa.md`
- 当前账本只保留一个稳定结论：公开可见入口尚不足以证明 staging 已 fully healthy / fully switched。

## 10. vivo 能力当前口径
- 只允许通过环境变量使用 `VIVO_APP_ID` / `VIVO_APP_KEY`。
- `vivo_llm`：代码层真实接口接入与最小验证已完成；staging/live 是否真命中上游仍需保守表述。
- `vivo_asr`：真实 transport + fallback provider 实现已接入；live upstream 未在真实密钥 + 真实音频样本下 fully verified。
- `vivo_ocr` / `vivo_tts`：当前仍以 stub / mock / 预留入口为主。
- 所有 vivo 相关事实都必须以官方文档为准：[vivo 官方文档入口](https://aigc.vivo.com.cn/#/document/index?id=1746)。

## 11. 新线程接手建议
### 如果继续 Teacher 语音主线
- 先判断是在做 `T4C` 还是 `T5A`，不要两个任务一起扩散。
- `T4C` 关注：`components/teacher/TeacherVoiceAssistantLayer.tsx`、`lib/mobile/teacher-voice-understand.ts`、`backend/app/services/teacher_voice_understand.py`
- `T5A` 关注：`lib/mobile/voice-input.ts`、`backend/app/tools/childcare_tools.py`、`backend/app/services/react_runner.py`

### 如果继续高风险会诊主线
- 先读 `docs/teacher-consultation-qa.md`
- 再读 `app/teacher/high-risk-consultation/page.tsx`
- 再读 `backend/tests/test_high_risk_consultation_stream.py`

### 如果继续 staging / deployment
- 先读 `docs/deployment-vps.md`
- 再读 `docs/vps-smoke.md`
- 再读 `scripts/release-check.mjs`
- 当前默认前提：没有 SSH 就只做定位和 runbook，不写“远端已修好”
