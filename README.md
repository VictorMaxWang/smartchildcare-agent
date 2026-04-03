# SmartChildcare Agent

面向中国高校计算机大赛 AIGC 创新赛的“移动端优先托育 AI Agent 系统”。

SmartChildcare Agent 不是普通托育管理后台，而是一套围绕托育真实业务闭环设计的多角色 AI 助手系统。它以教师、家长、园长三类角色为核心，用结构化记录、多模态输入、Agent 协作和生成式 UI，把“发现问题、生成建议、执行干预、收集反馈、持续复盘”串成一条完整链路。

## 项目定位

- 移动端优先：适合教师现场记录、家长晚间反馈、园长随时决策
- AI 助手感：不是单点功能，而是连续对话、连续跟进、连续闭环
- Agent 化：教师 Agent、家长 Agent、园长 Agent、高风险会诊 Agent
- 多角色闭环：园内观察、家庭动作、48 小时复查形成统一链路
- 端云协同：前端负责感知与展示，后端负责多智能体编排与工具调用
- 比赛叙事友好：适合展示“感官层 / 大脑层 / 数据层”的完整 AIGC 系统架构

## 当前实现亮点

### 1. 角色端已经完整成型

- 教师端：日常工作台、教师 Agent、高风险会诊
- 家长端：孩子状态总览、家长 Agent、建议追问与任务闭环
- 园长端：机构视角总览、园长 Agent、优先级事项与派单视图

### 2. 业务数据闭环已经打通

- 儿童档案管理
- 晨检与健康记录
- 饮食与饮水记录
- 成长与行为观察
- 家长反馈与打卡
- 机构通知事件与状态同步

### 3. AI 能力从“建议生成”升级为“Agent 系统”

- AI 建议
- AI 追问
- AI 周报
- 教师 Agent
- 园长 Agent
- 高风险会诊 Agent
- 饮食图像识别与评估接口
- SSE 流式输出预留

### 4. 前后端分层 Agent 架构 v1 已落地

- Next.js 负责交互感知层
- FastAPI 负责 AI 大脑层
- MySQL + 轻量记忆接口负责数据与记忆层
- 现有 `/api/ai/*` URL 保持不变，前端无须大改

## 系统架构

```mermaid
graph TD
    A["移动端感知层<br/>Next.js / TypeScript"] --> B["AI 大脑层<br/>FastAPI / Agents / Tools / SSE"]
    B --> C["数据与记忆层<br/>MySQL / Session Memory / Vector Memory"]
    A --> D["教师端"]
    A --> E["家长端"]
    A --> F["园长端"]
    D --> B
    E --> B
    F --> B
    B --> G["vivo LLM / OCR / ASR / TTS / Embedding"]
```

### 分层边界

- 感官层留在 Next.js
  - 页面、角色壳、移动端交互
  - 录音、拍照、草稿缓存、提醒
  - Generative UI 和前端态管理
- 大脑层放到 FastAPI
  - 多智能体编排
  - 工具调用
  - provider 访问
  - 高风险会诊与复杂工作流
  - SSE 流式输出
- 数据层 v1 先分治
  - Next.js 保留登录、会话、`/api/state`、通知事件
  - FastAPI 新增 agent run repository、session memory、vector memory placeholder

## 角色与页面

### 教师端

- `/teacher`
- `/teacher/agent`
- `/teacher/high-risk-consultation`

### 家长端

- `/parent`
- `/parent/agent`

### 园长端

- `/admin`
- `/admin/agent`

### 公共业务页

- `/children`
- `/health`
- `/growth`
- `/diet`

## 当前 AI 路由

前端仍然只调用 Next.js 的 `/api/ai/*`，这些路由会优先代理到 FastAPI，大脑层不可用时再回退到本地 TS 逻辑。

- `/api/ai/suggestions`
- `/api/ai/follow-up`
- `/api/ai/teacher-agent`
- `/api/ai/admin-agent`
- `/api/ai/weekly-report`
- `/api/ai/high-risk-consultation`
- `/api/ai/vision-meal`
- `/api/ai/diet-evaluation`
- `/api/ai/stream`

对应的 FastAPI 路由：

- `POST /api/v1/agents/parent/suggestions`
- `POST /api/v1/agents/parent/follow-up`
- `POST /api/v1/agents/teacher/run`
- `POST /api/v1/agents/admin/run`
- `POST /api/v1/agents/reports/weekly`
- `POST /api/v1/agents/consultations/high-risk`
- `POST /api/v1/multimodal/vision-meal`
- `POST /api/v1/multimodal/diet-evaluation`
- `POST /api/v1/stream/agent`
- `GET /api/v1/health`

## 技术栈

### 前端

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- Radix UI
- Recharts

### 后端

- Python
- FastAPI
- Pydantic
- Uvicorn

### 数据与状态

- MySQL
- React Context + 统一 Store
- localStorage 本地缓存
- session memory / vector memory placeholder

### AI 与多模态

- 现阶段：Mock provider + 现有 Bailian/Qwen 兜底逻辑
- 后续接入：vivo LLM / OCR / ASR / TTS / Embedding

## 仓库结构

```text
childcare-smart/
├─ app/
│  ├─ admin/
│  ├─ api/
│  │  ├─ admin/notification-events/
│  │  ├─ ai/
│  │  ├─ auth/
│  │  └─ state/
│  ├─ auth/login/
│  ├─ children/
│  ├─ diet/
│  ├─ growth/
│  ├─ health/
│  ├─ parent/
│  └─ teacher/
├─ backend/
│  ├─ app/
│  │  ├─ agents/
│  │  ├─ api/v1/endpoints/
│  │  ├─ core/
│  │  ├─ db/
│  │  ├─ memory/
│  │  ├─ providers/
│  │  ├─ schemas/
│  │  ├─ services/
│  │  └─ tools/
│  ├─ tests/
│  ├─ requirements.txt
│  └─ .env.example
├─ components/
├─ lib/
│  ├─ ai/
│  ├─ agent/
│  ├─ auth/
│  ├─ bridge/
│  ├─ db/
│  ├─ mobile/
│  ├─ server/
│  └─ store.tsx
├─ public/
├─ scripts/
├─ .env.example
└─ README.md
```

## 快速开始

### 1. 安装前端依赖

```bash
npm install
```

### 2. 配置前端环境变量

复制根目录环境变量模板：

```bash
cp .env.example .env.local
```

前端至少建议配置：

```env
AUTH_SESSION_SECRET=your-local-session-secret
AUTH_DEFAULT_PASSWORD=123456
NEXT_PUBLIC_FORCE_MOCK_MODE=false
BRAIN_API_BASE_URL=http://127.0.0.1:8000
BRAIN_API_TIMEOUT_MS=20000
```

如果启用 MySQL：

```env
DATABASE_URL=mysql://childcare_app:password@db.example.com:3306/childcare
DATABASE_SSL=true
```

### 3. 配置后端环境变量

复制 FastAPI 环境变量模板：

```bash
cp backend/.env.example backend/.env
```

后端常用配置：

```env
APP_NAME=SmartChildcare Agent Brain
APP_VERSION=0.1.0
ENVIRONMENT=development
ALLOW_ORIGINS=http://127.0.0.1:3000,http://localhost:3000
ENABLE_MOCK_PROVIDER=true
VIVO_APP_ID=
VIVO_APP_KEY=
MYSQL_URL=
```

注意：

- 仓库中只能保留占位符
- 不要把真实 `VIVO_APP_ID`、`VIVO_APP_KEY` 提交到 Git
- 不要把真实密钥写进 README 或日志

### 4. 安装后端依赖

```bash
py -m pip install -r backend/requirements.txt
```

### 5. 启动 FastAPI 大脑层

```bash
uvicorn app.main:app --reload --app-dir backend --port 8000
```

### 6. 启动 Next.js 前端

```bash
npm run dev
```

默认访问：

```text
http://localhost:3000
```

## 本地演示账号

本地开发默认支持以下示例账号：

- `u-admin` / 陈园长 / 园长或管理员
- `u-teacher` / 李老师 / 教师
- `u-teacher2` / 周老师 / 教师
- `u-parent` / 林妈妈 / 家长

默认密码如果未单独配置，一般为：

```text
123456
```

## 可用脚本

### 前端

```bash
npm run dev
npm run build
npm run start
npm run lint
```

### 校验与烟测

```bash
npm run ai:smoke
npm run release:check
npm run release:gate:local
npm run release:gate:remote
```

### 后端

```bash
py -m pytest backend/tests
```

## 我们已经验证过的内容

- `npm run lint`
- `npm run build`
- `set PYTHONPATH=backend && py -m pytest backend/tests`

当前 FastAPI 测试覆盖了：

- `health`
- parent suggestions
- parent follow-up
- teacher agent
- admin agent
- weekly report
- high-risk consultation
- SSE stream
- multimodal mock endpoints

## 当前状态说明

### 已完成

- Next.js 主体页面与角色端可运行
- `/api/ai/*` 与 FastAPI 薄代理桥接已接通
- FastAPI 大脑层骨架已建好
- mock provider 可跑通主要链路
- 高风险会诊页面与后端接口已接通
- SSE 路由已预留

### 目前仍是 v1 骨架

- vivo 真接口还未全部切到生产接入
- ASR / TTS 仍是 skeleton，后续需要按 vivo 文档做 WebSocket 方案
- 向量记忆与 MySQL agent memory 目前仍是轻量占位实现
- `ai:smoke` 需要在本地服务已启动、且满足登录上下文时再运行

## vivo 接入规划

推荐顺序：

1. vivo LLM
2. vivo OCR
3. vivo ASR
4. vivo TTS
5. vivo Embedding

当前仓库中的 provider 预留位置：

- `backend/app/providers/vivo_llm.py`
- `backend/app/providers/vivo_ocr.py`
- `backend/app/providers/vivo_asr.py`
- `backend/app/providers/vivo_tts.py`
- `backend/app/providers/vivo_embedding.py`

## 适用场景

- 高校 AIGC 比赛答辩与演示
- AI + 托育 / AI + 教育产品原型
- 多角色 Agent 系统课程设计或毕业设计
- 前后端分离 AI 应用架构实践

## 路线图

- 接入 vivo 真正的多模态能力
- 把高风险会诊做成完整的流式 Agent 金链路
- 增加向量检索与长期记忆
- 收敛通知、状态与会话到统一数据服务
- 强化移动端拍照、语音、弱网缓存体验

## License

MIT
