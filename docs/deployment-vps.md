# SmartChildcare Agent 腾讯云香港 VPS Staging 部署

本文件只覆盖本轮主线部署方案：

- 服务器：腾讯云香港轻量服务器 Linux VPS
- 公网 IP：`150.109.77.178`
- 域名：`api-staging.smartchildcare.cn`
- 拓扑：`docker-compose.yml` + `Caddyfile`
- 前端：继续留在 Vercel 或现有前端部署平台

本轮边界：

- 不修改 consultation 叙事逻辑。
- 不修改 SSE contract 字段名和事件语义。
- 不修改 backend 业务路由。
- 不在任何代码、文档、日志、示例里写入真实 `VIVO_APP_ID` / `VIVO_APP_KEY`。
- 凡是涉及 vivo 接入事实，以官方文档为准：[vivo 官方文档](https://aigc.vivo.com.cn/#/document/index?id=1746)。

## 1. 部署结构

staging 只启动两个容器：

- `backend`：FastAPI backend，镜像来自 `backend/Dockerfile`
- `caddy`：公网入口、HTTPS 终止、SSE 友好的反向代理

流量路径：

1. 浏览器继续访问前端站点。
2. 前端服务端桥接仍走 `BRAIN_API_BASE_URL`。
3. `BRAIN_API_BASE_URL` 指向 `https://api-staging.smartchildcare.cn`。
4. Caddy 反代到容器网络内的 `backend:8000`。

为什么保持这条路径：

- 不需要改现有前端 `/api/ai/*` 调用方式。
- 不会碰 consultation 业务逻辑。
- 方便直接对 backend 域名做 health、provider、SSE、memory 校验。

## 2. 服务器准备

部署前确认：

- 可 SSH 登录服务器。
- 安全组或防火墙已开放 `22`、`80`、`443`。
- 服务器已安装 Docker 与 Docker Compose。
- 仓库实际工作根目录为 `childcare-smart/`。

可选安装检查：

```bash
docker --version
docker compose version
```

SSH 示例：

```bash
ssh root@150.109.77.178
```

或：

```bash
ssh ubuntu@150.109.77.178
```

## 3. 域名 A 记录

新增 A 记录：

- `api-staging.smartchildcare.cn -> 150.109.77.178`

注意：

- Caddy 自动 HTTPS 依赖 DNS 正常解析到服务器。
- `http://150.109.77.178` 只用于手工排障。
- 前端正式环境不要依赖 IP 地址，仍只依赖域名。

## 4. 仓库与根目录 `.env.release`

部署目录示例：

```bash
mkdir -p ~/apps
cd ~/apps
git clone <your-repo-url> smartchildcare-agent
cd smartchildcare-agent/childcare-smart
```

本轮 compose 只读取根目录 `.env.release`：

- 使用：`./.env.release`
- 不使用：`backend/.env.release`

如果服务器上还没有根目录 `.env.release`，先复制：

```bash
cp .env.release.example .env.release
```

至少补齐这些 backend 运行变量：

```env
APP_NAME=SmartChildcare Agent Brain
APP_VERSION=0.1.0
ENVIRONMENT=staging
LOG_LEVEL=INFO
API_V1_PREFIX=/api/v1
APP_HOST=0.0.0.0
APP_PORT=8000
PORT=8000
ALLOW_ORIGINS=https://your-vercel-staging.vercel.app,https://your-frontend.example.com
ENABLE_MOCK_PROVIDER=false
BRAIN_PROVIDER=vivo
BRAIN_TIMEOUT_MS=20000
REQUEST_TIMEOUT_SECONDS=20
VIVO_APP_ID=replace-on-server-only
VIVO_APP_KEY=replace-on-server-only
VIVO_BASE_URL=https://api-ai.vivo.com.cn
VIVO_LLM_MODEL=Volc-DeepSeek-V3.2
VIVO_OCR_PATH=/ocr/general_recognition
VIVO_EMBEDDING_MODEL=m3e-base
BRAIN_MEMORY_BACKEND=sqlite
BRAIN_MEMORY_SQLITE_PATH=/data/agent-memory.db
MYSQL_URL=
```

前端桥接相关变量也放在同一份根目录 `.env.release`：

```env
BRAIN_API_BASE_URL=https://api-staging.smartchildcare.cn
NEXT_PUBLIC_BACKEND_BASE_URL=
BRAIN_API_TIMEOUT_MS=20000
```

说明：

- `ALLOW_ORIGINS` 填真实前端域名，不要只保留占位值。
- `RELEASE_BASE_URL`、`RELEASE_ADMIN_COOKIE`、`CRON_SECRET` 这类 release gate 变量如果服务器不用远程校验，可以先保留占位；backend 容器不会依赖它们启动。
- 真实 vivo 密钥只写服务器本地 `.env.release`，不要提交 git。

## 5. 启动 Staging

先做静态展开检查：

```bash
docker compose config
```

启动：

```bash
docker compose up -d --build
```

查看状态：

```bash
docker compose ps
```

预期服务：

- `smartchildcare-backend-staging`
- `smartchildcare-caddy-staging`

## 6. 查看日志

backend 日志：

```bash
docker compose logs -f backend
```

caddy 日志：

```bash
docker compose logs -f caddy
```

重新构建并重启：

```bash
docker compose up -d --build
```

停止：

```bash
docker compose down
```

## 7. Health 检查

部署文档统一使用 `/api/v1/health` 作为健康检查路径。

外部检查：

```bash
curl https://api-staging.smartchildcare.cn/api/v1/health
```

容器内检查：

```bash
docker compose exec backend python -c "import json, urllib.request; print(json.load(urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health'))['status'])"
```

这个检查能证明：

- backend 进程已启动
- 路由前缀正常
- 当前 memory backend 已被识别
- 健康响应可被 Caddy 反代出去

这个检查不能证明：

- vivo 上游调用一定成功
- consultation SSE 一定能穿过整条链路

## 8. Provider 验证

先做 vivo LLM smoke：

```bash
python3 scripts/vivo_llm_smoke.py --runner docker --strict
```

如果失败，优先检查：

- `VIVO_APP_ID`
- `VIVO_APP_KEY`
- 服务器外网访问能力
- vivo 官方文档要求是否有变更：[vivo 官方文档](https://aigc.vivo.com.cn/#/document/index?id=1746)

如果只是临时 demo fallback，可在服务器本地 `.env.release` 暂时切：

```env
ENABLE_MOCK_PROVIDER=true
```

但要明确这是 staging/demo fallback，不是最终长期方案。

## 9. Consultation SSE 验证

先跑容器内 smoke：

```bash
python3 scripts/consultation_sse_smoke.py --runner docker --base-url http://127.0.0.1:8000 --memory-check best-effort
```

再跑外部 raw SSE：

```bash
curl -N -H "Accept: text/event-stream" -H "Content-Type: application/json" \
  -X POST https://api-staging.smartchildcare.cn/api/v1/agents/consultations/high-risk/stream \
  -d '{
    "targetChildId":"stage-demo-child",
    "teacherNote":"need stream verification on staging",
    "currentUser":{"id":"teacher-stage","name":"Stage Teacher","className":"Sunshine"},
    "visibleChildren":[{"id":"stage-demo-child","name":"Stage Demo Child"}],
    "presentChildren":[{"id":"stage-demo-child","name":"Stage Demo Child"}],
    "healthCheckRecords":[],
    "growthRecords":[],
    "guardianFeedbacks":[],
    "debugMemory":true
  }'
```

验证目标：

- 事件是逐步到达，而不是长时间无输出后一次性返回。
- 连接能正常结束，不被代理提前截断。
- 当前 consultation 金链路仍保持既有字段名和事件语义。

本轮只验证传输，不调整任何 SSE contract。

## 10. 前端如何切换 backend base URL

前端仍通过服务端桥接访问 backend，不改浏览器侧主调用方式。

相关桥接代码：

- `lib/server/brain-client.ts`
- `app/api/ai/high-risk-consultation/route.ts`
- `app/api/ai/high-risk-consultation/stream/route.ts`
- `app/api/ai/stream/route.ts`

前端部署平台至少设置：

```env
BRAIN_API_BASE_URL=https://api-staging.smartchildcare.cn
```

保持为空，除非你明确需要 UI 上显示 backend 源：

```env
NEXT_PUBLIC_BACKEND_BASE_URL=
```

重要提醒：

- 只测前端页面不够，因为 Next.js 有 fallback 逻辑。
- backend 真正可用，必须直接测 `api-staging.smartchildcare.cn` 的 health 和 consultation SSE。

## 11. SQLite / Memory Fallback 风险

本轮 staging 推荐：

```env
BRAIN_MEMORY_BACKEND=sqlite
BRAIN_MEMORY_SQLITE_PATH=/data/agent-memory.db
```

当前处理方式：

- SQLite 文件放在容器内 `/data/agent-memory.db`
- 由 compose 命名卷 `backend_data` 持久化

为什么这是最小可行方案：

- 单机 staging 简单直接
- 容器重建后只要卷还在，数据仍可保留
- 足够支撑 demo / staging 的 memory context 验证

风险与边界：

- 只适合单机单实例
- 不适合长期多用户或高并发 memory
- 不是最终生产级统一 memory 方案
- 如果卷被删，SQLite 数据会一起丢失

未来若切 MySQL：

```env
BRAIN_MEMORY_BACKEND=mysql
MYSQL_URL=mysql://user:password@host:3306/database
```

## 12. 最小命令清单

```bash
ssh root@150.109.77.178
cd ~/apps/smartchildcare-agent/childcare-smart
cp .env.release.example .env.release
vim .env.release
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs -f backend
docker compose logs -f caddy
curl https://api-staging.smartchildcare.cn/api/v1/health
python3 scripts/vivo_llm_smoke.py --runner docker --strict
python3 scripts/consultation_sse_smoke.py --runner docker --base-url http://127.0.0.1:8000 --memory-check best-effort
```

## 13. 仍需人工完成

- 腾讯云安全组或防火墙开放 `22`、`80`、`443`
- `api-staging.smartchildcare.cn` 的 A 记录指向 `150.109.77.178`
- 服务器根目录 `.env.release` 填入真实 `VIVO_APP_ID` / `VIVO_APP_KEY`
- 前端部署平台设置 `BRAIN_API_BASE_URL=https://api-staging.smartchildcare.cn`
