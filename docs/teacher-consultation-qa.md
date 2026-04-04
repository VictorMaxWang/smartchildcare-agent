# Teacher Consultation QA

适用页面：`/teacher/high-risk-consultation`

目标：在不改 consultation SSE contract、不改主叙事、不重写 provider / memory 的前提下，为高风险会诊提供一套轻量联调与答辩前检查入口。

## 先看什么

联调时先看 4 个信号：

1. `loading / streaming / done` 是否按预期变化
2. 三阶段 `long_term_profile -> recent_context -> current_recommendation` 是否完整
3. `providerTrace` 与 `memoryMeta` 是否可见
4. `done.result` 合法时是否落到最终结果卡；不合法时是否被前端拦住

## 真实 SSE Walkthrough

真实主路径：

- URL：`/teacher/high-risk-consultation?trace=debug`
- 注意：不要带 `traceCase`

操作步骤：

1. 打开 teacher 高风险会诊页，切到 `调试态`
2. 选择儿童，保留现有教师补充输入
3. 点击“一键生成会诊”

预期看到：

- trace 先进入 `连接中`，随后变为 `会诊进行中`
- 三阶段依次展开：
  - `长期画像`
  - `最近会诊 / 最近快照`
  - `当前建议`
- 页面可见 `providerTrace`
- 页面可见 `memoryMeta`
- `done.result` 合法后：
  - 出现 sync targets
  - 出现最终会诊结论
  - 出现今晚家庭干预卡

这条路径走真实 consultation SSE 主链，不是静态假数据。

## 5 个 Debug Case

这些 case 都是前端演练，不会发起真实故障注入。

### 1. Provider fallback

- URL：`/teacher/high-risk-consultation?trace=debug&traceCase=fallback`
- 类型：前端演练
- 预期：
  - provider fallback 可见
  - 主内容仍完整
  - 不把 memory 问题混成同一个 case

### 2. Empty memory

- URL：`/teacher/high-risk-consultation?trace=debug&traceCase=empty-memory`
- 类型：前端演练
- 预期：
  - 有明确“暂无历史记忆命中”文案
  - 会诊故事线仍能继续展示

### 3. SSE partial

- URL：`/teacher/high-risk-consultation?trace=debug&traceCase=partial`
- 类型：前端演练
- 预期：
  - SSE 在 `当前建议` 阶段提前结束
  - 已收到的 `长期画像 / 最近会诊` 内容被保留
  - 总体状态显示为 `部分结果`

### 4. Invalid done.result

- URL：`/teacher/high-risk-consultation?trace=debug&traceCase=invalid-result`
- 类型：前端演练
- 预期：
  - 可见 `done.result` 缺字段提示
  - 不写 consultation store
  - 不写 intervention card
  - 不创建 reminder
  - 不出现最终同步落点

### 5. Backend error / unavailable consultation response

- URL：`/teacher/high-risk-consultation?trace=debug&traceCase=error`
- 类型：前端演练
- 预期：
  - 错误状态可见
  - 页面不崩
  - trace 仍可继续查看

## 固定断言

每次联调至少确认以下 5 点：

1. partial 时保留已收到的阶段内容
2. empty memory 有明确文案
3. provider fallback 可见但不淹没主内容
4. invalid done.result 不写 store、不建 reminder
5. error 状态可见且不导致页面崩掉

## 真实链路 vs 前端演练

- 真实链路：
  - `/teacher/high-risk-consultation?trace=debug`
  - 不带 `traceCase`
  - 走真实 consultation SSE 主链

- 前端演练：
  - `/teacher/high-risk-consultation?trace=debug&traceCase=...`
  - 由本地 trace fixture 驱动
  - 目的是快速验证 UI 承载与边界状态，不代表真实后端故障注入

## 可选后端验证

如果需要在 staging 或本地后端联调前额外确认 SSE：

```powershell
$env:PYTHONPATH='backend'
pytest backend/tests/test_high_risk_consultation_stream.py
```

后端服务启动后，还可以跑：

```powershell
py scripts/consultation_sse_smoke.py --runner local-source -- --base-url http://127.0.0.1:8000 --memory-check best-effort
```

用途：

- 确认 consultation SSE 至少能返回 `status / text / ui / done`
- 确认 memory source 与 trace source 可见
- 确认第二次请求能读到前一次写入的 snapshot / trace
