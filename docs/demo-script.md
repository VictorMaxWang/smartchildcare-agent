# T13A Demo Script 总控

适用目标：

- 比赛录屏
- 现场答辩
- 团队交接

本脚本只覆盖当前已经具备展示基础的 4 条主线，不新增功能、不扩写 staging、不把 fallback 讲成真链路验收。

## 录屏前检查

- 前端：`npm run dev`
- 后端：`py -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000`
- 环境：`$env:BRAIN_API_BASE_URL = "http://127.0.0.1:8000"`
- 账号：只使用 demo account
- 保密：不要在录屏、截图、日志里出现真实 `VIVO_APP_ID` / `VIVO_APP_KEY`
- 页面顺序固定：
  1. `/teacher`
  2. `/teacher/high-risk-consultation`
  3. `/admin`
  4. `/parent`
  5. `/parent/storybook?child=...`
  6. `/parent/agent?child=...`

## 推荐总时长

- 录屏版：4 到 6 分钟
- 答辩口头版：2.5 到 3.5 分钟

## 路径 1：Teacher 语音入口主线

### 起点页面

- `/teacher`

### 演示操作

1. 先停留在 Teacher 首页，让评委看到异常儿童、待复查、待沟通家长和快捷入口
2. 点击或长按全局语音入口
3. 录入一段教师观察
4. 展示结构化草稿和 warnings
5. 跳转到 `/teacher/agent` 看草稿确认

### AI 在做什么

- 把老师的语音 / 文本观察转成 transcript
- 做 understanding
- 生成 T5 draft seed
- 给出下一步草稿确认入口

### 页面会出现什么

- 语音层状态切换
- transcript / understanding
- warnings
- 草稿源
- 教师 Agent 页中的草稿确认入口

### 亮点是什么

- 老师不需要先写完整记录
- 主链更像手机助手，而不是复杂后台
- “先捕捉，再确认”很适合移动端与录屏

### fallback 时怎么诚实讲

- “这里我们保证的是结构化草稿链路可演示，ASR live upstream 还没有写成 fully verified。”

## 路径 2：高风险会诊主线

### 起点页面

- `/teacher/high-risk-consultation`

### 演示操作

1. 选择一个高风险儿童
2. 补充教师说明，必要时加图片 / 语音占位
3. 点击一键生成会诊
4. 让镜头完整经过 stage 推进
5. 结果页停留在 summary card、48 小时复查和 intervention card
6. 若需答辩补充，可用 `?trace=debug` 展示 `providerTrace` 与 `memoryMeta`

### AI 在做什么

- 合并长期画像、最近上下文和当前风险信号
- 组织多 Agent 分阶段推理
- 输出教师动作、家长今夜任务和园长决策卡

### 页面会出现什么

- `long_term_profile -> recent_context -> current_recommendation` 的推进
- summary card
- follow-up card
- intervention card
- explainability / trace 信息

### 亮点是什么

- 当前最强 Agent workflow
- 同时展示 memory、trace、SSE、结构化结果
- 能自然串到 Admin 和 Parent

### fallback 时怎么诚实讲

- “如果这里显示 `next-stream-fallback` 或 demo trace，我们只把它当成页面级 fallback，不把它讲成远端 brain 已完成验收。”

## 路径 3：Admin 决策区主线

### 起点页面

- `/admin`

### 演示操作

1. 先停留在首页 hero stats
2. 重点展示“今日重点会诊 / 高风险优先事项”
3. 读一到两个优先级条目
4. 必要时进入 `/admin/agent` 展示周报或 follow-up 入口

### AI 在做什么

- 把 consultation 结果压缩成园长能执行的优先级
- 给出 explainability 线索
- 帮园长从“看报表”切换到“先处理谁”

### 页面会出现什么

- `RiskPriorityBoard`
- source badge
- 优先级条目
- Agent / 周报入口

### 亮点是什么

- 它把会诊结果转成机构级行动
- 这是高风险会诊之后的第二展示位
- 适合答辩时讲“从单个孩子到机构决策”

### fallback 时怎么诚实讲

- “如果这里出现 local fallback，说明展示层复用了现有 consultation 结果，不代表 T9C 或远端聚合已经 fully 打通。”

## 路径 4：Parent 趋势线 / 微绘本主线

### 起点页面

- `/parent`

### 演示操作

1. 在 Parent 首页先展示“今日成长小故事”
2. 点击“打开今日微绘本”，进入 `/parent/storybook?child=...`
3. 展示 3 幕 storybook、scene 状态和按钮
4. 回到 `/parent/agent?child=...`
5. 点一条趋势快捷问题
6. 展示 `trendLabel`、`source`、`dataQuality`、`warnings` 和 `TrendLineChart`
7. 结尾收在反馈入口，说明今夜动作闭环

### AI 在做什么

- 把成长亮点、会诊和干预卡提炼成故事
- 把 7 / 14 / 30 天趋势聚合成可解释回答
- 把家长从“看懂”引导到“今晚做什么”

### 页面会出现什么

- `StoryBookViewer`
- 3 幕场景与 scene 状态
- 趋势回复卡
- `TrendLineChart`
- `source`
- `dataQuality`
- `warnings`

### 亮点是什么

- wow factor 最强
- 同时具备“情感呈现”和“行动闭环”
- 很适合在录屏结尾形成记忆点

### fallback 时怎么诚实讲

- “微绘本允许规则 / 资产 fallback，所以这部分我们讲成可展示资产，不讲成图像 / 配音上游 fully live。”
- “如果趋势结果来自 `demo_snapshot`，画面里必须保留 `fallback`、`dataQuality.fallbackUsed=true` 和 `warnings`，不装作真实机构数据。”

## 收尾一句话

- “我们现在已经把教师记录、AI 会诊、园长决策和家长执行反馈收束成 4 条能录屏、能答辩、能继续交接的主链；当前对 live 与 staging 的边界也保持保守，不夸大。”
