# SmartChildcare Agent 比赛架构总说明

## 1. 项目定位

SmartChildcare Agent 是一个面向托育机构场景的移动端优先 AI 助手 / Agent 系统。它的目标不是把托育工作重新做成一个更复杂的后台，而是把教师、家长、园长最关键的判断、沟通、干预和复盘流程压缩成适合录屏和答辩的产品主路径。

当前默认代码事实以 `2026-04-07` 仓库为准。

核心闭环是：

`机构记录 -> 系统分析 -> AI 建议 / Agent 工作流 -> 家长反馈 -> 托育行动闭环`

## 2. 为什么它不是普通托育后台

普通后台强调“记录、统计、管理”。

SmartChildcare Agent 当前更强调：

- 先捕捉，再确认
- 先看优先级，再执行
- 先给今夜动作，再收反馈
- 用结构化卡片和可解释 trace 替代长篇静态报表

从代码落点看，这个判断已经被写进页面结构：

- Teacher 首页 `app/teacher/page.tsx` 围绕异常儿童、未晨检、待复查和待沟通家长组织
- Parent 首页 `app/parent/page.tsx` 围绕今夜任务、趋势入口和微绘本 wow factor 组织
- Admin 首页 `app/admin/page.tsx` 围绕机构优先级、重点会诊和派单组织
- 三个 `/agent` 页面都在把结构化上下文变成结构化行动

## 3. 当前比赛叙事收敛为 4 条主线

### 3.1 Teacher 语音入口主线

- 起点：`/teacher`
- 目标：把老师的碎片观察快速变成结构化草稿
- 页面：Teacher 全局语音入口、Teacher Agent 草稿确认
- 关键链路：
  - `app/api/ai/teacher-voice-understand`
  - `backend/app/api/v1/endpoints/teacher_voice.py`
  - `backend/app/services/teacher_voice_understand.py`
- 亮点：先捕捉，再确认；移动端产品感强
- 保守口径：ASR live upstream 未 fully verified

### 3.2 高风险会诊主线

- 起点：`/teacher/high-risk-consultation`
- 目标：展示当前最强的 Multi-Agent workflow
- 页面：stage 推进、summary card、48 小时复查、intervention card、trace / debug
- 关键链路：
  - `app/api/ai/high-risk-consultation/stream`
  - `backend/app/api/v1/endpoints/agents.py`
  - `lib/agent/high-risk-consultation.ts`
  - `backend/app/services/orchestrator.py`
- 亮点：memory context + SSE + explainability + 多角色动作卡
- 保守口径：debug case / next fallback 不等于远端真链路验收

### 3.3 Admin 决策区主线

- 起点：`/admin`
- 目标：把高风险会诊结果转成园长办公会式决策卡
- 页面：`RiskPriorityBoard`、source badge、优先级条目、派单 / 周报入口
- 关键链路：
  - `app/api/ai/high-risk-consultation/feed`
  - `backend/app/api/v1/endpoints/agents.py`
  - `components/admin/RiskPriorityBoard.tsx`
  - `lib/agent/use-admin-consultation-feed.ts`
- 亮点：会诊结果的二次决策化呈现，是第二展示位
- 保守口径：不扩写成 `T9C` 低层字段已彻底打通

### 3.4 Parent 趋势线 / 微绘本主线

- 起点：`/parent`
- 目标：同时承担 wow factor 和今夜行动闭环
- 页面：
  - `/parent/storybook`
  - `/parent/agent`
  - `TrendLineChart`
  - `StoryBookViewer`
- 关键链路：
  - `app/api/ai/parent-storybook`
  - `backend/app/services/parent_storybook_service.py`
  - `app/api/ai/parent-trend-query`
  - `backend/app/services/parent_trend_service.py`
- 亮点：故事化呈现 + 趋势解释 + 今夜反馈
- 保守口径：
  - Parent trend 必须走 FastAPI brain
  - Parent storybook 有本地 fallback
  - 图像 / 配音与上游 live 仍未 fully verified

## 4. 架构分层

### 4.1 交互感知层

职责：

- 移动端页面与角色视角
- 卡片流组织
- 结构化结果渲染
- 弱网草稿和提醒

主要落点：

- `app/*`
- `components/role-shell/*`
- `components/teacher/*`
- `components/consultation/*`
- `components/admin/*`
- `components/parent/*`
- `lib/store.tsx`
- `lib/mobile/*`

### 4.2 Next 桥接层

职责：

- 统一对前端暴露 `/api/ai/*`
- 优先转发到 FastAPI brain
- 在允许的场景提供本地 fallback

当前关键 route：

- `/api/ai/teacher-voice-understand`
- `/api/ai/high-risk-consultation`
- `/api/ai/high-risk-consultation/stream`
- `/api/ai/high-risk-consultation/feed`
- `/api/ai/parent-trend-query`
- `/api/ai/parent-storybook`
- `/api/ai/teacher-agent`
- `/api/ai/admin-agent`

### 4.3 FastAPI brain

职责：

- workflow 编排
- provider 调用
- memory context 合并
- SSE 输出
- trace / repository / tool use

主要落点：

- `backend/app/api/v1/endpoints/*`
- `backend/app/services/orchestrator.py`
- `backend/app/services/teacher_voice_understand.py`
- `backend/app/services/parent_trend_service.py`
- `backend/app/services/parent_storybook_service.py`
- `backend/app/services/react_runner.py`

### 4.4 记忆中枢

职责：

- 保存 snapshot / trace / child profile memory
- 为 consultation / follow-up / weekly report 提供上下文

主要落点：

- `backend/app/db/memory_store.py`
- `backend/app/services/memory_service.py`
- `backend/app/memory/session_memory.py`
- `backend/app/memory/vector_store.py`
- `app/api/state/route.ts`

保守口径：

- `child_profile_memory` / snapshots / trace 已落地
- SessionMemory / vector store 仍是轻量骨架
- 当前应写成“记忆中枢基础已具备，并开始接入主工作流”

## 5. 真实链路与 fallback 地图

| 链路 | 正常路径 | fallback / degraded 路径 | 当前应如何表述 |
| --- | --- | --- | --- |
| Teacher voice | UI -> `/api/ai/teacher-voice-understand` -> FastAPI -> `teacher_voice_understand` -> ASR provider | Next 本地 best-effort fallback，可继续生成结构化草稿 | 主线可演示；ASR live upstream 未 fully verified |
| 高风险会诊 | UI -> `/api/ai/high-risk-consultation/stream` -> FastAPI stream -> orchestrator -> consultation agents | `next-stream-fallback`、demo trace、fixture | 当前最强 Agent workflow；不把 fallback 当成远端验收 |
| Admin feed | UI -> `/api/ai/high-risk-consultation/feed` -> FastAPI feed | route unavailable 时，UI 复用本地 consultation 做展示级 fallback | 第二展示位稳定；不宣称 T9C fully 打通 |
| Parent trend | UI -> `/api/ai/parent-trend-query` -> FastAPI trend service | Next 本地 fallback 被刻意禁用；结果中的 `demo_snapshot` 属于 backend 数据降级 | 有展示能力，但必须保留 `source` / `dataQuality` / `warnings` |
| Parent storybook | UI -> `/api/ai/parent-storybook` -> FastAPI storybook service -> story image / audio provider | `next-json-fallback` + rule / asset / mock pipeline | wow factor 已形成，但图像 / 配音与 live provider 仍有边界 |

## 6. vivo 能力映射

所有 vivo 相关能力必须以官方文档为准：

- [vivo 官方文档入口](https://aigc.vivo.com.cn/#/document/index?id=1746)

当前仓库可保守映射为：

| 能力 | 当前落点 | 当前口径 |
| --- | --- | --- |
| LLM | `backend/app/providers/vivo_llm.py` | 代码层接入 + smoke / test 基础已具备 |
| ASR | `backend/app/providers/vivo_asr.py` | transport 已接入；live upstream 未 fully verified |
| TTS | `backend/app/providers/vivo_tts.py` | storybook 配音链路已有 provider 与 tests；不写成 fully live |
| Story image | `backend/app/providers/story_image_provider.py` | 支持 vivo provider 与 mock / asset fallback |
| OCR | `backend/app/providers/vivo_ocr.py` | 仍以 stub / mock / 预留入口为主 |

强制边界：

- 只通过 `VIVO_APP_ID` / `VIVO_APP_KEY` 使用密钥
- 不把真实值写入代码、README、日志、截图、样例
- 文档只允许写“代码层接入 + smoke / test 基础”，除非真实远端验收已完成

## 7. 当前最适合比赛的叙事顺序

1. Teacher 语音入口说明“老师如何低成本记录”
2. 高风险会诊说明“系统如何自动组织多 Agent 决策”
3. Admin 决策区说明“会诊结果如何进入机构级行动”
4. Parent 微绘本 / 趋势线说明“家长如何理解、执行、反馈”

这样可以把三端闭环讲成：

`教师发现问题 -> Agent 会诊 -> 园长排序决策 -> 家长看到故事和任务 -> 家长反馈 -> 再回流给教师`

## 8. 当前最该避免的误表述

- 不要把 staging 写成 fully healthy / fully switched
- 不要把 `vivo_llm` / `vivo_asr` / `vivo_tts` 写成 fully live
- 不要把 Parent trend 写成“本地也能完整跑”
- 不要把 Parent storybook 写成“图像 / 配音已真实稳定走 vivo”
- 不要把 Admin 第二展示位写成 `T9C` 主战场已完成
