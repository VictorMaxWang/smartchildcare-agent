# SmartChildcare Agent Task Registry

更新基准：`2026-04-09`

本文件是 `T1-T31` 的**唯一详细任务主表**。如果它与其他文档冲突，统一按下面优先级处理：

`代码事实 > docs/current-status-ledger.md > docs/competition-architecture.md > README / 旧任务地图 / 旧描述`

使用规则：

- `docs/current-status-ledger.md` 负责阶段、稳定 walkthrough、验证边界
- `docs/competition-architecture.md` 负责 lane 映射与 shared contracts
- `docs/task-registry.md` 负责 `T1-T31` 详细定义、依赖、并行性、建议触达模块、推荐 subagents、验收与回写要求
- `AGENTS.md` 负责 kickoff、subagent 协议、并行安全规则

## 状态枚举

- `Planned`
  - 已登记，尚未开始
- `In Progress`
  - 已有线程实际推进
- `Done-code-only`
  - 单侧代码或数据已落地，但还未完成跨层对齐或 demo-ready 验证
- `Demo-ready`
  - walkthrough / 真机 / 录屏再验已通过，可作为稳定展示面
- `Done`
  - 已完成并完成需要的文档回写

当前初始状态约定：

- `T1-T7`、`T18`、`T19`、`T24`、`T25 = Done-code-only`
- 其余任务按各自条目状态为准

## Wave A-D 与依赖规则

### Wave A｜快收口 / 低风险高收益

- 任务：`T1`、`T2`、`T3`、`T4`、`T5`、`T6`
- 规则：
  - `T1`、`T5` 强并行
  - `T2` 与 `T3` 可并行
  - `T4` 依赖 `T2/T3`
  - `T6` 依赖 `T5`

### Wave B｜新增亮点第一批

- 任务：`T7`、`T8`、`T9`、`T10`、`T11`、`T12`、`T13`、`T14`
- 规则：
  - `T7 -> T8 -> T9 -> T10`
  - `T11 -> T12`
  - `T13 -> T14`
  - 三条链之间可以并行

### Wave C｜闭环与治理增强

- 任务：`T15`、`T16`、`T17`、`T18`、`T19`、`T20`、`T21`
- 规则：
  - `T15 -> T16 -> T17`
  - `T18 -> T19`
  - `T20 -> T21`
  - 链间可并行，链内不要倒序

### Wave D｜纵深化与比赛加分层

- 任务：`T22`、`T23`、`T24`、`T25`、`T26`、`T27`、`T28`、`T29`、`T30`、`T31`
- 规则：
  - `T22 -> T23`
  - `T24 -> T25`
  - `T26 -> T27`
  - `T28 -> T29`
  - `T30` 可与 `T28` 并行
  - `T31` 接在 `T18/T19` 与 `T30` 接口稳定后推进

## 回写规则

所有任务完成后，至少更新 `docs/task-registry.md`。除此以外：

- 如果任务改变了当前阶段、稳定 walkthrough、主展示位、验证边界，必须同步回写 `docs/current-status-ledger.md`
- 如果任务改变了 lane 映射、shared contract、依附主路径，必须同步回写 `docs/competition-architecture.md`
- 如果任务改变了 kickoff、subagent、并行安全协议，必须同步回写 `AGENTS.md`

---

## Wave A｜快收口 / 低风险高收益

### T1｜桌面端会诊 Trace 摘要重排

- 类型：优化 / 收口
- Lane：收口与体验修复线
- 问题定义：Admin 侧会诊 trace 摘要在桌面端仍偏长条日志视角，信息层次弱，不利于答辩和宽屏演示；同时不能破坏移动端现有单列阅读体验。
- 目标效果：在不影响移动端的前提下，把桌面端 trace 收束成更紧凑、更像“园长 explainability 摘要面板”的结构。
- 主要触达层：Admin UI / consultation trace card / board layout
- 建议触达模块：`app/admin/page.tsx`、`components/admin/ConsultationTraceCard.tsx`、`components/consultation/ConsultationTracePanel.tsx`、`lib/consultation/trace-view-model.ts`
- 推荐前置依赖：无
- 推荐 subagents：`repo_mapper + frontend_architect + reviewer_tester`
- 是否适合并行：高
- 最小验收方式：桌面宽屏下能把 trace 摘要压缩为多段结构化摘要，移动端布局不退化
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要桌面 walkthrough 与录屏再验
- 当前状态：`Done-code-only`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/current-status-ledger.md`、`docs/competition-architecture.md`

### T2｜前端 36 人 demo 数据扩充

- 类型：优化 / 演示增强
- Lane：Demo 数据与演示准备线
- 问题定义：前端 demo 数据需要稳定覆盖多角色演示、班级分布、年龄分布与风险分布，否则录屏会反复撞到同一批孩子。
- 目标效果：保持并验证前端 36 人 demo 基线，让 Teacher / Parent / Admin 三端的可见 children、派生榜单和补强链路都稳定工作。
- 主要触达层：前端 store / visibleChildren / parent feed / admin board 派生逻辑
- 建议触达模块：`lib/store.tsx`、`lib/store_extras.txt`、`app/teacher/page.tsx`、`app/parent/page.tsx`、`app/admin/page.tsx`
- 推荐前置依赖：无
- 推荐 subagents：`repo_mapper + frontend_architect + reviewer_tester`
- 是否适合并行：中高
- 最小验收方式：确认前端 demo children 基线保持 36 人，三端页面和派生榜单未因扩容失真
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 walkthrough 与录屏 child spot check
- 当前状态：`Done-code-only`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/current-status-ledger.md`

### T3｜后端 demo snapshot 扩充到 36 人

- 类型：优化 / 演示增强
- Lane：Demo 数据与演示准备线
- 问题定义：当前前端 36 人与后端 `_demo_snapshot()` 未对齐，会导致 trend / consultation / weekly report / writeback 演示态割裂。
- 目标效果：让 backend demo snapshot 也覆盖 36 名学生，并具备健康、饮食、成长、反馈、待复查等典型场景。
- 主要触达层：backend repository / snapshot fallback / service demo data
- 建议触达模块：`backend/app/db/childcare_repository.py`、`app/api/state/route.ts`、`backend/tests/test_childcare_repository.py`、与 snapshot 相关的 service smoke
- 推荐前置依赖：无
- 推荐 subagents：`repo_mapper + backend_architect + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：后端 demo snapshot 的 child 基线与前端 36 人对齐，并能被 trend / consultation / weekly report 正常消费
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 walkthrough
- 当前状态：`Done-code-only`
- 2026-04-09 更新：backend demo snapshot 已扩到 36 人，并可被 repository / parent trend 定向测试消费；仍缺统一 walkthrough 与录屏再验。
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/current-status-ledger.md`

### T4｜36 人 demo seed 矩阵与 QA 文档

- 类型：文档 / 演示收口
- Lane：Demo 数据与演示准备线
- 问题定义：即使人数已扩到 36 人，如果没有“哪个 child 适合演示哪条主线”的矩阵，录屏仍会乱且容易临场选错样例。
- 目标效果：形成 demo seed matrix，明确 36 名孩子分别覆盖哪些典型场景，并推荐最适合录屏的 child ID 与脚本顺序。
- 主要触达层：docs / demo walkthrough / data QA
- 建议触达模块：`docs/demo-script.md`、`docs/freeze-checklists.md`、必要时 `docs/current-status-ledger.md`
- 推荐前置依赖：`T2`、`T3`
- 推荐 subagents：`repo_mapper + docs_architect + status_ledger_editor + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：形成 child ID -> 场景 -> 推荐 walkthrough 的矩阵，并被 demo script / checklist 引用
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要录屏 child QA 再验
- 当前状态：`Done-code-only`
- 2026-04-09 更新：`docs/demo-seed-matrix.md` 与相关 demo script / QA 文档已存在，但仍缺按录屏顺序做一轮 child QA 再验。
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/current-status-ledger.md`

### T5｜饮水量字段全链路审计

- 类型：优化前审计
- Lane：收口与体验修复线
- 问题定义：`waterMl`、`hydrationAvg`、`lowHydration` 等精确饮水量表达在托育场景里容易让评委产生违和感，但这些字段可能已经深度嵌入 store、趋势、咨询和 admin 聚合，不能盲删。
- 目标效果：系统梳理 hydration 相关字段的真实用途，给出删除、保留、降级表达三种方案评估，为 T6 提供事实依据。
- 主要触达层：store / diet / AI evaluation / consultation diet-agent / UI 展示
- 建议触达模块：`lib/store.tsx`、`backend/app/services/parent_trend_service.py`、`lib/agent/consultation/diet-agent.ts`、`lib/agent/priority-engine.ts`、`backend/app/db/childcare_repository.py`
- 推荐前置依赖：无
- 推荐 subagents：`repo_mapper + backend_architect + frontend_architect + reviewer_tester`
- 是否适合并行：高
- 最小验收方式：输出 hydration 字段用途清单、影响面、推荐处理策略，并在文档中明确哪些链路会受影响
- 是否需人工 walkthrough / 真机 / 录屏再验：否
- 当前状态：`Done-code-only`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/current-status-ledger.md`、`docs/competition-architecture.md`

### T6｜饮水量展示降级 / 状态化表达

- 类型：优化 / 产品可信度修复
- Lane：收口与体验修复线
- 问题定义：即便底层保留 hydration 字段，用户主视角也不应该频繁看到过于精确的 ml 数值，否则会削弱托育可信度。
- 目标效果：把“饮水量”降级成“饮水状态 / 补水主动性 / 近 7 天补水趋势”等更可信表达，同时保持现有链路仍可工作。
- 主要触达层：前端展示层 / insight copy / trend / consultation 文案
- 建议触达模块：`components/parent/ParentTrendResponseCard.tsx`、`components/parent/TrendLineChart.tsx`、`components/consultation/*`、`app/parent/agent/page.tsx`、`backend/app/services/parent_trend_service.py`
- 推荐前置依赖：`T5`
- 推荐 subagents：`frontend_architect + docs_architect + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：主视角不再高频暴露精确 ml 数值，同时 walkthrough 中的 copy 更可信
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 walkthrough 与录屏再验
- 当前状态：`Done-code-only`
- 2026-04-09 更新：主视角补水表达已切到状态化文案；底层 hydration 数据仍保留给 trend / consultation / aggregation 链路。
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/current-status-ledger.md`、`docs/competition-architecture.md`

---

## Wave B｜新增亮点第一批

### T7｜外部健康文件桥接助手：上传入口 + schema 骨架

- 类型：新增
- Lane：外部健康文件桥接线
- 问题定义：家长上传医院、过敏、复查、服药等外部健康资料后，系统当前缺少统一入口把这些资料接进托育主系统。
- 目标效果：建立最小上传入口、Next route、FastAPI service 与统一 request/response schema，为后续 OCR 和动作映射打底。
- 主要触达层：Parent / Teacher 入口、Next route、backend service、types
- 建议触达模块：`app/teacher/health-file-bridge/page.tsx`、`app/api/ai/health-file-bridge/route.ts`、`lib/agent/health-file-bridge.ts`、`backend/app/schemas/health_file_bridge.py`、`backend/app/services/health_file_bridge_service.py`
- 推荐前置依赖：无
- 推荐 subagents：`repo_mapper + frontend_architect + backend_architect + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：上传入口、bridge schema、服务端入口三者打通，并能落到统一结构
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 walkthrough
- 当前状态：`Done-code-only`
- 2026-04-09 更新：teacher 入口、Next route、本地 fallback 与 backend schema/service skeleton 已落地；OCR / writeback / live escalation 继续留给 `T8-T10`。
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/competition-architecture.md`

### T8｜外部健康文件桥接助手：OCR / 多模态抽取

- 类型：新增
- Lane：外部健康文件桥接线
- 问题定义：上传只是入口，真正关键的是从图片 / PDF 中抽出结构化事实，否则桥接只停留在“上传文件”。
- 目标效果：支持文件类型判断、OCR、多模态抽取，并结构化识别关键指标、禁忌项、风险项、复查点。
- 主要触达层：backend provider / OCR / parsing / bridge service
- 建议触达模块：`backend/app/providers/vivo_ocr.py`、`backend/app/schemas/multimodal.py`、`backend/app/services/orchestrator.py`、可能新增的 bridge parsing service
- 推荐前置依赖：`T7`
- 推荐 subagents：`backend_architect + workflow_cartographer + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：给定样例图片 / PDF，能输出结构化抽取结果与失败边界
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要样例文件 walkthrough
- 当前状态：`Planned`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/competition-architecture.md`

### T9｜外部健康文件桥接助手：专业信息 -> 托育动作映射

- 类型：新增
- Lane：外部健康文件桥接线
- 问题定义：系统不能停留在“解释报告”，必须把专业信息翻译成园内今日动作、家庭今晚动作、复查计划与是否升级会诊。
- 目标效果：建立结构化托育动作映射引擎，把专业输入转成可执行 childcare action。
- 主要触达层：backend service / intervention / consultation / parent communication draft
- 建议触达模块：`backend/app/services/orchestrator.py`、`backend/app/services/high_risk_consultation_contract.py`、`app/api/ai/follow-up/route.ts`、`lib/agent/intervention-card.ts`
- 推荐前置依赖：`T8`
- 推荐 subagents：`backend_architect + workflow_cartographer + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：桥接输出能直接给出园内动作、家庭动作、复查点与升级建议
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 trace walkthrough
- 当前状态：`Planned`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/competition-architecture.md`

### T10｜外部健康文件桥接助手：写回主系统闭环

- 类型：新增 / 集成
- Lane：外部健康文件桥接线
- 问题定义：如果外部健康资料不能写回 memory、snapshot、follow-up、consultation，它就只是一个孤立 demo。
- 目标效果：把桥接结果接回 child profile memory、consultation snapshot、teacher follow-up、parent communication draft 等主链路。
- 主要触达层：memory / writeback / consultation / follow-up
- 建议触达模块：`backend/app/services/memory_service.py`、`app/api/ai/follow-up/route.ts`、`app/api/ai/weekly-report/route.ts`、`backend/app/services/admin_consultation_feed.py`、相关 snapshot writeback 链路
- 推荐前置依赖：`T7`、`T8`、`T9`
- 推荐 subagents：`repo_mapper + backend_architect + workflow_cartographer + reviewer_tester`
- 是否适合并行：中低
- 最小验收方式：桥接输出能在 memory / consultation / follow-up / weekly report 至少一条主链路中被真实消费
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 walkthrough 与录屏
- 当前状态：`Planned`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/current-status-ledger.md`、`docs/competition-architecture.md`

### T11｜关怀模式 / 祖辈模式：大字卡片 + 简化交互

- 类型：新增
- Lane：关怀模式 / 祖辈模式线
- 问题定义：Parent 默认模式更适合年轻父母，但真实照护者里有大量祖辈，需要更大字、更少层级、更少选择成本。
- 目标效果：增加关怀模式，切换后采用大字卡片、一屏一句话、今晚做什么、明天提醒什么的低门槛版本。
- 主要触达层：Parent 首页 / Parent Agent / Storybook 相关 UI
- 建议触达模块：`app/parent/page.tsx`、`app/parent/agent/page.tsx`、`app/parent/storybook/page.tsx`、`components/parent/*`、`components/role-shell/RoleScaffold.tsx`
- 推荐前置依赖：无
- 推荐 subagents：`frontend_architect + reviewer_tester`
- 是否适合并行：高
- 最小验收方式：开启关怀模式后，家长侧关键页面信息密度显著下降且仍保留主链路入口
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 walkthrough 与录屏
- 当前状态：`Planned`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/competition-architecture.md`

### T12｜关怀模式：一键播报 + 一键语音反馈

- 类型：新增
- Lane：关怀模式 / 祖辈模式线
- 问题定义：祖辈或低数字熟练度照护者更需要“读给我听”和“我直接说”的能力，而不是复杂文字输入。
- 目标效果：为 Parent 关键页面加入一键播报和语音反馈能力，并区分真实 TTS / ASR 与 preview fallback。
- 主要触达层：Parent 端 / TTS-ASR provider / 反馈入口
- 建议触达模块：`app/parent/page.tsx`、`app/parent/agent/page.tsx`、`components/parent/*`、`backend/app/providers/vivo_tts.py`、`backend/app/providers/vivo_asr.py`
- 推荐前置依赖：`T11`
- 推荐 subagents：`frontend_architect + backend_architect + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：一键播报与语音反馈入口可用，且 fallback 状态对用户可见
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要真机与录屏再验
- 当前状态：`Planned`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/competition-architecture.md`

### T13｜统一意图入口：后端路由器

- 类型：新增
- Lane：统一意图入口线
- 问题定义：功能越来越多后，用户不应该靠自己找页面，而应通过一句自然语言命中正确 workflow。
- 目标效果：建立后端意图识别与 workflow routing，输出 `targetWorkflow`、`targetPage`、`deeplink`、`previewCard`。
- 主要触达层：Next route / backend service / typed contract
- 建议触达模块：`app/api/ai/react-agent/route.ts`、`app/api/ai/teacher-agent/route.ts`、`app/api/ai/admin-agent/route.ts`、`backend/app/services/react_runner.py`、`backend/app/services/orchestrator.py`
- 推荐前置依赖：无
- 推荐 subagents：`backend_architect + workflow_cartographer + reviewer_tester`
- 是否适合并行：高
- 最小验收方式：给定自然语言意图，路由器能稳定返回 workflow / page / deeplink / preview contract
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 contract walkthrough
- 当前状态：`Planned`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/competition-architecture.md`

### T14｜统一意图入口：前端超级入口 + deeplink 卡

- 类型：新增
- Lane：统一意图入口线
- 问题定义：如果只有后端 router，没有前端可视化入口，就不足以形成真正的 AI 助手感。
- 目标效果：在 Teacher / Parent / Admin 合适位置新增 AI 超级入口，让用户说需求，系统直接给出 deeplink 与结果卡。
- 主要触达层：前端入口组件 / deeplink / role pages
- 建议触达模块：`app/teacher/page.tsx`、`app/admin/page.tsx`、`app/parent/page.tsx`、`components/role-shell/RoleScaffold.tsx`、`lib/bridge/use-agent-stream.ts`
- 推荐前置依赖：`T13`
- 推荐 subagents：`frontend_architect + workflow_cartographer + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：三端至少一端出现统一意图入口，并能落到可点击 deeplink 结果卡
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 walkthrough 与录屏
- 当前状态：`Planned`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/current-status-ledger.md`、`docs/competition-architecture.md`

---

## Wave C｜闭环与治理增强

### T15｜家长反馈结构化回流引擎：schema / store / normalize

- 类型：新增
- Lane：家长反馈闭环线
- 问题定义：Parent 端虽然已有反馈入口与家长参与链路，但“执行后反馈”还不够结构化，难以成为下一轮 AI 判断的稳定输入。
- 目标效果：建立统一 feedback contract，记录是否执行、执行次数、谁执行、孩子反应、是否改善、阻碍、语音 / 图片附件等。
- 主要触达层：types / store / feedback normalize / compatibility layer
- 建议触达模块：`lib/store.tsx`、`lib/persistence/snapshot.ts`、`app/api/ai/follow-up/route.ts`、`backend/app/services/memory_service.py`
- 推荐前置依赖：无
- 推荐 subagents：`repo_mapper + backend_architect + frontend_architect + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：结构化 feedback schema 被 store、snapshot 和 follow-up 输入链同时接受
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要表单与写回 walkthrough
- 当前状态：`Planned`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/competition-architecture.md`

### T16｜Parent 结构化反馈填写器

- 类型：新增
- Lane：家长反馈闭环线
- 问题定义：即使有 schema，没有简单可用的 Parent 侧反馈入口，家长也不会提交高质量反馈。
- 目标效果：在 Parent 主线中加入结构化反馈表单，支持低门槛填写，并预留语音 / 图片反馈入口。
- 主要触达层：Parent UI / form / feedback entry
- 建议触达模块：`app/parent/agent/page.tsx`、`components/agent/InterventionCardPanel.tsx`、`components/parent/*`
- 推荐前置依赖：`T15`
- 推荐 subagents：`frontend_architect + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：家长能从主链路直接提交结构化反馈，且字段与 `T15` schema 对齐
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 walkthrough，语音入口落地时再做真机
- 当前状态：`Planned`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/competition-architecture.md`

### T17｜家长反馈写回 memory / trend / weekly report / consultation

- 类型：新增 / 集成
- Lane：家长反馈闭环线
- 问题定义：家长反馈的价值不在提交本身，而在于能不能回流到 memory、趋势解释、下一次会诊与周报。
- 目标效果：建立 feedback writeback path 和反馈有效性聚合字段，让后续链路都能消费反馈信号。
- 主要触达层：memory / trend / consultation / weekly report
- 建议触达模块：`backend/app/services/memory_service.py`、`app/api/ai/follow-up/route.ts`、`app/api/ai/weekly-report/route.ts`、`backend/app/services/orchestrator.py`、`backend/app/services/parent_trend_service.py`
- 推荐前置依赖：`T15`、`T16`
- 推荐 subagents：`backend_architect + workflow_cartographer + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：反馈写回后能在 trend / consultation / weekly report 中至少一处被真实引用
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 walkthrough 与录屏再验
- 当前状态：`Planned`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/current-status-ledger.md`、`docs/competition-architecture.md`

### T18｜会诊证据链 contract

- 类型：重点优化
- Lane：会诊可解释性增强线
- 问题定义：高风险会诊已经很强，但“为什么这样判断”的证据链仍不够统一和结构化。
- 目标效果：建立 evidence contract，明确来源、置信度、是否需人工复核、建议类别等。
- 主要触达层：consultation result / admin feed / trace view model / types
- 建议触达模块：`backend/app/services/high_risk_consultation_contract.py`、`lib/consultation/trace-types.ts`、`lib/consultation/trace-view-model.ts`、`backend/app/schemas/agent.py`
- 推荐前置依赖：无
- 推荐 subagents：`backend_architect + workflow_cartographer + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：evidence contract 被 consultation 输出、admin feed 和 trace view model 同时消费
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 contract walkthrough
- 当前状态：`Done-code-only`
- 2026-04-08 更新：已新增 `ConsultationEvidenceItem` / `evidenceItems`，并把 `explainability`、`keyFindings`、`triggerReasons`、`memoryMeta`、`continuityNotes`、`multimodalNotes` 归并到统一 evidence contract；Admin feed 与 trace view model 已开始消费结构化 evidence，真正的 evidence UI 仍留给 `T19`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/competition-architecture.md`

### T19｜会诊证据链 UI

- 类型：重点优化
- Lane：会诊可解释性增强线
- 问题定义：即使 evidence 已有 contract，如果 Teacher / Admin 看不到，它仍不能解决信任与透明问题。
- 目标效果：把 evidence chain 接到 Teacher / Admin 可解释 UI，并让其在答辩中更容易展示。
- 主要触达层：consultation cards / trace cards / admin board
- 建议触达模块：`app/teacher/high-risk-consultation/page.tsx`、`app/admin/page.tsx`、`components/consultation/*`、`components/admin/ConsultationTraceCard.tsx`
- 推荐前置依赖：`T18`
- 推荐 subagents：`frontend_architect + workflow_cartographer + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：Teacher / Admin 至少各有一个 evidence chain 可视化入口，且不牺牲当前主路径密度
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 walkthrough 与录屏
- 当前状态：`Done-code-only`
- 2026-04-09 更新：Admin 第二展示位已在 `ConsultationTraceCard` 优先消费结构化 `evidenceItems`，展示来源、类别、置信度、人工复核与 supports 关系；证据按 `evidenceCategory` 分组，按 supports / confidence / requiresHumanReview / sourceType 排序，首屏展示关键证据，其余放入折叠区。
- 2026-04-09 边界：Teacher 侧只在 `TraceStepCard` 增加最多 2 条 compact 结构化证据预览；旧 `evidenceHighlights`、`explainability` 与 stage legacy evidence 仍保留兼容 fallback，不把本轮写成完整 explainability 系统 fully finished。
- 2026-04-09 验证：`npx --yes tsx --test lib/consultation/evidence-display.test.ts lib/consultation/normalize-result.test.ts lib/consultation/trace-view-model.test.ts lib/agent/admin-consultation-feed.test.ts`、`npm run lint`、`npm run build`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/current-status-ledger.md`、`docs/competition-architecture.md`

### T20｜48 小时干预任务实体与生命周期

- 类型：重点优化
- Lane：干预执行与升级线
- 问题定义：现有 intervention card 已有“今晚动作”和“48 小时复查”概念，但还不是一个真正可派单、可跟踪、可提交证据的任务系统。
- 目标效果：建立 task domain model，支持 `ownerRole`、`dueTime`、`status`、`evidenceSubmissionMode` 等字段。
- 主要触达层：intervention card / reminder / follow-up task model
- 建议触达模块：`lib/agent/intervention-card.ts`、`lib/mobile/reminders.ts`、`app/api/admin/notification-events/route.ts`、`app/api/ai/follow-up/route.ts`
- 推荐前置依赖：无
- 推荐 subagents：`backend_architect + workflow_cartographer + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：干预卡、提醒、任务状态三者能映射到统一 task model
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 workflow walkthrough
- 当前状态：`Planned`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/competition-architecture.md`

### T21｜自动升级规则

- 类型：重点优化
- Lane：干预执行与升级线
- 问题定义：如果任务逾期未完成、连续未完成或反馈显示未改善，系统需要自动建议升级，而不是一直停留在静态建议层。
- 目标效果：建立 escalation rules，让任务执行结果能升级到园长 / 再次会诊 / 后续提醒。
- 主要触达层：task engine / reminder / admin dispatch / consultation trigger
- 建议触达模块：`lib/agent/priority-engine.ts`、`backend/app/services/admin_consultation_feed.py`、`backend/app/services/orchestrator.py`、`app/api/admin/notification-events/route.ts`
- 推荐前置依赖：`T20`
- 推荐 subagents：`backend_architect + workflow_cartographer + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：逾期、未完成、未改善等触发条件能稳定给出升级建议并保留 trace
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 trace walkthrough
- 当前状态：`Planned`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/current-status-ledger.md`、`docs/competition-architecture.md`

---

## Wave D｜纵深化与比赛加分层

### T22｜年龄分层照护引擎：共享策略层

- 类型：新增
- Lane：年龄分层照护线
- 问题定义：托育场景中 0–12 月、12–24 月、24–36 月照护重点差异很大；如果不做年龄分层，系统会越来越像泛儿童助手。
- 目标效果：建立 age-band policy config，定义各年龄段的 care focus、teacher observation focus、parent action tone、storybook tone、weekly report focus 等。
- 主要触达层：shared policy / child snapshot / suggestion logic
- 建议触达模块：`lib/store.tsx`、`backend/app/db/childcare_repository.py`、`backend/app/services/parent_storybook_service.py`、`backend/app/services/parent_trend_service.py`、`app/api/ai/weekly-report/route.ts`
- 推荐前置依赖：无
- 推荐 subagents：`backend_architect + workflow_cartographer + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：形成统一 age-band policy，并被至少两条主链路引用
- 是否需人工 walkthrough / 真机 / 录屏再验：否
- 当前状态：`Planned`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/competition-architecture.md`

### T23｜年龄分层照护引擎接入主链路

- 类型：新增 / 集成
- Lane：年龄分层照护线
- 问题定义：共享策略层本身不够，必须真正接到 Teacher、Parent、Storybook、Weekly Report、Intervention 等主链路。
- 目标效果：让不同年龄段在输出语气、建议重点、任务策略上体现真实差异。
- 主要触达层：Teacher / Parent / Storybook / Weekly Report / Intervention
- 建议触达模块：`app/teacher/page.tsx`、`app/parent/page.tsx`、`app/parent/storybook/page.tsx`、`app/api/ai/weekly-report/route.ts`、`lib/agent/intervention-card.ts`
- 推荐前置依赖：`T22`
- 推荐 subagents：`repo_mapper + backend_architect + frontend_architect + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：至少 Teacher / Parent / Weekly Report 三处出现明确年龄分层差异
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 walkthrough 与录屏
- 当前状态：`Planned`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/current-status-ledger.md`、`docs/competition-architecture.md`

### T24｜Teacher Copilot：backend 能力包

- 类型：深度优化
- Lane：Teacher Copilot 线
- 问题定义：Teacher 语音主线现在更像输入入口，还没完全升级成“教师能力增强工具”。
- 目标效果：在 `teacher-voice-understand` 响应中稳定增加 `record_completion_hints`、`micro_training_sop`、`parent_communication_script` 三类结构化 Copilot 输出，并保留兼容 UI 的 legacy mirrors。
- 主要触达层：teacher voice understand / typed contract / local fallback / mobile draft passthrough
- 建议触达模块：`backend/app/schemas/teacher_voice.py`、`backend/app/services/teacher_voice_understand.py`、`backend/app/services/teacher_voice_copilot.py`、`lib/ai/teacher-voice-understand.ts`、`lib/ai/teacher-voice-copilot.ts`、`backend/tests/test_teacher_voice_understand.py`
- 推荐前置依赖：无
- 推荐 subagents：`repo_mapper + backend_architect + workflow_cartographer + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：Teacher backend 输出中稳定出现补全提示、30 秒 SOP、家长沟通话术三个结构化槽位，且不改动 `t5Seed` 主形状
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 service walkthrough
- 当前状态：`Done-code-only`
- 2026-04-08 更新：主落点已收敛到 `teacher_voice_understand` contract；backend 与本地 fallback 都会返回 3 类结构化 Copilot 字段，展示层仍需 `T25` 继续接入
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/competition-architecture.md`

### T25｜Teacher Copilot：UI 接入

- 类型：深度优化
- Lane：Teacher Copilot 线
- 问题定义：Copilot 后端输出如果不接到 Teacher 端，就无法真正提升教师专业度与产品感。
- 目标效果：在 Teacher 主线中加入记录补全提示、30 秒 SOP、家长沟通话术卡。
- 主要触达层：Teacher UI / draft / follow-up / communication cards
- 建议触达模块：`app/teacher/page.tsx`、`app/teacher/agent/page.tsx`、`components/teacher/*`
- 推荐前置依赖：`T24`
- 推荐 subagents：`frontend_architect + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：Teacher 端至少一条主路径能展示 Copilot 卡片，不破坏当前录屏主线
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 walkthrough 与录屏
- 当前状态：`Done-code-only`
- 2026-04-08 更新：`/teacher/agent` 已接入草稿确认区 Copilot 与结果卡 Copilot；`/teacher` 保持轻入口，语音录制主链未改
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/current-status-ledger.md`、`docs/competition-architecture.md`

### T26｜Weekly Report V2：三版本行动化 schema / generator

- 类型：优化
- Lane：Actionized Weekly Report 线
- 问题定义：现有 weekly report 更偏总结，还不够“下周行动入口”。
- 目标效果：升级为 Teacher / Admin / Parent 三版本行动化周报。
- 主要触达层：weekly-report route / types / generator / backend service
- 建议触达模块：`app/api/ai/weekly-report/route.ts`、`backend/app/services/orchestrator.py`、`backend/app/schemas/agent.py`、`lib/ai/types.ts`
- 推荐前置依赖：无
- 推荐 subagents：`backend_architect + docs_architect + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：三版本 schema、生成逻辑与输出槽位定义齐全，并可被前端接入
- 是否需人工 walkthrough / 真机 / 录屏再验：否
- 当前状态：`Planned`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/competition-architecture.md`

### T27｜Weekly Report V2：前端接入

- 类型：优化
- Lane：Actionized Weekly Report 线
- 问题定义：只有 schema / generator 没有展示层，周报依然无法形成角色差异化体验。
- 目标效果：Teacher / Admin / Parent 至少各有一个入口看到对应版本的行动化周报。
- 主要触达层：Teacher / Parent / Admin 页面与周报组件
- 建议触达模块：`app/admin/agent/page.tsx`、`app/teacher/agent/page.tsx`、`app/parent/page.tsx` 或 `app/parent/agent/page.tsx`
- 推荐前置依赖：`T26`
- 推荐 subagents：`frontend_architect + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：三角色至少各有一个入口能看到对应版本周报
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 walkthrough 与录屏
- 当前状态：`Planned`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/current-status-ledger.md`、`docs/competition-architecture.md`

### T28｜Admin 质量驾驶舱：metrics engine

- 类型：新增
- Lane：Admin 质量治理线
- 问题定义：当前 Admin 决策区更像“今天该盯谁”，还没有形成机构治理级质量指标。
- 目标效果：建立闭环指标聚合引擎，包括会诊转闭环率、48h 复查完成率、家长反馈率、家庭任务执行率、教师记录低置信度比例、建议有效率等。
- 主要触达层：metrics engine / aggregation / backend response
- 建议触达模块：`backend/app/services/admin_consultation_feed.py`、`backend/app/agents/admin_agent.py`、`lib/agent/priority-engine.ts`、`backend/app/db/childcare_repository.py`
- 推荐前置依赖：无
- 推荐 subagents：`backend_architect + workflow_cartographer + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：metrics engine 能稳定输出机构治理视角的聚合指标
- 是否需人工 walkthrough / 真机 / 录屏再验：否
- 当前状态：`Planned`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/competition-architecture.md`

### T29｜Admin 质量驾驶舱：UI

- 类型：新增
- Lane：Admin 质量治理线
- 问题定义：没有治理仪表盘，Admin 端难以从“谁最急”升级到“整个机构质量正在怎样变化”。
- 目标效果：为 `/admin` 增加质量驾驶舱展示位，不压掉 `RiskPriorityBoard`，但形成机构治理第二层视角。
- 主要触达层：Admin UI / metrics cards / lists / heat views
- 建议触达模块：`app/admin/page.tsx`、`components/admin/*`
- 推荐前置依赖：`T28`
- 推荐 subagents：`frontend_architect + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：Admin 首页出现不干扰主优先级板的质量驾驶舱视图
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 walkthrough 与录屏
- 当前状态：`Planned`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/current-status-ledger.md`、`docs/competition-architecture.md`

### T30｜需求洞察引擎

- 类型：新增
- Lane：需求洞察与信任透明线
- 问题定义：机构不仅需要知道今天谁最急，还需要知道“家长最关心什么”“哪类问题最常触发会诊”“哪类行动最难执行”。
- 目标效果：建立聚合型需求洞察引擎，输出关注点热力、问题热区、执行难点、弱反馈班级 / 年龄段等。
- 主要触达层：feedback / consultation / task / admin insight engine
- 建议触达模块：`backend/app/services/admin_consultation_feed.py`、`backend/app/services/memory_service.py`、`backend/app/db/childcare_repository.py`、现有 aggregation helper
- 推荐前置依赖：无
- 推荐 subagents：`backend_architect + workflow_cartographer + reviewer_tester`
- 是否适合并行：中
- 最小验收方式：至少输出一版可被 Admin 消费的洞察聚合结果
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 walkthrough
- 当前状态：`Planned`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/competition-architecture.md`

### T31｜信任透明层

- 类型：新增
- Lane：需求洞察与信任透明线
- 问题定义：家长对服务范围、数据来源、AI 如何生成建议、机构响应表现不透明，会削弱信任。
- 目标效果：建立 Parent 可见的透明页 / 透明层，解释服务范围、数据来源、AI 生成机制、机构响应表现与保守边界。
- 主要触达层：Parent UI / insight / copy layer / explainability summary
- 建议触达模块：`app/parent/page.tsx`、`app/parent/agent/page.tsx`、`components/parent/ParentTrendResponseCard.tsx`、`components/parent/StoryBookViewer.tsx`、`lib/consultation/trace-view-model.ts`
- 推荐前置依赖：`T18`、`T19`、`T30`
- 推荐 subagents：`frontend_architect + docs_architect + reviewer_tester`
- 是否适合并行：中低
- 最小验收方式：Parent 端出现一层清晰透明说明，能消费 `source`、`fallback`、`dataQuality`、`warnings` 等现有字段
- 是否需人工 walkthrough / 真机 / 录屏再验：是；需要 walkthrough 与录屏
- 当前状态：`Planned`
- 完成后需回写哪些文档：`docs/task-registry.md`、`docs/current-status-ledger.md`、`docs/competition-architecture.md`
