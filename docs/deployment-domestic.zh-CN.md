# UST Buddy 国内部署预案

最后更新：2026-06-08

本文是 UST Buddy 面向中国大陆用户可访问部署的中文预案。它只记录方案、步骤和风险，不修改业务逻辑、API、Admin UI、Supabase 表结构或任何 provider key。

## 执行摘要

UST Buddy 当前部署在 Vercel + Supabase，并依赖 MiniMax、Jina 等外部模型服务。中国大陆用户访问时可能需要 VPN，原因不是单点问题，而是多个链路都可能不稳定：

- Vercel 前端和 SSR/API 路由可能访问慢或不可达。
- Supabase Hosted API、Postgres、pgvector RPC 位于国际网络，可能延迟高或连接失败。
- MiniMax、Jina、DeepSeek 等模型 API 从不同网络环境访问表现可能不同。
- Admin Import 的图片解析、URL 解析、metadata 生成和 embedding 都依赖服务端出站访问。

推荐分阶段实施：

1. 保留当前 Vercel + Supabase 作为国际生产基线和回滚路径。
2. 将 TanStack Start SSR 运行时部署到国内可访问的 Serverless 或容器运行环境。
3. 在运行时前面接国内 CDN 和自定义 HTTPS 域名。
4. 第一轮 smoke test 仍然使用当前 Supabase。
5. 如果 Supabase 延迟不可接受，再考虑国内自托管 Supabase 或兼容 pgvector 的国内 Postgres 数据面。
6. 使用 `app_config` / `modelRouter` 切换 provider/model/env-var 名称，不在业务代码里硬编码。

不要把项目改回普通静态 Vite SPA。UST Buddy 需要 SSR/API 路由，因为 `/api/chat`、`/api/admin/*`、Supabase service role key、模型 API key 和 Admin Token 校验都必须留在服务端。

## 当前架构与国内访问风险

| 层级 | 当前状态 | 国内风险 | 影响 |
| --- | --- | --- | --- |
| 前端和 SSR | Vercel TanStack Start SSR | Vercel 域名或边缘节点可能慢或不可达 | 用户打不开 `/chat` 或 API 路由 |
| API 路由 | `/api/chat`、`/api/admin/*` 在 Vercel SSR 上 | Vercel 访问风险 + 服务端 provider 出站风险 | Chat/Admin 失败或超时 |
| 数据库 | Supabase Hosted API + Postgres + pgvector RPC | 国际 API 延迟或连接不稳定 | 检索、后台列表、导入、日志写入变慢或失败 |
| Chat LLM | 当前通过配置使用 MiniMax | provider endpoint 从国内运行时访问表现不确定 | 回答生成失败 |
| Metadata LLM | 导入 metadata 生成 | provider endpoint 访问不稳定 | Admin parse/import 降级 |
| Image Parser | MiniMax API-vlm 或 OCR fallback | VLM endpoint 或图片 URL fetch 可能失败 | 图片/长图导入失败 |
| Embedding | Jina-compatible provider | Jina API 可能慢或被阻断 | 新 chunks 无法及时生成 embedding，vector search 质量下降 |
| Admin 安全 | 共享 Admin Token | 如果日志/UI 泄露 token，会有知识库写入风险 | 后台安全风险 |

## 推荐架构

### 第一阶段目标

先把 App Runtime 放到国内，同时暂时保留当前数据面：

```text
中国大陆用户
  -> 国内 CDN / 自定义 HTTPS 域名
  -> 国内 SSR Runtime（阿里云 FC / 腾讯云 SCF / 华为 FunctionGraph / 容器）
  -> 当前 Supabase
  -> MiniMax / Jina / 其他已配置 provider
```

为什么这是第一步：

- 可以先区分“页面访问问题”和“数据库/provider 出站问题”。
- 代码改动最小。
- 当前 Supabase 继续作为可回滚的 source of truth。
- 所有密钥仍然留在服务端环境变量里。

### 第二阶段目标

如果 Supabase 仍然太慢，再迁移数据面：

```text
中国大陆用户
  -> 国内 CDN / 自定义 HTTPS 域名
  -> 国内 SSR Runtime
  -> 国内 self-host Supabase 或兼容 pgvector 的 Postgres
  -> 国内可访问的模型 provider
```

这一步是更大的迁移，因为当前代码使用 Supabase HTTP API、service role key 和 RPC。

## 方案矩阵

| 方案 | Runtime | 静态资源 | 数据库 | 适合场景 | 优点 | 缺点 |
| --- | --- | --- | --- | --- | --- | --- |
| A. 阿里云优先 | Function Compute Web Function 或容器 | OSS + CDN | 先保留 Supabase，后续 ECS self-host Supabase 或 RDS Postgres | 第一轮认真国内化 | OSS/CDN/FC 成熟，ICP备案路径清晰，Web Function 可转发 HTTP 到自定义 server | ICP 和控制台配置需要手动，Nitro 打包需要验证，第一阶段数据面仍在国外 |
| B. 腾讯云优先 | SCF Web Function 或容器 | COS + CDN | 先保留 Supabase，后续 CVM self-host 或 TencentDB Postgres | 阿里云替代方案 | 国内网络覆盖好，COS/CDN/SCF 常见 | 冷启动、Node SSR 兼容、multipart upload 限制需要测试 |
| C. 华为云优先 | FunctionGraph 或容器 | OBS + CDN | 先保留 Supabase，后续 RDS/Postgres | 企业/华为生态 | 企业场景适配强 | TanStack/Nitro 打包和 pgvector 方案需要更多验证 |
| D. 香港/新加坡 Runtime + CDN | Vercel/HK/SG runtime + CDN | CDN cache | 当前 Supabase | 作品集 demo fallback | 运维最简单，可能绕开部分大陆托管合规复杂度 | 不能保证国内免 VPN 访问 |
| E. Cloudflare China Network | 现有 runtime + Cloudflare 中国网络 | Cloudflare/JD Cloud 中国网络 | 当前或迁移后数据面 | 企业级部署 | 全球 + 中国边缘网络能力强 | 企业合约、ICP 和中国区 onboarding，过重 |

## 推荐第一版实施：阿里云或腾讯云

如果团队已有阿里云资源，优先选阿里云 Function Compute + OSS + CDN。如果团队已有腾讯云资源，优先选腾讯云 SCF + COS + CDN。

UST Buddy 的 runtime 需要支持：

- Node.js 执行环境。
- 能运行 Nitro server entry，通常是 `node .output/server/index.mjs`。
- Admin Import 的 multipart 上传。
- 服务端 HTTPS 出站访问 Supabase 和模型 provider。
- 服务端环境变量保存密钥。
- 图片解析、URL 导入等任务需要足够 timeout 和 memory。

## 部署步骤

## 1. 部署前准备

手动完成：

- 选择第一家国内云：阿里云、腾讯云或华为云。
- 选择域名或子域名，例如 `cn.ustbuddy.example.com` 或 `ustbuddy.example.cn`。
- 完成云账号实名。
- 如果使用大陆基础设施或大陆 CDN，启动 ICP 备案。
- 决定 Admin 路由是否需要 IP allowlist。
- 决定第一轮公开测试是否使用独立子域名，而不是直接替换当前 Vercel 域名。

可自动化：

- 执行 `npm run build`。
- 打包 `.output`。
- 导出脱敏后的环境变量清单。
- 备份当前 Supabase schema 和数据。
- 导出当前 `app_config` rows。
- 部署前运行 `npm run check:secrets`。

打包前推荐本地检查：

```bash
npm run check:secrets
npm run build
npm run test:model-router
npm run test:retrieval
```

## 2. 环境变量配置

真实值只能配置在云运行环境的环境变量控制台里。不要把真实 key 放进 `app_config`、Git、前端代码或 CDN 配置。

常用变量：

```text
ADMIN_IMPORT_TOKEN
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY

MINIMAX_API_KEY
MINIMAX_BASE_URL
MINIMAX_MODEL

IMAGE_PARSE_PROVIDER
IMAGE_PARSE_MODEL
MINIMAX_VLM_API_KEY
MINIMAX_VLM_BASE_URL
MINIMAX_VLM_ENDPOINT

EMBEDDING_PROVIDER
EMBEDDING_API_KEY
EMBEDDING_BASE_URL
EMBEDDING_MODEL
EMBEDDING_DIMENSIONS

SEMANTIC_DUPLICATE_THRESHOLD
RAG_DEBUG
HTTPS_PROXY
HTTP_PROXY
```

Smoke test 建议：

- `RAG_DEBUG=false`。
- 不要提前配置代理变量，除非运行时确实需要。
- `app_config` 只保存 provider/model/env-var 名称。
- Admin Token 要足够长、随机，并且不要出现在公开 README 或 demo 文案中。

## 3. 构建与打包

可自动化：

```bash
npm install
npm run build
```

预期输出：

```text
.output/public
.output/server
```

运行时启动命令通常是：

```bash
node .output/server/index.mjs
```

不同云函数/容器 runtime 的启动方式不同，必须在目标平台验证。

## 4. 部署 SSR Runtime

### 阿里云 Function Compute

手动完成：

- 创建 Function Compute service 和 Web Function/custom runtime。
- 上传 `.output` 和运行所需依赖，或使用容器镜像。
- 配置 HTTP trigger 或 custom domain。
- 配置 memory 和 timeout，Admin 图片/URL 解析建议先给更高 timeout。
- 在 Function Compute 控制台配置环境变量。

后续可自动化：

- build package。
- 上传 package。
- 更新 function version/alias。
- smoke test custom domain。

注意：

- Function Compute Web Function 可以把 HTTP 请求转给自定义 runtime HTTP server，适合 SSR server 形态。
- OSS 可以托管静态资源，CDN 可以缓存静态资源，但 UST Buddy 本体仍然需要 SSR/API runtime。

### 腾讯云 SCF

手动完成：

- 创建 SCF Web Function，或使用容器/function URL 风格部署。
- 配置 Node runtime/custom runtime 或容器镜像。
- 配置 function URL/API Gateway/custom domain。
- 在 SCF 控制台配置环境变量。
- 根据 Admin Import 设置 memory/timeout。

后续可自动化：

- build package。
- 部署 function/container。
- 更新 alias/version。
- smoke test domain。

注意：

- 腾讯云 SCF 支持 Web Function、自定义域名、环境变量、Node.js 和框架部署路径。
- 正式用于后台前，必须测试 Markdown/DOCX/Image multipart upload 限制。

### 华为云 FunctionGraph

手动完成：

- 创建 FunctionGraph function 或容器运行时。
- 配置 HTTP trigger/API Gateway。
- 绑定 custom domain 和 HTTPS。
- 配置环境变量和出站网络权限。

如果团队已有华为云账号或机构要求使用华为云，可以选此方案。

## 5. 静态资源与 CDN 策略

方案 1，第一版更简单：

- `.output/public` 仍由 SSR runtime 提供。
- CDN 放在前面。
- 只缓存静态资源路径。

方案 2，更优化：

- 上传 `.output/public` 到 OSS/COS/OBS/七牛 Kodo。
- 国内 CDN 指向对象存储。
- 静态资源路径走对象存储，动态路径走 SSR runtime。

CDN 缓存规则：

- hashed static assets 可以长缓存。
- 不缓存 `/api/*`。
- 不缓存 `/admin/*`。
- 不缓存 SSR HTML，除非有明确的失效策略。
- 开启 HTTPS 和 HTTP-to-HTTPS redirect。

注意：

- 不要把 secret 或 server output 放进对象存储。
- 对象存储只放公开静态资源。
- 阿里云 OSS 静态网站托管只能处理静态资源；服务端动态路由仍然必须走 Function Compute 或其他 backend。

## 6. DNS / ICP / HTTPS

手动完成：

- 大陆托管域名/CDN 按要求完成 ICP 备案。
- 配置 DNS：
  - `cn.ustbuddy.example.com` -> CDN 或 runtime custom domain。
  - 可选 `static.ustbuddy.example.com` -> OSS/COS/OBS/Kodo 上的 CDN。
- 签发和绑定 HTTPS 证书。
- 开启 HTTPS redirect。
- 配置 CDN origin routing：
  - 静态路径 -> 对象存储或 runtime static origin。
  - `/api/*`、`/admin/*`、`/chat`、`/` -> SSR runtime。

安全建议：

- 对 `/api/admin/*` 使用 WAF/CDN 规则。
- 如果管理员 IP 稳定，可以给 `/admin/*` 增加 IP allowlist。
- 给 `/api/chat` 和 parse endpoints 加 rate limit。
- 不要在客户端 bundle 或 HTML 中暴露环境变量。

## 7. 数据库策略

### 短期：保留当前 Supabase

用于验证“页面和 API 入口国内可访问”是否已经解决主要问题。

检查：

- `/api/chat` covered question。
- `/api/chat` not-covered question。
- `/admin/documents` list。
- `/admin/import` 小 Markdown 导入。
- `question_logs` best-effort insert。

风险：

- Supabase Hosted API 从国内 runtime 访问仍可能慢或不可达。

### 中期：国内 self-host Supabase

如果需要保持 Supabase HTTP API 兼容，这是更稳的迁移方向。

手动完成：

- 在国内云 ECS/CVM/VM 上部署。
- 使用 Supabase self-hosting stack。
- 按需配置 Postgres、PostgREST、auth/storage 等组件。
- 启用 pgvector。
- 执行项目 SQL：
  - `supabase/app-config.sql`
  - `supabase/question-logs-observability.sql`
  - `supabase/deduplication.sql`
  - `supabase/semantic-duplicate-review.sql`
  - pgvector `match_document_chunks` RPC
  - 如使用 duplicate review，也要部署对应 RPC。
- 恢复 `documents`、`document_chunks`、`question_logs` 和 `app_config`。

可自动化：

- dump/restore scripts。
- SQL migration scripts。
- 使用 `npm run embed:chunks` 补齐缺失 embeddings。

风险：

- self-host Supabase 需要运维：备份、升级、日志、TLS、防火墙和监控。

### 长期：国内托管 PostgreSQL

只有当团队愿意重构数据访问层时再考虑。

原因：

- 当前代码使用 `@supabase/supabase-js`、Supabase HTTP API、service role key 和 RPC 语义。
- 直接换普通 Postgres 可能需要 direct SQL client 或内部 data API layer。

## 8. 模型 API 策略

使用现有 `app_config` 和 `modelRouter`：

- `chat_llm`：用户端回答生成。
- `metadata_llm`：导入 metadata 生成。
- `image_parser`：MiniMax API-vlm 或 OCR fallback。
- `embedding`：Jina-compatible provider 或未来国内 embedding provider。

第一版建议：

- 如果国内 runtime 可访问 MiniMax，则继续使用 MiniMax text 和 image parser。
- Jina 只有在可访问且稳定时继续使用。
- 只有确实需要时，才在服务端配置 `HTTPS_PROXY` / `HTTP_PROXY`。
- 如果 Jina 不稳定，可以从可访问网络离线生成 embedding，再同步 vectors 到国内数据库。
- 如果后续使用 DeepSeek 或其他国内 provider 做 chat/metadata，要通过 provider/router/config 接入，不要写死在 route 里。

手动完成：

- 在 runtime 环境变量里配置真实 provider key。
- 在 `/admin/settings` 只保存 provider/model/env-var 名称。
- 从部署后的 runtime 测试每个 provider。

可自动化：

```bash
npm run test:model-config
npm run test:model-router
npm run test:embedding
npm run test:vector-search
npm run test:retrieval
```

## 9. 防火墙与网络安全

入站：

- 公网只开放 HTTPS，并通过 CDN/custom domain 进入。
- 数据库端口不要公网开放。
- Admin routes 使用 `ADMIN_IMPORT_TOKEN`，必要时增加 IP 规则。

出站：

- 允许 runtime 访问：
  - Supabase 或国内 data endpoint。
  - MiniMax / 模型 provider endpoints。
  - Embedding provider endpoint。
  - Admin URL Import 输入的外部 URL，并继续保留现有 SSRF 防护。
- 记录 provider/network 失败日志，但不要打印 API key。

Secrets：

- `SUPABASE_SERVICE_ROLE_KEY`、provider API keys、proxy credentials 和 Admin Token 只放服务端 runtime 环境变量。
- 不要把真实 key 存入 Supabase `app_config`。
- 不要在 Admin Settings 展示真实 key。

## 10. 测试计划

至少从以下网络测试：

- 中国大陆手机网络。
- 中国大陆家庭宽带或校园网。
- 香港或国际网络。

功能检查：

- `/` 不用 VPN 可加载。
- `/chat` 不用 VPN 可加载。
- 命中知识库的问题能返回 grounded answer 和去重 sources。
- 未覆盖问题返回 `当前知识库没有覆盖这个问题。`
- `/api/chat` 的浏览器 network response 不暴露 provider keys。
- `/admin/import` 必须要求 Admin Token。
- Markdown import 能解析并导入小文档。
- DOCX import 能解析并填表。
- Web URL Import 会拒绝 localhost/private/internal URL。
- Image import 要么成功，要么返回清晰 provider/OCR 错误。
- `/admin/documents` 能显示 documents 和 chunk counts。
- `/admin/settings` 能加载配置且不显示真实 API key。
- `question_logs` 能 best-effort 写入。

检索检查：

- `npm run test:retrieval` pass rate 稳定。
- `npm run test:hybrid-stability` top chunk 顺序稳定。
- `npm run test:vector-search` 返回预期 metadata 字段。
- `document_chunks.embedding` 非空数量符合预期。

性能检查：

- 从大陆网络首屏加载时间。
- `/api/chat` latency，尽量区分 retrieval time 和 LLM time。
- 产品负责人定义 p95 chat latency 目标。
- Admin image/DOCX/Web URL 导入 timeout 行为可接受。

安全检查：

- `/api/admin/*` 不带 `x-admin-token` 返回 401。
- CDN 不缓存 `/api/*` 或 `/admin/*`。
- HTML、JS bundle、network response 中没有 API key。
- Service role key 只存在于服务端 runtime 环境变量。

## 11. 回滚方案

- 国内部署通过所有检查前，保留 Vercel 部署不变。
- 第一版使用单独国内测试子域名。
- 国内数据面验证前，当前 Supabase 继续作为 source of truth。
- 数据迁移前备份 Supabase。
- 回滚方式：DNS 切回 Vercel，或关闭国内 CDN route。
- 云平台保留上一版 runtime version/alias。

## 手动操作 vs 可自动化

手动操作：

- 云账号实名。
- ICP 备案。
- 域名购买/所有权验证。
- DNS 和证书审批。
- Runtime 选型与第一次控制台配置。
- 在云环境变量控制台录入 secrets。
- 数据库迁移审批。
- 生产切流。

可自动化：

- `npm install`。
- `npm run build`。
- artifact packaging。
- static asset upload。
- function/container deployment。
- review 后执行 SQL migration。
- retrieval/model test scripts。
- CDN cache invalidation。

## 决策

推荐第一步：

1. 将 `.output` SSR app 部署到阿里云 Function Compute 或腾讯云 SCF。
2. 前面接国内 CDN 和自定义 HTTPS 域名。
3. 第一轮 smoke test 仍然保留当前 Supabase。
4. 如果 Supabase latency 不可接受，再迁移到国内 self-host Supabase。
5. 使用 `app_config` 和环境变量切换 provider，不暴露 secrets。

暂时避免：

- 把 TanStack Start SSR 改成静态 SPA。
- 在没有数据访问层重构计划的情况下，把 Supabase 替换成普通 Postgres。
- 将 service role key、Admin Token 或模型 key 暴露给前端。
- 增加公开用户上传。
- 增加公开实时 web search。
- 使用绕过平台访问限制的爬虫或代理技巧。

## 参考资料

- Alibaba Cloud OSS static website hosting: https://www.alibabacloud.com/help/en/oss/user-guide/hosting-static-websites
- Alibaba Cloud Function Compute web functions: https://www.alibabacloud.com/help/en/functioncompute/fc/user-guide/web-functions
- Tencent Cloud Serverless Cloud Function: https://www.tencentcloud.com/document/product/583
- Huawei Cloud FunctionGraph documentation: https://support.huaweicloud.com/intl/en-us/functiongraph/index.html
- Supabase self-hosting: https://supabase.com/docs/guides/self-hosting
- Supabase pgvector/vector columns: https://supabase.com/docs/guides/ai/vector-columns
- Cloudflare China Network: https://developers.cloudflare.com/china-network/
- DeepSeek API docs: https://api-docs.deepseek.com/
