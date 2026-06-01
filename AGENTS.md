# AGENTS.md

This file defines the required workflow and project constraints for Codex / AI agents working on UST Buddy. Follow it before making any code, UI, API, database, deployment, or documentation change.

## Required Reading Before Code Changes

Before changing code, read these files in this order:

1. `docs/project-state.md`
2. `docs/change-log.md`
3. `docs/decisions.md`
4. `docs/model-config.md`
5. `README.md`

Use these documents as the current source of truth. If they conflict with old assumptions in the conversation, trust the documents and inspect the current code.

## Project Constraints

- Do not convert the project from TanStack Start SSR back to a plain Vite SPA.
- Do not expose model provider keys, embedding keys, Supabase service role keys, or admin tokens to the frontend.
- Do not remove `ADMIN_IMPORT_TOKEN` protection from admin pages or admin APIs.
- `question_logs` failures must never block or break `/api/chat`.
- Sources returned to the frontend must be deduplicated by document, not repeated per chunk.
- Admin import must not automatically write parsed content to Supabase. The admin must review and confirm Import.
- Normal users must not upload knowledge documents from the public chat UI.
- Do not hard-code provider API keys or service credentials.
- Do not hard-code provider or model names in business logic, API routes, or Admin UI.
- Chat answer generation, metadata extraction, image parsing, OCR/VLM, and embedding generation must be routed through provider/router/config layers.
- Provider/model configuration must come from the model provider layer, model router, environment variables, or future `app_config`.
- If model configuration is missing, return a clear error or use an explicit fallback. Do not fail silently.
- `question_logs` and future model usage logs should record the actual provider/model used when that information is available.
- Do not remove local Markdown knowledge files; they are seed and backup content.

## Required Task Flow

For every development task:

1. Read the required project documents listed above.
2. Inspect the relevant source files before deciding what to change.
3. Make small, scoped changes that match the existing architecture.
4. Run the narrowest useful verification first, then broader checks when risk is higher.
5. Report the modified files and the verification result.
6. Update `docs/project-state.md`, `docs/change-log.md`, and `docs/decisions.md` when the task changes project state, architecture, deployment, data flow, provider behavior, or technical decisions.
7. If the task changes AI provider behavior or model configuration, update `docs/model-config.md` as well.

If a task is documentation-only, do not modify business code or UI.

## Verification Expectations

- For TypeScript or server logic changes, run `npx tsc --noEmit --pretty false`.
- For deployment or SSR-sensitive changes, run `npm run build`.
- For embedding changes, prefer `npm run test:embedding` before `npm run embed:chunks`.
- For admin API changes, test token failure and success paths when possible.
- For chat retrieval changes, verify that no-source questions still return `当前知识库没有覆盖这个问题。`
- For provider/router/config changes, verify the missing-config path and the configured-provider path.

## Notes For Future Agents

- This project is intentionally small and portfolio-friendly. Prefer clear, boring implementation over large framework changes.
- When adding new providers, keep provider layers replaceable and configuration-driven.
- When adding new admin features, keep public navigation clean unless the user explicitly asks otherwise.
- When changing retrieval, preserve source grounding and source deduplication.
- Every new model provider must update `docs/decisions.md`, `docs/project-state.md`, and `docs/model-config.md`.
