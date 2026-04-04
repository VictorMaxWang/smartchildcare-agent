# VPS Smoke Runbook

适用场景：腾讯云香港轻量服务器 staging 部署完成后，对 SmartChildcare Agent backend 做最小联调验证。

边界：

- 本文只覆盖 smoke / QA 验证，不覆盖部署编排。
- 不改 consultation 叙事逻辑。
- 不改 SSE contract 字段名和事件语义。
- 真实 `VIVO_APP_ID` / `VIVO_APP_KEY` 只能通过环境变量注入，不写入代码、README、日志、截图或示例文件。

## 1. 先测 `/health`

命令：

```bash
curl -fsS https://api-staging.smartchildcare.cn/health
```

或直接跑聚合脚本：

```bash
BASE_URL=https://api-staging.smartchildcare.cn bash scripts/vps_smoke.sh
```

预期结果：

- 返回 `status: "ok"`
- 能看到 `providers.llm`
- 能看到 `configured_memory_backend`、`memory_backend`
- 能看到 `degraded`

失败代表什么：

- `curl` 失败：服务不可达、域名或代理未通
- `status != ok`：backend 不健康
- `degraded = true`：memory backend 有退化，不等于 consultation 必然失败，但需要记录

## 2. 再测 vivo LLM strict

命令：

```bash
python3 scripts/vivo_llm_smoke.py --runner docker --strict
```

本地源码模式：

```bash
python3 scripts/vivo_llm_smoke.py --runner local-source -- --strict
```

预期结果：

- `ok: true`
- `provider: "vivo-llm"`
- `source: "vivo"`
- `fallback: false`
- 至少出现 `usage` 或 `upstream_markers.id / upstream_markers.created`

失败代表什么：

- `kind: "config"`：`BRAIN_PROVIDER`、`VIVO_APP_ID`、`VIVO_APP_KEY` 配置不完整
- `kind: "auth"`：vivo 鉴权失败
- `kind: "network"` / `kind: "timeout"`：服务器到 vivo 上游网络异常
- `fallback: true`：走了兜底，不算 strict 通过

关键解释：

- `source=vivo` 才是真 provider
- `fallback=true` 代表兜底，只能用于排障，不算 staging strict 通过

## 3. 再测 consultation SSE

命令：

```bash
python3 scripts/consultation_sse_smoke.py --runner docker --base-url https://api-staging.smartchildcare.cn --memory-check best-effort --require-real-provider
```

如果要把 memory 命中也当成硬门槛：

```bash
python3 scripts/consultation_sse_smoke.py --runner docker --base-url https://api-staging.smartchildcare.cn --memory-check required --require-real-provider
```

预期结果：

- `ok: true`
- 至少收到 `status`、`text`、`ui`、`done`
- 阶段顺序包含：
  - `long_term_profile`
  - `recent_context`
  - `current_recommendation`
- 输出能看到：
  - `provider_source`
  - `provider_model`
  - `real_provider`
  - `fallback`
  - `memory_check`
  - `memory_used_sources`
  - `matched_snapshot_ids`
  - `matched_trace_ids`

失败代表什么：

- 缺少 `status/text/ui/done`：SSE contract 不完整或流被代理截断
- `real_provider=false` 或 `fallback=true`：会诊链路没走真 provider
- `memory_check=absent`：第二次 SSE 或 memory endpoint 没读到连续性上下文

关键解释：

- `next-fallback` 不是 backend 真链路，本轮 smoke 不以它为主目标
- `provider_source=vivo` 且 `real_provider=true` 才算会诊真 provider 联通

## 4. 最后做 teacher walkthrough

页面：

```text
/teacher/high-risk-consultation?trace=debug
```

人工验收至少确认：

- 页面可见 `providerTrace`
- 页面可见 `memoryMeta`
- 三阶段流可见
- 最终建议卡和 48 小时复查卡可见

这一步是产品态验收，不替代前面的自动化 smoke。

## 5. 聚合入口

推荐命令：

```bash
BASE_URL=https://api-staging.smartchildcare.cn \
CHILD_ID=stage-demo-child \
TIMEOUT=20 \
MEMORY_CHECK=best-effort \
REQUIRE_REAL_PROVIDER=1 \
bash scripts/vps_smoke.sh
```

预期汇总：

- `health: pass`
- `vivo_strict: real`
- `consultation_sse: pass`
- `memory: present` 或 `memory: absent`

说明：

- `memory: absent` 在 `MEMORY_CHECK=best-effort` 下只代表告警
- `MEMORY_CHECK=required` 时，memory 缺失会让脚本整体失败

## 6. 这套脚本如何帮助部署后联调

- 先用 `/health` 快速确认服务活性、provider 配置态和 memory backend 状态
- 再用 `vivo_llm_smoke.py` 把“真 vivo provider 是否通”单独打透
- 再用 `consultation_sse_smoke.py` 验证 consultation SSE、providerTrace、memoryMeta 是否可观测
- 最后人工 teacher walkthrough 只看产品感和 demo 闭环，不再承担底层排障
