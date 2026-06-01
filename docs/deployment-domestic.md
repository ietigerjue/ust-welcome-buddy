# Mainland China Deployment Plan

Last updated: 2026-06-01

This document is a deployment pre-plan for making UST Buddy usable by students in Mainland China. It does not change business logic. It explains the current risks, recommended architecture, rollout steps, and test checkpoints.

## Current Problem

UST Buddy currently runs as a TanStack Start SSR app on Vercel with Supabase, MiniMax, and Jina-related model calls. Mainland users may need a VPN because several layers can be slow or unavailable:

- Vercel frontend and SSR/API routes may be blocked or unstable from Mainland networks.
- Supabase hosted API and Postgres endpoints are international and may have high latency from Mainland China.
- Jina embedding API and some model endpoints may need proxy routing from Mainland networks.
- Admin image, URL, and metadata parsing all depend on server-side outbound access to external providers.

## Recommended Direction

Use a staged domestic deployment rather than a one-shot migration.

### Stage 0 - Keep Current International Deployment

Keep Vercel + Supabase as the canonical production environment.

Use this while preparing:

- ICP filing and domain setup.
- Domestic cloud account and security configuration.
- Database backup/export flow.
- Provider fallback choices.

This stage is low risk but does not solve Mainland access.

### Stage 1 - Domestic App Runtime, Existing Supabase

Deploy the TanStack Start SSR runtime inside Mainland China, while temporarily keeping Supabase international.

Recommended stack:

- App runtime: Alibaba Cloud Function Compute Web Function or Tencent Cloud SCF.
- CDN and domain: Alibaba Cloud CDN or Tencent Cloud CDN.
- Static assets: served by the SSR runtime first; optionally move `.output/public` assets to OSS/COS later.
- Database: keep current Supabase first.
- Model providers: keep existing env-driven providers, but test from the domestic runtime.

Pros:

- Minimal app changes.
- Users hit a domestic app endpoint.
- Admin Token and server-side API keys remain server-only.

Cons:

- `/api/chat` still depends on backend-to-Supabase international connectivity.
- Supabase latency can still affect chat response time.
- Model provider egress must be tested from the domestic region.

This is the best first production experiment.

### Stage 2 - Domestic Data Plane

Move or mirror the knowledge base and logs into a domestic data plane.

Preferred choices:

- Self-host Supabase on a domestic ECS/CVM with Docker Compose if compatibility with `@supabase/supabase-js`, PostgREST, and RPC is important.
- Use domestic managed PostgreSQL with pgvector support if direct Postgres access is acceptable. This likely requires app code changes because the current app uses Supabase HTTP APIs and service role keys.
- Keep Vercel/Supabase as the international primary and run domestic as a mirror until cutover is proven.

Pros:

- `/api/chat` no longer depends on international Supabase APIs.
- pgvector Hybrid Search can run closer to Mainland users.
- More control over backups, networking, and observability.

Cons:

- Self-hosted Supabase has operational cost and does not include every managed Supabase feature.
- Managed PostgreSQL may require replacing Supabase client calls with direct SQL or a custom internal API layer.
- Embedding dimensions and RPC definitions must match the existing production schema exactly.

### Stage 3 - Domestic Model Provider Routing

Use `app_config` and `modelRouter` to select provider/model/env-var names without changing business code.

Options:

- Use MiniMax endpoints that are reachable from the domestic runtime.
- Keep Jina for embeddings only if domestic runtime can reach it reliably.
- Add a domestic embedding provider later if Jina is slow or blocked.
- Run embedding backfill offline from a network that can reach the provider, then deploy generated vectors to the domestic database.

Never put provider API keys in `app_config`. Store only env var names.

## Architecture Options

## Option A - Alibaba Cloud First

Recommended first domestic production plan.

Components:

- Domain and ICP: Alibaba Cloud ICP filing for a Mainland-hosted domain.
- Runtime: Alibaba Cloud Function Compute Web Function or custom runtime.
- CDN: Alibaba Cloud CDN in front of the app domain.
- Static assets: cache SSR static assets through CDN; optionally move `.output/public` to OSS.
- Database phase 1: existing Supabase.
- Database phase 2: self-hosted Supabase on ECS or Alibaba Cloud RDS PostgreSQL with pgvector-compatible migration work.

Why this fits UST Buddy:

- TanStack Start already builds a Node/Nitro SSR output under `.output`.
- Function Compute supports HTTP entry through web functions and custom domains.
- OSS supports static website hosting and CDN acceleration for frontend assets.
- Alibaba Cloud RDS PostgreSQL has documented AI/vector-related support, but exact pgvector version and RPC compatibility must be verified before migration.

Risks:

- ICP filing is manual and can take time.
- Nitro server packaging for Function Compute must be tested.
- If using managed PostgreSQL instead of Supabase, code changes are likely required.

## Option B - Tencent Cloud First

Similar to Option A, using Tencent Cloud services.

Components:

- Domain and ICP: Tencent Cloud ICP flow.
- Runtime: Tencent Cloud SCF or container service.
- CDN: Tencent Cloud CDN.
- Static assets: COS + CDN.
- Database: TencentDB for PostgreSQL or self-hosted Supabase on CVM.

Pros:

- Good Mainland network reach.
- COS/CDN/SCF are common for domestic web deployments.

Cons:

- Need to verify Node SSR server compatibility and cold start behavior.
- Need to verify pgvector support/version for the chosen PostgreSQL engine.
- Supabase compatibility may still require self-hosting rather than managed Postgres only.

## Option C - Hong Kong/Singapore Runtime With Mainland-Friendly CDN

Use Hong Kong or Singapore runtime plus CDN acceleration where available.

Pros:

- Avoids some ICP complexity if not serving from Mainland infrastructure.
- Easier operational model than a full domestic migration.

Cons:

- Does not guarantee access without VPN.
- Mainland CDN acceleration for a domain usually still involves compliance requirements.
- Supabase and model-provider latency remain a risk.

This is a fallback for a portfolio demo, not the strongest Mainland-user solution.

## Option D - Cloudflare China Network

Cloudflare China Network can improve Mainland delivery, but it is an Enterprise feature operated with JD Cloud.

Pros:

- Strong global + China edge story.
- Useful if the project becomes institutional or enterprise-backed.

Cons:

- Enterprise contract required.
- ICP and China-specific setup are still required.
- Overkill for a small portfolio project.

## Recommended Implementation Plan

## Phase 1 - Preparation

Manual:

- Choose a domain or subdomain, for example `ustbuddy.example.cn`.
- Complete real-name verification for the chosen domestic cloud account.
- Start ICP filing if hosting the site or CDN inside Mainland China.
- Decide whether the first test will use Alibaba Cloud or Tencent Cloud.
- Confirm whether the project can legally and operationally serve the intended audience from Mainland infrastructure.

Automatable:

- Run `npm run build` and archive `.output`.
- Export a list of required environment variables.
- Back up Supabase schema and data.
- Record current `app_config` rows.

Environment variables to inventory:

```env
ADMIN_IMPORT_TOKEN=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
MINIMAX_API_KEY=
MINIMAX_BASE_URL=
MINIMAX_MODEL=
IMAGE_PARSE_PROVIDER=
MINIMAX_VLM_API_KEY=
MINIMAX_VLM_BASE_URL=
MINIMAX_VLM_ENDPOINT=
EMBEDDING_PROVIDER=
EMBEDDING_API_KEY=
EMBEDDING_BASE_URL=
EMBEDDING_MODEL=
EMBEDDING_DIMENSIONS=
HTTPS_PROXY=
HTTP_PROXY=
```

Do not print or commit real values.

## Phase 2 - Deploy SSR Runtime

Manual:

- Create a Function Compute / SCF service.
- Use a Node.js runtime or custom runtime that can run the Nitro server.
- Configure memory, timeout, and concurrency. Start with higher memory for image/OCR/admin flows.
- Configure a custom domain and HTTPS certificate.
- Set environment variables in the cloud console.

Automatable:

- Build with `npm run build`.
- Package `.output`.
- Start command should point to the Nitro server entry, typically:

```bash
node .output/server/index.mjs
```

Verify this command in the target runtime because Function Compute/SCF startup conventions may differ.

Routing:

- `/api/*`: no CDN cache, always forward to SSR runtime.
- `/admin/*`: no CDN cache, always forward to SSR runtime.
- `/chat`, `/about`, `/`: SSR runtime, short or no HTML cache.
- `/assets/*` or equivalent static asset paths: long CDN cache after confirming emitted asset paths.

## Phase 3 - Static Asset Acceleration

Option 1, simpler:

- Serve static assets through the SSR runtime and cache them in CDN.

Option 2, more optimized:

- Upload `.output/public` to OSS/COS.
- Put CDN in front of OSS/COS.
- Use path-based CDN origin rules so static asset paths go to OSS/COS and SSR/API paths go to Function Compute/SCF.

Manual:

- Configure OSS/COS bucket.
- Configure custom CDN domain and HTTPS certificate.
- Configure cache rules and invalidation.

Automatable:

- Upload `.output/public` after build.
- Invalidate CDN cache after deploy.

## Phase 4 - Database Strategy

### Short-Term

Keep current Supabase and test domestic runtime to Supabase latency.

Checks:

- `/api/chat` covered question.
- `/api/chat` not-covered question.
- `/admin/documents` list.
- `/admin/import` import a small test document.
- `question_logs` best-effort insert.

### Medium-Term

Self-host Supabase on domestic ECS/CVM if Supabase API compatibility is needed.

Manual:

- Provision ECS/CVM and private network.
- Deploy Supabase Docker Compose.
- Configure HTTPS and internal firewall rules.
- Apply project SQL:
  - documents / document_chunks schema
  - `supabase/app-config.sql`
  - `supabase/question-logs-observability.sql`
  - pgvector extension and `match_document_chunks` RPC
- Migrate data from current Supabase.

Automatable:

- Database dump/restore scripts.
- SQL migration scripts.
- Embedding backfill with `npm run embed:chunks`.

Important:

- Keep `document_chunks.embedding` dimensions aligned with `EMBEDDING_DIMENSIONS`.
- Re-run `npm run test:vector-search` and `npm run test:retrieval`.

### Long-Term

Move to domestic managed PostgreSQL only if the app is updated to use direct SQL or an internal data API.

This is not a no-code deployment change because current server code expects Supabase HTTP APIs.

## Phase 5 - Model Provider Strategy

Use the existing `app_config` and `modelRouter` shape:

- `chat_llm`: answer generation.
- `metadata_llm`: Markdown/WeChat/Image/Web URL metadata.
- `image_parser`: MiniMax API-vlm or OCR fallback.
- `embedding`: Jina or future domestic embedding provider.

Manual:

- Configure real API keys only in cloud environment variables.
- Use `/admin/settings` to save provider/model/env-var names only.
- Test whether the domestic runtime can reach each provider.

Automatable:

- `npm run test:model-config`
- `npm run test:model-router`
- `npm run test:embedding`
- `npm run test:vector-search`
- `npm run test:retrieval`

Fallback choices:

- If Jina is blocked or slow, generate embeddings offline from a reachable network and import them.
- If MiniMax VLM is slow, keep text imports operational and mark image import as admin-only best effort.
- If a provider requires proxy routing, configure `HTTPS_PROXY` / `HTTP_PROXY` server-side only.

## DNS, ICP, And HTTPS

Manual:

- Complete ICP filing before serving a Mainland-hosted domain.
- Configure DNS records:
  - `ustbuddy.example.cn` to CDN or Function Compute custom domain.
  - Optional `static.ustbuddy.example.cn` to CDN over OSS/COS.
- Issue and bind HTTPS certificates.
- Enable HTTP-to-HTTPS redirect.

Security:

- Keep admin pages private by obscurity plus Admin Token, but do not rely on obscurity alone.
- Add WAF or CDN rules for `/admin/*` and `/api/admin/*` if available.
- Consider IP allowlisting for admin routes if the admin team has stable IPs.
- Rate-limit `/api/chat` and admin parse endpoints.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY`, model API keys, or `ADMIN_IMPORT_TOKEN` to the browser.

## Firewall And Network Rules

Recommended:

- Allow public inbound HTTPS only through CDN/ALB/custom domain.
- Keep database ports private.
- Allow runtime outbound traffic only to:
  - Supabase or domestic Supabase/Postgres API endpoint.
  - MiniMax API endpoint.
  - Embedding provider endpoint.
  - Required image/OCR URL import destinations.
- Log outbound failures for provider debugging.

## Test Checkpoints

Run tests from at least three network locations:

- Mainland China mobile network.
- Mainland China campus or home broadband.
- Hong Kong or international network.

Functional checks:

- Public pages load without VPN.
- `/chat` loads and mobile layout is intact.
- Covered question returns a grounded answer with deduped sources.
- Uncovered question returns `当前知识库没有覆盖这个问题。`
- `/admin/import` requires Admin Token.
- Admin Markdown import parses and imports a small document.
- Admin Web URL Import rejects localhost/private URLs.
- Admin documents list loads and chunk counts are visible.
- `/admin/settings` loads config and does not show real API keys.
- `question_logs` still writes on a best-effort basis.

Performance checks:

- First page load under acceptable threshold from Mainland.
- `/api/chat` p95 latency under the chosen product target.
- Retrieval-only latency measured separately from LLM latency.
- Admin image parsing timeout is acceptable or clearly fails.

Data checks:

- `documents` count matches expected migration count.
- `document_chunks` count matches expected migration count.
- `document_chunks.embedding` non-null count matches expected vector coverage.
- `match_document_chunks` RPC returns expected fields.
- `npm run test:retrieval` pass rate is stable after migration.

Security checks:

- No API key appears in browser network responses.
- `/api/admin/*` returns 401 without `x-admin-token`.
- CDN does not cache `/api/*` or `/admin/*` responses.
- Service role key exists only in server environment variables.

## Rollback Plan

- Keep Vercel deployment unchanged until domestic deployment passes all checks.
- Keep current Supabase as the source of truth until domestic data plane is verified.
- Use DNS weighted routing or a separate subdomain first, for example `cn.ustbuddy.example.com`.
- Roll back by changing DNS back to the Vercel domain or disabling the domestic CDN route.
- Keep database exports before every migration.

## Decision Summary

Recommended first move:

1. Deploy the existing `.output` SSR app to Alibaba Cloud Function Compute or Tencent Cloud SCF.
2. Put a domestic CDN/custom domain in front.
3. Keep Supabase international for the first smoke test.
4. If Supabase latency is unacceptable, migrate to self-hosted Supabase in Mainland China.
5. Use `/admin/settings` and environment variables to switch providers without exposing secrets.

Avoid for now:

- Rewriting the app into a static-only SPA.
- Replacing Supabase with plain Postgres without a planned data-access refactor.
- Exposing service role keys or model keys to the frontend.
- Adding public user upload or public web search.
- Using crawler/proxy tricks to bypass provider or platform access restrictions.

## References

- Alibaba Cloud OSS static website hosting: https://www.alibabacloud.com/help/en/oss/user-guide/overview-71/
- Alibaba Cloud Function Compute web functions: https://www.alibabacloud.com/help/en/functioncompute/fc/user-guide/web-functions
- Alibaba Cloud Function Compute custom domains: https://www.alibabacloud.com/help/en/fc/configure-a-custom-domain-name
- Alibaba Cloud ICP filing scenarios: https://www.alibabacloud.com/help/en/icp-filing/faq-about-icp-filing-applications-in-different-scenarios
- Supabase self-hosting: https://supabase.com/docs/guides/self-hosting
- Supabase vector columns and pgvector: https://supabase.com/docs/guides/ai/vector-columns
- pgvector project: https://github.com/pgvector/pgvector
- Cloudflare China Network overview: https://developers.cloudflare.com/china-network/
