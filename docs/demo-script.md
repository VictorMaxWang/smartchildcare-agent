# T13B Demo Script Final

适用目标：

- 比赛录屏
- 现场答辩
- freeze 前交接

本母稿只覆盖当前已经具备展示基础的 5 条路径，不新增功能、不扩写 staging，不把 fallback 讲成真链路验收。

## 固定录屏顺序

1. `/teacher`
2. `/teacher/high-risk-consultation`
3. `/admin`
4. `/parent`
5. `/parent/storybook?child=c-1`
6. `/parent/agent?child=c-1`

## 录屏前准备

- 前端：`npm run dev`
- 后端：`py -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000`
- 环境：`$env:BRAIN_API_BASE_URL = "http://127.0.0.1:8000"`
- 账号：只使用 demo account
- 保密：不要在录屏、截图、日志里出现真实 `VIVO_APP_ID` / `VIVO_APP_KEY`
- 画面里必须允许出现真实的 fallback / source / dataQuality / warnings，不要后期遮掉

## 推荐总时长

- 主线录屏模式：4 到 6 分钟
- 答辩讲述模式：2.5 到 3.5 分钟

## 主线录屏模式

### 路径 1：Teacher 语音主线

#### 起点

- `/teacher`

#### 操作

1. 先停留在 Teacher 首页，让评委看到异常儿童、待复查、待沟通家长和快捷入口
2. 点击或长按全局语音入口
3. 录入一段教师观察
4. 展示结构化草稿和 warnings
5. 跳转到 `/teacher/agent` 看草稿确认

#### 页面表现

- 语音层状态切换
- transcript / understanding
- warnings
- 草稿源
- 教师 Agent 页中的草稿确认入口

#### AI 在做什么

- 把老师的语音 / 文本观察转成 transcript
- 做 understanding
- 生成 T5 draft seed
- 给出下一步草稿确认入口

#### 亮点

- 老师不需要先写完整记录
- 主链更像手机助手，而不是复杂后台
- “先捕捉，再确认”很适合移动端与录屏

#### fallback 怎么讲

- “这里我们保证的是结构化草稿链路可演示，ASR live upstream 还没有写成 fully verified。”

#### 镜头里必须保留

- 语音层状态
- transcript
- warnings
- 草稿源

### 路径 2：高风险会诊主线

#### 起点

- `/teacher/high-risk-consultation`

#### 操作

1. 选择一个高风险儿童
2. 补充教师说明，必要时加图片 / 语音占位
3. 点击一键生成会诊
4. 让镜头完整经过 stage 推进
5. 结果页停留在 summary card、48 小时复查和 intervention card
6. 若需答辩补充，可用 `?trace=debug` 展示 `providerTrace` 与 `memoryMeta`

#### 页面表现

- `long_term_profile -> recent_context -> current_recommendation` 的推进
- summary card
- follow-up card
- intervention card
- explainability / trace 信息

#### AI 在做什么

- 合并长期画像、最近上下文和当前风险信号
- 组织多 Agent 分阶段推理
- 输出教师动作、家长今夜任务和园长决策卡

#### 亮点

- 当前最强 Agent workflow
- 同时展示 memory、trace、SSE、结构化结果
- 能自然串到 Admin 和 Parent

#### fallback 怎么讲

- “如果这里显示 `next-stream-fallback` 或 demo trace，我们只把它当成页面级 fallback，不把它讲成远端 brain 已完成验收。”

#### 镜头里必须保留

- stage 推进
- summary card
- follow-up card
- intervention card
- `providerTrace` / `memoryMeta`（答辩版至少保留一屏）

### 路径 3：Admin 决策区主线

#### 起点

- `/admin`

#### 操作

1. 先停留在首页 hero stats
2. 重点展示“今日重点会诊 / 高风险优先事项”
3. 读一到两个优先级条目
4. 读 source badge
5. 必要时进入 `/admin/agent` 展示周报或 follow-up 入口

#### 页面表现

- `RiskPriorityBoard`
- source badge
- 优先级条目
- Agent / 周报入口

#### AI 在做什么

- 把 consultation 结果压缩成园长能执行的优先级
- 给出 explainability 线索
- 帮园长从“看报表”切换到“先处理谁”

#### 亮点

- 它把会诊结果转成机构级行动
- 这是高风险会诊之后的第二展示位
- 适合答辩时讲“从单个孩子到机构决策”

#### fallback 怎么讲

- “如果这里出现 local fallback，说明展示层复用了现有 consultation 结果，不代表 `T9D` / `T9C` 或远端聚合已经 fully 打通。”

#### 镜头里必须保留

- `RiskPriorityBoard`
- source badge
- 优先级条目

### 路径 4：Parent 微绘本主线

#### 起点

- `/parent`

#### 操作

1. 在 Parent 首页先展示“今日成长小故事”
2. 点击“打开今日微绘本”，进入 `/parent/storybook?child=c-1`
3. 展示 3 幕 storybook、scene 状态和按钮
4. 点一次播放 / 预览按钮

#### 页面表现

- `StoryBookViewer`
- 3 幕场景与 scene 状态
- image / audio 状态
- provider / fallback 标识

#### AI 在做什么

- 把成长亮点、会诊和干预卡提炼成故事
- 把今晚任务和情绪价值放到家长愿意看的入口

#### 亮点

- wow factor 最强
- 很适合在录屏后半段形成记忆点
- 可以自然过渡到“家长愿意看完，再去执行”

#### fallback 怎么讲

- “微绘本当前允许规则 / 资产 / media fallback，所以这里我们讲成可展示 wow factor，不把它讲成图像 / 配音上游 fully live。”

#### 镜头里必须保留

- 3 幕切换
- image 状态
- audio 状态
- provider / fallback 标识

### 路径 5：Parent 趋势线主线

#### 起点

- `/parent/agent?child=c-1`

#### 操作

1. 从微绘本页返回 Parent Agent
2. 点一条趋势快捷问题
3. 展示 `trendLabel`、`source`、`dataQuality`、`warnings`
4. 把镜头给到 `TrendLineChart`
5. 最后停在反馈入口，说明今夜动作闭环

#### 页面表现

- 趋势回复卡
- `trendLabel`
- `source`
- fallback badge
- `dataQuality`
- `warnings`
- `TrendLineChart`
- 反馈入口

#### AI 在做什么

- 把 7 / 14 / 30 天趋势聚合成可解释回答
- 把家长从“看懂”引导到“今晚做什么”
- 把家长反馈回流到下一轮上下文

#### 亮点

- 同时具备“可解释”和“行动闭环”
- 能把家长端从 wow factor 拉回到真实任务执行
- 与 Teacher / consultation / Admin 形成完整闭环

#### fallback 怎么讲

- “如果结果来自 `demo_snapshot`，画面里必须保留 `fallback`、`dataQuality.fallbackUsed=true` 和 `warnings`，不装作真实机构数据。”
- “Parent trend 当前必须走 FastAPI brain，不是本地就能完整跑的链路。”

#### 镜头里必须保留

- `trendLabel`
- `source`
- `dataQuality`
- `warnings`
- `TrendLineChart`
- 反馈入口

## 答辩讲述模式

### 0:00 - 0:20 开场

- “托育场景最难的不是有没有数据，而是老师没有时间整理、园长不知道先处理谁、家长不知道今晚具体做什么。”
- “我们做的不是一个托育后台，而是一个移动端优先的 SmartChildcare Agent。”

### 0:20 - 0:45 为什么是 Agent

- “因为托育工作不是一次性问答，而是一条连续工作流。”
- “它需要记录、判断、建议、执行、反馈、复查不断接力。”
- “所以我们用三端闭环来设计，而不是只做一个 AI 聊天框。”

### 0:45 - 1:10 第一展示位：Teacher 语音主线

- “老师先用语音入口把现场观察快速变成结构化草稿。”
- “这一步强调的是低成本记录，而不是增加老师的输入负担。”

### 1:10 - 1:40 最强链路：高风险会诊

- “如果系统识别到高风险，就进入多 Agent 会诊。”
- “会诊不是只出一段文字，而是直接给出教师动作、家长今夜任务和园长决策卡。”

### 1:40 - 2:00 第二展示位：Admin 决策区

- “园长端不再只是看报表，而是优先看今天最该处理的会诊和风险优先级。”
- “这让会诊结果真正进入机构级决策，而不是停留在教师页面。”

### 2:00 - 2:20 家长 wow factor：微绘本

- “家长首页不是冰冷报表，而是把成长亮点、会诊和今晚任务压缩成 3 幕微绘本。”
- “这一步的作用是让家长愿意看、看得懂、接得住。”

### 2:20 - 2:40 家长闭环：趋势线与反馈

- “看完故事后，家长还可以继续追问 7、14、30 天趋势，并在今晚执行后直接反馈。”
- “这样老师第二天不是重新开始，而是继续沿着上一轮上下文往下走。”

### 2:40 - 3:00 vivo 能力映射与保守边界

- “我们把 vivo 能力映射到真实产品入口，而不是只停留在概念上。”
- “但当前只宣称代码层接入与 smoke/test/演示基础，不夸大成 fully live。”
- “staging 也仍处于 freeze 前收口阶段，不写成 fully switched。”

## 收尾一句话

- “我们现在已经把教师记录、AI 会诊、园长决策、家长理解与家长执行反馈收束成 5 条能录屏、能答辩、能继续交接的主链；当前对 live 与 staging 的边界也保持保守，不夸大。”
