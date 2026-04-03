# SmartChildcare Agent 协作手册

## 精简总控头
- 如果仓库里还没有 `AGENTS.md` 和 `docs/competition-architecture.md`，请先扫描 `app/`、`components/`、`lib/`、现有 AI routes、教师 / 家长 / 园长相关页面与数据结构，快速建立上下文。
- 这是 SmartChildcare Agent：一个“移动端优先的托育 AI 助手 / Agent 系统”，目标比赛是 vivo 赞助的 AIGC 创新赛。优先保证移动端产品感、Agent 工作流、可演示性、最大复用现有仓库。
- 凡是涉及 vivo AI 能力接入，必须严格参考官方文档：[vivo 官方文档入口](https://aigc.vivo.com.cn/#/document/index?id=1746)。
- 仅允许通过环境变量使用 `VIVO_APP_ID` / `VIVO_APP_KEY`；不要把真实值写入代码、README、日志、截图或示例文件，不要提交到 git。
- 请主动使用 subagents，并在 plan 中先写出准备启动的 subagents 及其分工。至少包含：`repo_mapper`、`docs_architect`、`reviewer_tester`。
- 先给 5-8 条 implementation plan，然后不要停，直接执行。
- 只做当前任务范围内的改动；完成后输出：修改 / 新增文件清单、文档结构、运行 / 验证方式、风险与下一步建议。

## 1. 项目身份与目标
SmartChildcare Agent 不是一个普通的托育后台，也不是单纯的数据看板。它是一个围绕教师、家长、园长三类角色构建的移动端优先托育 AI 助手 / Agent 系统，目标是在真实托育业务流程里，把“记录、分析、建议、干预、反馈、复盘”做成可演示、可答辩、可持续演进的产品闭环。

当前仓库已经具备清晰的角色入口与产品骨架：
- 教师端：首页在 `app/teacher/page.tsx`，AI 助手在 `app/teacher/agent/page.tsx`，高风险儿童一键会诊在 `app/teacher/high-risk-consultation/page.tsx`。
- 家长端：首页在 `app/parent/page.tsx`，AI 助手在 `app/parent/agent/page.tsx`。
- 园长端：首页在 `app/admin/page.tsx`，运营 Agent 在 `app/admin/agent/page.tsx`。

当前最优先服务的比赛目标是 vivo 赞助的 AIGC 创新赛。所有方案取舍都应优先服务这一比赛的演示效果、答辩逻辑与 AI 能力落地叙事。

## 2. 产品与比赛优先级
当前实现优先级遵循以下顺序：
- 第一优先级：服务 vivo AIGC 创新赛，优先保证作品有完整主路径、清晰故事线和强产品感。
- 第二优先级：优先做可演示、可录屏、可答辩的功能，而不是追求大而全。
- 第三优先级：优先做移动端体验强、卡片流清晰、单屏任务明确、Agent 感强的页面。
- 第四优先级：优先做能串起教师、家长、园长三端的闭环功能，而不是孤立单点能力。
- 第五优先级：优先最大化复用现有仓库的角色页、UI scaffold、AI route、store 和 backend bridge。

涉及比赛实现取舍时，默认使用下面的判断标准：
- 如果一个方案更“工程完整”但不利于 3 分钟内讲清楚，就降级。
- 如果一个方案更“技术炫”但需要大范围重构现有页面，就降级。
- 如果一个方案能显著增强移动端产品感、Agent 工作流、跨角色闭环、vivo 能力映射，就优先。

## 3. 永久工程规则
长期工程协作默认遵循以下规则：
- 最大化复用现有仓库，不轻易推翻 `teacher / parent / admin` 三端结构。
- 不做无意义大重构，不为了“架构更漂亮”而打断当前比赛主路径。
- 优先沿用现有模块：`components/role-shell/RoleScaffold.tsx`、`lib/store.tsx`、`lib/server/brain-client.ts`、`lib/agent/*`、`backend/app/*`。
- 任何任务默认先出 implementation plan，再执行。
- 修改完成后，尽量做最小可行验证，至少说明是否运行过 `npm run lint`、`npm run build`、`pytest backend/tests`。
- 遇到已有脏工作树时，不要覆盖用户改动；只在当前任务范围内最小增量修改。
- 新能力优先做“最小可运行增量”，先把主路径打通，再考虑抽象和泛化。

## 4. vivo 能力接入规则
所有 vivo 相关能力接入必须以官方文档为准，当前唯一默认参考入口为：
- [vivo 官方文档入口](https://aigc.vivo.com.cn/#/document/index?id=1746)

强制规则如下：
- 真实接入前必须对照官方文档逐项核验鉴权、接口路径、请求格式、返回格式和限流要求。
- 只允许通过服务端环境变量使用 `VIVO_APP_ID` 和 `VIVO_APP_KEY`。
- 禁止把真实密钥写入源码、README、注释、日志、截图、示例文件、测试样例或 git 历史。
- 禁止在前端直接暴露 vivo 密钥。
- 当前仓库里与 vivo 对齐的主要落点是 `backend/.env.example` 与 `backend/app/providers/vivo_*`，默认沿用这些服务端入口演进。

当前仓库的真实状态要保守表达：
- `backend/app/providers/vivo_llm.py` 已有初步真实调用路径。
- `backend/app/providers/vivo_ocr.py`、`backend/app/providers/vivo_asr.py`、`backend/app/providers/vivo_tts.py` 仍是 stub / mock 占位。
- 因此任何文档、汇报或答辩都不能把 vivo 真接入描述成“已 fully live”。

## 5. 前端规则
前端默认是移动端优先，而不是桌面后台优先。实现时遵循以下原则：
- 单屏先讲清楚一个任务，不把页面堆成复杂运营后台。
- 优先卡片流、任务流、AI 助手感，而不是传统表格管理感。
- 优先复用 `components/role-shell/RoleScaffold.tsx` 提供的 `RolePageShell`、`RoleSplitLayout`、`MetricGrid`、`SectionCard`、`AssistantEntryCard`、`AgentWorkspaceCard`。
- 优先复用现有 teacher / parent / admin 页面及 role scaffold，不重复造一套新的角色框架。
- 优先复用现有移动端入口与体验模块，例如 `components/MobileNav.tsx`、`lib/mobile/local-draft-cache.ts`、`lib/mobile/reminders.ts`、`lib/mobile/voice-input.ts`、`lib/mobile/ocr-input.ts`。
- 页面必须优先体现“AI 在帮用户做事”，而不是“用户在操作一个复杂系统”。

默认叙事方向如下：
- 教师端更像“隐形助手”，帮助识别异常、生成沟通建议、发起会诊。
- 家长端更像“今夜行动助手”，帮助理解、执行、反馈、跟进。
- 园长端更像“运营决策 Agent”，帮助排序优先级、沉淀派单、输出周报。

## 6. 后端 / Agent 规则
后端与 Agent 层默认采用分层设计，但仍以最小可运行增量实现为先。

当前仓库的真实落点：
- Next.js 路由层：`app/api/ai/*`。
- Next 到 FastAPI 的桥接与 fallback：`lib/server/brain-client.ts`。
- FastAPI brain：`backend/app/api/v1/endpoints/*`、`backend/app/services/orchestrator.py`。
- 当前已有的 AI / Agent 路由包括：
  - `/api/ai/suggestions`
  - `/api/ai/follow-up`
  - `/api/ai/teacher-agent`
  - `/api/ai/admin-agent`
  - `/api/ai/weekly-report`
  - `/api/ai/high-risk-consultation`
  - `/api/ai/vision-meal`
  - `/api/ai/diet-evaluation`
  - `/api/ai/stream`

Agent 设计与实现默认遵循以下原则：
- 鼓励前后端分层，前端负责交互感知与结构化渲染，后端负责编排、provider、memory、stream。
- 支持多智能体、Routing、Prompt Chaining、ReAct、Evaluator-Optimizer、Generative UI 等模式，但只能在不破坏主路径的前提下逐步加入。
- 优先沿用当前高价值链路：`lib/agent/high-risk-consultation.ts` 与 `lib/agent/consultation/*`。
- 高风险会诊默认沿用现有多智能体角色：
  - `HealthObservationAgent`
  - `DietBehaviorAgent`
  - `ParentCommunicationAgent`
  - `InSchoolActionAgent`
  - `CoordinatorAgent`
- 新增 Agent 功能时，优先沿用结构化输出，而不是回退到长篇无结构文本。

## 7. 数据与记忆层规则
数据与记忆层默认按“当前可用 + 后续演进”来设计，不夸大现状。

当前真实状态：
- 前端统一状态中心在 `lib/store.tsx`。
- 前端本地持久化基于 `localStorage`，已覆盖 `interventionCards`、`consultations`、`mobileDrafts`、`reminders` 等。
- 远端快照通过 `app/api/state/route.ts` + MySQL 持久化机构级状态。
- 后端 brain 当前有 `SessionMemory`、`SimpleVectorStore` 和 `RepositoryBundle` 作为演进骨架。

长期演进方向允许包括：
- MySQL 结构化业务数据与快照。
- JSON 级本地记忆与弱网缓存。
- Agent run trace / reasoning trace。
- 向量检索与 embedding 记忆。

但默认必须保守表达：
- 当前向量检索仍是 placeholder。
- 当前 session memory 仍是轻量内存态。
- 当前 backend repository 默认仍是 in-memory 风格骨架。
- 不能把记忆层写成“已完成统一持久化闭环”。

## 8. subagents 使用规则
默认要求主动使用 subagents，尤其在复杂任务、文档固化、架构梳理、并行验证时。

执行规则：
- 每次任务开始时，先列出准备启动的 subagents 及分工。
- 典型角色建议如下：
  - `repo_mapper`：扫描当前仓库，确认真实页面、路由、模块、数据结构。
  - `backend_architect`：聚焦 FastAPI brain、provider、memory、streaming、bridge。
  - `frontend_architect`：聚焦移动端结构、卡片流、role scaffold、交互叙事。
  - `vivo_api_integrator`：对照官方文档核验 vivo provider 接入方案。
  - `db_memory_designer`：梳理 MySQL、JSON cache、trace、vector 的演进策略。
  - `reviewer_tester`：审查脏工作树风险、验证命令、过度承诺风险和交付质量。
  - `docs_architect`：在文档任务里负责章节树、口径、信息压缩与长期可读性。

subagents 的目标不是重复主线程，而是减少遗漏、降低并行沟通成本、提高事实准确性。

## 9. 输出规范
每轮任务完成后，默认输出以下内容：
- implementation plan
- 修改 / 新增文件清单
- 当前运行状态
- fallback 点
- 风险点
- 下一步建议

如果任务涉及代码实现，还应明确：
- 哪些检查已运行
- 哪些检查未运行，以及原因
- 是否存在 mock / real fallback
- 是否存在受限于密钥、网络、第三方平台文档的未完成部分

输出必须尽量简洁，但不能省略关键风险与边界说明。

## 10. 当前最重要的 demo 主路径
当前比赛阶段，最重要的三条主演示路径固定如下：

### Teacher 端隐形助手
目标：让评委看到教师并不是在“填系统”，而是在被系统主动辅助。

当前落点：
- 教师首页：`app/teacher/page.tsx`
- 教师 Agent：`app/teacher/agent/page.tsx`

讲述重点：
- 系统主动识别异常儿童、未晨检、待复查、待沟通家长。
- 教师可一键生成家长沟通建议与今日跟进行动。
- 页面强调移动端卡片流与单屏任务优先。

### 高风险儿童一键会诊
目标：展示 SmartChildcare Agent 最强的 Agent 工作流与跨角色闭环能力。

当前落点：
- 页面：`app/teacher/high-risk-consultation/page.tsx`
- Route：`app/api/ai/high-risk-consultation/route.ts`
- 多智能体链路：`lib/agent/high-risk-consultation.ts`、`lib/agent/consultation/*`

讲述重点：
- 自动带入晨检异常、待复查、近 7 天观察、家长反馈。
- 多 Agent 汇总成教师动作、家长今晚任务、园长决策卡。
- 支持 OCR / ASR / TTS / LLM 的 vivo 能力映射，但当前真实接入仍应保守表述。

### Parent 端时光穿梭机 / 微绘本
目标：把家长端从“看信息”升级成“理解孩子变化、执行今晚任务、形成情感化呈现”的体验。

当前可复用落点：
- 家长首页：`app/parent/page.tsx`
- 家长 Agent：`app/parent/agent/page.tsx`
- 干预卡：`components/agent/InterventionCardPanel.tsx`
- 状态与反馈：`lib/store.tsx`

当前口径：
- 这条路径目前应写成“基于现有 parent home + parent agent + intervention card 的下一阶段比赛演进方向”。
- 不能把“时光穿梭机 / 微绘本”写成已经完整交付。
