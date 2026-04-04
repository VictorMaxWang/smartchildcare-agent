# VPS Smoke Runbook

适用场景：staging 部署完成后，验证 SmartChildcare Agent 是否满足“真 staging + 真 vivo + 真 memory + 真 SSE”。

边界：
- 不修改 consultation 的 stage 顺序和 SSE 事件名。
- 真实 `VIVO_APP_ID` / `VIVO_APP_KEY` 只允许通过环境变量注入。
- `/health` 只代表配置态，不代表 live vivo 已经生效。

## 1. 先看 health

命令：

```bash
curl -fsS https://api-staging.smartchildcareagent.cn/api/v1/health
```

关注字段：
- `status`
- `brain_provider`
- `llm_provider_selected`
- `provider_assertion_scope`
- `vivo_credentials_configured`
- `configured_memory_backend`
- `memory_backend`
- `degraded`

解释：
- `provider_assertion_scope=configuration_only` 是预期结果。
- 看到 `vivo_credentials_configured=true` 只能说明密钥存在，不能说明本次请求真的返回了 vivo。

## 2. 直连 vivo strict smoke

命令：

```bash
python3 scripts/vivo_llm_smoke.py --runner docker --strict
```

strict 通过条件：
- `brain_provider=vivo`
- `provider=vivo-llm`
- `provider_source=vivo`
- `provider_model` 非空
- `request_id` 非空
- `real_provider=true`
- `fallback=false`
- 至少一个 upstream marker 存在：`usage`、`upstream_markers.id`、`upstream_markers.created`

失败分类：
- `kind=config`：`BRAIN_PROVIDER` 或 vivo 密钥配置不完整
- `kind=auth`：vivo 鉴权失败
- `kind=network` / `kind=timeout`：到 vivo 上游的网络问题
- `kind=response`：上游返回异常或响应格式不满足 strict

## 3. consultation SSE strict smoke

命令：

```bash
python3 scripts/consultation_sse_smoke.py \
  --runner docker \
  --base-url https://api-staging.smartchildcareagent.cn \
  --memory-check required \
  --require-real-provider
```

strict 通过条件：
- SSE 事件包含 `status` / `text` / `ui` / `done`
- stage 顺序为：
  - `long_term_profile`
  - `recent_context`
  - `current_recommendation`
- 最终输出包含：
  - `brain_provider=vivo`
  - `provider_source=vivo`
  - `provider_model` 非空
  - `request_id` 非空
  - `real_provider=true`
  - `fallback=false`
  - `transport=fastapi-brain`
  - `memory_used_sources`
  - `matched_snapshot_ids`
  - `matched_trace_ids`

失败时重点看：
- `transport=next-stream-fallback`：页面跑通了，但不是远端 brain stream 真链路
- `provider_source != vivo`：不是 live vivo provider
- `real_provider=false`：provider 结果不满足真 live 判定
- `fallback=true`：走了 provider fallback 或 transport fallback
- `memory_check=absent`：没有读到连续性记忆

## 4. 聚合 smoke

命令：

```bash
BASE_URL=https://api-staging.smartchildcareagent.cn \
MEMORY_CHECK=required \
REQUIRE_REAL_PROVIDER=1 \
DOCKER_SERVICE=backend \
bash scripts/vps_smoke.sh
```

汇总输出至少要看到：
- `health: pass`
- `vivo_strict: real`
- `consultation_sse: pass`
- `transport: fastapi-brain`
- `memory: present`

## 5. 人工 teacher 验证

页面：

```text
/teacher/high-risk-consultation?trace=debug
```

至少确认：
- `providerTrace.source`
- `providerTrace.transport`
- `providerTrace.model`
- `providerTrace.requestId`
- `memoryMeta.usedSources`
- `memoryMeta.matchedSnapshotIds`
- `memoryMeta.matchedTraceIds`

判读规则：
- `fastapi-brain`：远端 brain 真链路
- `next-stream-fallback`：Next 本地兜底
- 只看到结果卡片，不能当作 staging 真链路已通过

## 6. 结论标准

只有当以下条件同时成立，才算 staging 真链路通过：
- 远端 health 可访问
- direct vivo strict 通过
- consultation SSE strict 通过
- transport 为 `fastapi-brain`
- memory check 为 `present`
