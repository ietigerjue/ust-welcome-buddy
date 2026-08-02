# Deployment Checklist

Use this checklist for internal deployments only. Do not paste real domains, API keys, tokens, or service role keys into this file.

## GitHub

- Repository is private.
- Collaborators have the minimum necessary permissions.
- Branch protection is enabled for the main branch when the team is ready.
- Secret scanning and push protection are enabled if available.
- `.env.local`, `.env`, and `.env.*.local` are not tracked.

## Vercel

- Project access is limited to authorized collaborators.
- Framework preset: TanStack Start or Other if needed.
- Build command: `npm run build`.
- Output directory: `.output`.
- Root directory: repository root.
- Environment variables are configured for production and preview as needed.
- No real API keys are committed to Git or stored in `app_config`.

## Supabase

- Project access is limited to authorized collaborators.
- Service role key is server-side only.
- SQL setup has been applied:
  - `supabase/app-config.sql`
  - `supabase/question-logs-observability.sql`
  - documents/chunks schema
  - pgvector extension and `match_document_chunks` RPC
- Row-level policies and service role usage are reviewed before broader team access.

## Model Providers

- Text LLM env vars are configured.
- Image parser/VLM env vars are configured if image import is needed.
- Embedding env vars are configured if vector search or embedding rebuilds are needed.
- Provider billing limits and usage dashboards are reviewed.

## Admin

- `ADMIN_IMPORT_TOKEN` is configured and shared only through a secure channel.
- `/admin/import` rejects an invalid token.
- `/admin/documents` rejects an invalid token.
- `/admin/settings` rejects an invalid token.

## Smoke Tests

- `npm run build` succeeds locally or in CI.
- `/chat` returns a grounded answer for a covered question.
- `/chat` returns `当前知识库没有覆盖这个问题。` for an uncovered question.
- `/admin/import` can parse content and import after admin confirmation.
- `/admin/documents` lists the imported document.
- `npm run test:retrieval` passes at an acceptable rate for current data.

## Mainland Access Note

Mainland-friendly deployment is not automatic. Review `docs/deployment-domestic.md` before changing runtime, CDN, domain, ICP, or provider routing. Keep Vercel/Supabase as a rollback path until domestic runtime tests are complete.
