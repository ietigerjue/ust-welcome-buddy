# UST Buddy Subagent Task Board

This board tracks upcoming subagent work. Backlog tasks should remain implementation-ready but not over-specified with permanent provider names.

## Backlog

## In Progress

- None.

## Done

- Task A - Added Supabase `app_config` SQL, `src/lib/appConfig.ts`, environment fallback behavior, and `npm run test:app-config`.
- Task B - Added `src/lib/modelRouter.ts`, routed existing provider calls through it, and added `npm run test:model-router`.
- Task C - Added `/admin/settings`, `/api/admin/config`, Admin Token protection, non-secret config validation/upsert, and `npm run test:admin-config`.
- Task D - Added `scripts/testModelConfig.ts` and `npm run test:model-config` for safe app_config/modelRouter configuration QA without real model calls.
- Task E - Added `/api/admin/parse-url`, Web URL Import in `/admin/import`, SSRF safeguards, and `npm run test:url-parse`.
- Task G - Added `docs/deployment-domestic.md` with a Mainland China deployment pre-plan covering domestic CDN/SSR runtime, data-plane, model-provider, security, rollback, and test checkpoints.
- Task H - Added Word / DOCX import with `mammoth`, `/api/admin/parse-docx`, admin DOCX upload UI, metadata fallback, and `npm run test:docx-parse`.
- Task J - Added exact normalized hash duplicate handling for documents/chunks, import-time warnings, Hybrid Search content dedupe, `supabase/deduplication.sql`, and `npm run test:dedupe`.
- Task K - Added semantic duplicate review for parsed imports, `match_duplicate_chunks` RPC SQL, admin duplicate candidate display, `SEMANTIC_DUPLICATE_THRESHOLD`, and `npm run test:semantic-dedupe`.
- Initial Subagent workflow documentation.
