# Mainland China Deployment Plan

Last updated: 2026-06-03

Chinese version: `docs/deployment-domestic.zh-CN.md`.

This document is a deployment pre-plan for making UST Buddy usable by students in Mainland China. It is documentation only: it does not change business logic, API behavior, Admin UI, Supabase schema, or provider keys.

## Executive Summary

UST Buddy currently runs on Vercel + Supabase and depends on several external model services. Mainland China users may need a VPN because the user-facing app, SSR API routes, Supabase API, embedding API, and model APIs can each become a network bottleneck.

Recommended rollout:

1. Keep Vercel + Supabase as the international production baseline.
2. Deploy the TanStack Start SSR runtime to a Mainland-friendly serverless or container runtime.
3. Put a domestic CDN/custom domain in front of the runtime.
4. Keep Supabase international for the first smoke test.
5. If Supabase latency is unacceptable, move to self-hosted Supabase or a compatible domestic Postgres data plane.
6. Use `app_config` / `modelRouter` to switch model providers or env-var names without changing business code.

Do not rewrite the app into a plain static SPA. UST Buddy needs SSR/API routes because `/api/chat`, `/api/admin/*`, Supabase service role keys, MiniMax/Jina keys, and Admin Token validation must remain server-side.

## Current Architecture And Access Risks

| Layer | Current state | Mainland risk | Impact |
| --- | --- | --- | --- |
| Frontend and SSR | Vercel TanStack Start SSR | Vercel domain or edge may be slow/unreachable | Users cannot load `/chat` or API routes |
| API routes | `/api/chat`, `/api/admin/*` on Vercel SSR | Same as Vercel plus provider egress | Chat/Admin fail or timeout |
| Database | Supabase hosted API + Postgres + pgvector RPC | International API latency or connectivity instability | Retrieval, admin list/import, logs degrade |
| Chat LLM | Configured text provider, currently MiniMax | Provider endpoint reachability varies by region | Answer generation fails |
| Metadata LLM | Same provider layer as text metadata | Provider endpoint reachability varies | Admin parse/import metadata degrades |
| Image Parser | MiniMax API-vlm or OCR fallback | VLM endpoint or image URL fetch may fail | Image/long screenshot import degrades |
| Embedding | Jina-compatible provider | Jina API may be slow or blocked from Mainland runtime | New chunks may not get embeddings; vector search quality drops |
| Admin security | Shared Admin Token | Token leakage risk if logs/UI expose it | Knowledge base write risk |

## Recommended Architecture

### Phase 1 Target

Use a domestic runtime for the app while keeping the data plane unchanged:

```text
Mainland user
  -> Domestic CDN / custom HTTPS domain
  -> Domestic SSR runtime (Alibaba FC / Tencent SCF / Huawei FunctionGraph / container)
  -> Current Supabase
  -> MiniMax / Jina / other configured providers
```

Why this is the best first step:

- It tests whether the biggest pain is app delivery or data/provider egress.
- It keeps code changes minimal.
- It keeps current Supabase as the rollback-safe source of truth.
- It preserves server-side secret handling.

### Phase 2 Target

If Supabase is still too slow:

```text
Mainland user
  -> Domestic CDN / custom HTTPS domain
  -> Domestic SSR runtime
  -> Domestic Supabase self-host or compatible Postgres + pgvector
  -> Domestic-reachable model providers
```

This is a larger migration because the current code uses Supabase HTTP APIs, service role keys, and RPC calls.

## Option Matrix

| Option | Runtime | Static assets | Database | Best for | Pros | Cons |
| --- | --- | --- | --- | --- | --- | --- |
| A. Alibaba Cloud first | Function Compute Web Function or container | Alibaba OSS + CDN | Start with Supabase, later self-host Supabase/ECS or RDS Postgres | First serious Mainland rollout | Mature CDN/OSS/FC stack, clear ICP path, web functions can forward HTTP to a custom server | ICP/manual setup, Nitro packaging must be tested, data plane still international at first |
| B. Tencent Cloud first | SCF Web Function or container | COS + CDN | Start with Supabase, later CVM/self-host or TencentDB Postgres | Alternative Mainland rollout | SCF supports web-function style deployments and framework examples, good domestic network | Cold starts and Node SSR compatibility need testing, Supabase compatibility may require self-hosting |
| C. Huawei Cloud first | FunctionGraph or container | OBS + CDN | Start with Supabase, later RDS/Postgres plan | Enterprise/Huawei ecosystem | Viable serverless path, strong domestic enterprise footprint | More verification needed for TanStack/Nitro packaging and pgvector strategy |
| D. HK/Singapore runtime + CDN | Vercel/HK/SG runtime plus CDN | CDN cache | Current Supabase | Portfolio demo fallback | Easiest operational path, may avoid Mainland hosting compliance | Does not guarantee VPN-free Mainland access |
| E. Cloudflare China Network | Existing runtime behind Cloudflare China | Cloudflare/JD Cloud China network | Current or migrated | Enterprise-backed deployment | Strong global + China edge option | Enterprise/commercial setup, ICP and China onboarding still required |

## Recommended First Implementation: Alibaba Or Tencent

Choose Alibaba Cloud if the team already uses Alibaba Cloud or wants the OSS + CDN + Function Compute path. Choose Tencent Cloud if the team already uses Tencent Cloud or prefers SCF/COS.

For UST Buddy, the runtime must support:

- Node.js execution.
- Running the Nitro server entry, usually `node .output/server/index.mjs`.
- Multipart uploads for Admin Import.
- Server-side outbound HTTPS to Supabase and model providers.
- Environment variables stored server-side only.
- Enough timeout and memory for image parsing and URL import.

## Deployment Steps

## 1. Pre-Deployment Preparation

Manual:

- Choose the first domestic cloud: Alibaba Cloud, Tencent Cloud, or Huawei Cloud.
- Choose a domain or subdomain, for example `cn.ustbuddy.example.com` or `ustbuddy.example.cn`.
- Complete account real-name verification.
- Start ICP filing if the site is hosted through Mainland infrastructure or Mainland CDN.
- Decide whether Admin routes should be IP-restricted.
- Decide whether the first public test is a separate subdomain instead of replacing the existing Vercel domain.

Automatable:

- Run `npm run build`.
- Package `.output`.
- Export a redacted environment variable inventory.
- Back up current Supabase schema and data.
- Export current `app_config` rows.
- Run `npm run check:secrets` before deploying artifacts.

Required local checks before packaging:

```bash
npm run check:secrets
npm run build
npm run test:model-router
npm run test:retrieval
```

## 2. Environment Variables

Configure real values only in the runtime provider's environment variable console. Never put real keys in `app_config`, Git, frontend code, or CDN config.

Required or commonly needed:

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

Recommended values for deployment smoke test:

- `RAG_DEBUG=false`.
- Do not configure proxy variables unless the runtime actually needs them.
- Keep `app_config` storing only provider/model/env-var names.
- Keep Admin Token long, random, and separate from any public README/demo text.

## 3. Build And Package

Automatable:

```bash
npm install
npm run build
```

Expected output:

```text
.output/public
.output/server
```

The runtime start command usually points at:

```bash
node .output/server/index.mjs
```

Verify this command in the chosen serverless/container runtime because each provider has its own startup convention.

## 4. Deploy SSR Runtime

### Alibaba Cloud Function Compute

Manual:

- Create a Function Compute service and web function/custom runtime.
- Upload the packaged `.output` plus required `node_modules`/runtime files, or use a container image if packaging is easier.
- Configure an HTTP trigger or custom domain.
- Configure memory and timeout. Start with a higher timeout for admin image/URL parsing.
- Add environment variables in the Function Compute console.

Automatable later:

- Build package.
- Upload package.
- Update function version/alias.
- Smoke test custom domain.

Notes:

- Alibaba Function Compute web functions can forward HTTP requests to a custom runtime HTTP server, which matches the SSR server shape.
- Alibaba OSS can host static assets and Alibaba CDN can cache them, but UST Buddy itself should remain SSR/API-capable.

### Tencent Cloud SCF

Manual:

- Create an SCF web function or use a container/function URL style deployment.
- Configure Node runtime/custom runtime or container image.
- Configure function URL/API Gateway/custom domain.
- Add environment variables in the SCF console.
- Set memory/timeout with Admin Import in mind.

Automatable later:

- Build package.
- Deploy function/container.
- Update alias/version.
- Smoke test domain.

Notes:

- Tencent SCF documents include web-function management, custom domain, environment variables, Node.js and framework deployment paths.
- Test multipart upload limits with Markdown/DOCX/Image import before using it for admin operations.

### Huawei Cloud FunctionGraph

Manual:

- Create a FunctionGraph function or containerized runtime.
- Configure HTTP trigger/API Gateway.
- Bind custom domain and HTTPS.
- Add environment variables and outbound network permissions.

Use this if the team already has Huawei Cloud accounts or institutional constraints point that way.

## 5. Static Asset And CDN Strategy

Option 1, simpler first release:

- Serve `.output/public` through the SSR runtime.
- Put CDN in front.
- Cache static asset paths only.

Option 2, optimized:

- Upload `.output/public` to OSS/COS/OBS/Qiniu Kodo.
- Put domestic CDN in front of object storage.
- Route static asset paths to object storage and dynamic paths to SSR runtime.

CDN cache rules:

- Cache hashed static assets aggressively.
- Do not cache `/api/*`.
- Do not cache `/admin/*`.
- Do not cache SSR HTML unless you have a controlled invalidation strategy.
- Enable HTTPS and HTTP-to-HTTPS redirect.

Important:

- Do not store secrets or server output in object storage.
- Object storage should contain public static assets only.
- If using Alibaba OSS static website hosting, remember it is static-only; server-side dynamic routes must still go to Function Compute or another backend.

## 6. DNS, ICP, And HTTPS

Manual:

- Complete ICP filing for Mainland-hosted domains/CDN where required.
- Configure DNS:
  - `cn.ustbuddy.example.com` -> CDN or runtime custom domain.
  - Optional `static.ustbuddy.example.com` -> CDN over OSS/COS/OBS/Kodo.
- Issue and bind HTTPS certificates.
- Enable HTTPS redirect.
- Configure CDN origin routing:
  - Static paths -> object storage or runtime static asset origin.
  - `/api/*`, `/admin/*`, `/chat`, `/` -> SSR runtime.

Security:

- Use WAF/CDN rules for `/api/admin/*`.
- Consider IP allowlisting for `/admin/*` if admins have stable IPs.
- Rate-limit `/api/chat` and parse endpoints.
- Do not expose environment variables in client-side bundles or HTML.

## 7. Database Strategy

### Short-Term: Keep Current Supabase

Use this to test whether app delivery alone solves most of the user access problem.

Checks:

- `/api/chat` covered question.
- `/api/chat` not-covered question.
- `/admin/documents` list.
- `/admin/import` small Markdown import.
- `question_logs` best-effort insert.

Risk:

- Supabase hosted API may still be slow or unreachable from the domestic runtime.

### Medium-Term: Self-Hosted Supabase In Mainland China

Use this when Supabase HTTP API compatibility matters.

Manual:

- Provision ECS/CVM/VM in the domestic cloud.
- Deploy Supabase self-hosting stack.
- Configure Postgres, PostgREST, auth/storage components as needed.
- Enable pgvector.
- Apply project SQL:
  - `supabase/app-config.sql`
  - `supabase/question-logs-observability.sql`
  - `supabase/deduplication.sql`
  - `supabase/semantic-duplicate-review.sql`
  - pgvector `match_document_chunks` RPC
  - duplicate review RPC if used
- Restore `documents`, `document_chunks`, `question_logs`, and `app_config`.

Automatable:

- Dump/restore scripts.
- SQL migration scripts.
- `npm run embed:chunks` for missing embeddings.

Risk:

- Self-hosted Supabase needs operations: backups, upgrades, logs, TLS, firewall, and monitoring.

### Long-Term: Domestic Managed PostgreSQL

Use this only if the team is willing to refactor data access.

Reason:

- Current code uses `@supabase/supabase-js`, Supabase HTTP APIs, service role keys, and RPC semantics.
- A plain Postgres move may need direct SQL clients or an internal data API layer.

## 8. Model API Strategy

Use existing `app_config` and `modelRouter`:

- `chat_llm`: user answer generation.
- `metadata_llm`: import metadata extraction.
- `image_parser`: MiniMax API-vlm or OCR fallback.
- `embedding`: Jina-compatible provider or future domestic embedding provider.

Recommended first setup:

- Keep MiniMax for text and image parser if reachable from the domestic runtime.
- Keep Jina for embeddings only if reachable and stable.
- Use `HTTPS_PROXY` / `HTTP_PROXY` server-side only if needed.
- If Jina is unstable, generate embeddings from a reachable network and sync vectors to the domestic database.
- If DeepSeek or another domestic provider is adopted for chat or metadata later, add it through provider/router/config instead of hardcoding it in routes.

Manual:

- Configure real provider keys as runtime env vars.
- Use `/admin/settings` to store provider/model/env-var names only.
- Test each provider from the deployed runtime.

Automatable:

```bash
npm run test:model-config
npm run test:model-router
npm run test:embedding
npm run test:vector-search
npm run test:retrieval
```

## 9. Firewall And Network Security

Inbound:

- Public HTTPS only through CDN/custom domain.
- No direct public database ports.
- Admin routes protected by `ADMIN_IMPORT_TOKEN` and optionally IP rules.

Outbound:

- Allow runtime to reach:
  - Supabase or domestic data endpoint.
  - MiniMax / model provider endpoints.
  - Embedding provider endpoint.
  - Admin-provided URLs for URL import, with existing SSRF protections.
- Log provider/network failures without printing API keys.

Secrets:

- Store `SUPABASE_SERVICE_ROLE_KEY`, provider API keys, proxy credentials, and Admin Token only in server runtime env vars.
- Never store real keys in Supabase `app_config`.
- Never expose real keys in Admin Settings.

## 10. Testing Plan

Test from at least:

- Mainland China mobile network.
- Mainland China broadband or campus network.
- Hong Kong or international network.

Functional checks:

- `/` loads without VPN.
- `/chat` loads without VPN.
- A covered question returns a grounded answer with deduped sources.
- An uncovered question returns `当前知识库没有覆盖这个问题。`
- `/api/chat` does not expose provider keys in browser network responses.
- `/admin/import` requires Admin Token.
- Markdown import parses and imports a small document.
- DOCX import parses and fills the form.
- Web URL import rejects localhost/private/internal URLs.
- Image import either succeeds or returns a clear provider/OCR error.
- `/admin/documents` lists documents and chunk counts.
- `/admin/settings` loads config and does not show real API keys.
- `question_logs` writes best-effort rows.

Retrieval checks:

- `npm run test:retrieval` pass rate remains stable.
- `npm run test:hybrid-stability` returns stable top chunk ordering.
- `npm run test:vector-search` returns expected metadata fields.
- `document_chunks.embedding` non-null count matches expected coverage.

Performance checks:

- First page load time from Mainland.
- `/api/chat` latency separated into retrieval time and LLM time where possible.
- p95 chat latency target chosen by the product owner.
- Admin import timeout behavior for image/DOCX/Web URL.

Security checks:

- `/api/admin/*` returns 401 without `x-admin-token`.
- CDN does not cache `/api/*` or `/admin/*`.
- No API key appears in HTML, JavaScript bundles, or network responses.
- Service role key exists only in server runtime environment.

## 11. Rollback Plan

- Keep Vercel deployment unchanged until domestic deployment passes all checks.
- Use a separate domestic test subdomain first.
- Keep current Supabase as the source of truth until the domestic data plane is verified.
- Back up Supabase before any migration.
- Roll back by changing DNS back to the Vercel deployment or disabling the domestic CDN route.
- Keep previous runtime version/alias available in the cloud console.

## Manual vs Automatable Work

Manual:

- Cloud account real-name verification.
- ICP filing.
- Domain purchase/ownership verification.
- DNS and certificate approval.
- Runtime selection and first console setup.
- Secret entry into cloud environment variable console.
- Database migration approval.
- Production cutover.

Automatable:

- `npm install`.
- `npm run build`.
- Artifact packaging.
- Static asset upload.
- Function/container deployment.
- SQL migration execution after review.
- Retrieval/model test scripts.
- CDN cache invalidation.

## Decision

Recommended first move:

1. Deploy `.output` SSR app to Alibaba Cloud Function Compute or Tencent Cloud SCF.
2. Put domestic CDN/custom HTTPS domain in front.
3. Keep current Supabase for the first smoke test.
4. If Supabase latency is unacceptable, migrate to self-hosted Supabase in Mainland China.
5. Use `app_config` and environment variables to switch providers without exposing secrets.

Avoid for now:

- Rewriting TanStack Start SSR into a static-only SPA.
- Replacing Supabase with plain Postgres without a data-access refactor.
- Exposing service role keys, Admin Token, or model keys to the frontend.
- Adding public user upload.
- Adding public real-time web search.
- Crawling or bypassing provider/platform access restrictions.

## References

- Alibaba Cloud OSS static website hosting: https://www.alibabacloud.com/help/en/oss/user-guide/hosting-static-websites
- Alibaba Cloud Function Compute web functions: https://www.alibabacloud.com/help/en/functioncompute/fc/user-guide/web-functions
- Tencent Cloud Serverless Cloud Function: https://www.tencentcloud.com/document/product/583
- Huawei Cloud FunctionGraph documentation: https://support.huaweicloud.com/intl/en-us/functiongraph/index.html
- Supabase self-hosting: https://supabase.com/docs/guides/self-hosting
- Supabase pgvector/vector columns: https://supabase.com/docs/guides/ai/vector-columns
- Cloudflare China Network: https://developers.cloudflare.com/china-network/
- DeepSeek API docs: https://api-docs.deepseek.com/
