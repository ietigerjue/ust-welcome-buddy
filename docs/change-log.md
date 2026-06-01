# UST Buddy Change Log

Important changes in reverse chronological order. Keep this file concise and update it whenever the project architecture or product surface changes.

## 2026-06-01

- Added `docs/deployment-domestic.md`, a Mainland China deployment pre-plan covering domestic CDN/SSR runtime options, Supabase/data-plane alternatives, model provider routing, DNS/ICP/HTTPS, security, rollback, and test checkpoints.
- Updated `/admin/import` so a successful Import clears the form, parser inputs, and selected image state while preserving the Admin Token for the next import.
- Extended `/api/admin/parse-url` to support single WeChat article URLs under `https://mp.weixin.qq.com/*`, extracting title, official account name, body text, and body image URLs. Detected body images are sent through the existing MiniMax API-vlm image understanding flow and appended to the import content with `source_type = "wechat_url"`.
- Added `/api/admin/parse-url` and a Web URL Import section in `/admin/import` for parsing one public webpage into the existing import form, with Admin Token protection and SSRF safeguards.
- Added `npm run test:url-parse` to exercise the URL parse API against configured test URLs.
- Added `npm run test:model-config` for model configuration QA: it reads `app_config`, validates `getAppConfig()` / `getModelConfig()`, checks env-var presence without printing secrets, and verifies a temporary provider/model update can be read then restored.
- Added a private admin navigation bar across `/admin/import`, `/admin/documents`, and `/admin/settings` so admins can switch backend pages without using browser back.
- Added model runtime validation so configured providers fail clearly when `api_key_env` or `base_url_env` points to a missing environment variable, without printing real keys.
- Updated `/api/admin/config` and `/admin/settings` to expose `keyConfigured` / `baseUrlConfigured` booleans while saving only env var names, not secret values.
- Added `/api/admin/config` with Admin Token protection for reading and saving non-secret `app_config` model settings.
- Added `/admin/settings` so admins can manage Chat LLM, Metadata LLM, Image Parser, and Embedding provider/model/env-var-name configuration without exposing API keys.
- Added `npm run test:admin-config` to verify admin config API read/upsert behavior and reject raw secret fields without calling real model APIs.
- Added `src/lib/modelRouter.ts` for non-secret provider descriptors across chat LLM, metadata LLM, embedding, and image parser.
- Routed chat answer generation, metadata extraction, embedding generation, and image parser configuration through the model router while preserving current behavior.
- Added `npm run test:model-router` to verify provider descriptors without calling real model APIs.
- Added `supabase/question-logs-observability.sql` for model, retrieval, token estimate, and latency fields on `question_logs`.
- Added `src/lib/tokenEstimate.ts` and enhanced `/api/chat` question logging with `model_provider`, `model_name`, estimated input/output tokens, `retrieval_mode`, `context_chunks_count`, and `latency_ms`.
- Observability test steps: run `npm run dev`, ask two covered questions and one uncovered question in `/chat`, then inspect Supabase `question_logs` for the new observability columns after applying the SQL.
- Added `docs/retrieval-eval.md` with a fixed Hybrid Search retrieval evaluation set across 10 coverage targets.
- Added `npm run test:retrieval` to run retrieval-only evaluation without MiniMax answer generation.
- Added Supabase `app_config` SQL for non-secret provider/model configuration.
- Added `src/lib/appConfig.ts` to read `chat_llm`, `metadata_llm`, `image_parser`, and `embedding` config with environment fallback.
- Added `npm run test:app-config` for checking app configuration without printing secrets.
- Added Subagent workflow documentation for configurable model providers.
- Added `docs/model-config.md`, `docs/subagents.md`, `docs/task-templates.md`, and `docs/subagent-task-board.md`.
- Updated agent rules to avoid hardcoded provider/model assumptions and require provider/router/config layers for AI calls.

## 2026-05-31

- Added embedding provider layer in `src/lib/embeddings.ts`.
- Added `npm run test:embedding` for single-text embedding checks.
- Added `npm run embed:chunks` for backfilling missing `document_chunks.embedding` values.
- Added Jina-compatible embedding configuration and proxy support through `HTTPS_PROXY` / `HTTP_PROXY`.
- Enhanced `embed:chunks` with 10-row batches, 3000-character truncation, per-chunk retry delays, failure tracking, and final summary output.
- Added `src/lib/searchVectorKnowledgeBase.ts` for future pgvector retrieval through Supabase RPC `match_document_chunks`.
- Upgraded `/api/chat` to Hybrid Search by combining keyword retrieval and vector retrieval, deduping by chunk, reranking top 6 context chunks, truncating chunk content to 1200 characters, preserving document-level source deduplication, and logging hybrid retrieval metadata.
- Added `npm run test:vector-search` to test vector retrieval against `match_document_chunks` with three fixed test questions.
- Verified TypeScript and production build for the embedding scripts. Local Jina API calls may still require a working proxy depending on network conditions.
- Updated chat suggested questions to better match the current HKUST knowledge base coverage.

## 2026-05

- Added image / long screenshot import flow.
- Switched image understanding priority to MiniMax API-vlm independent endpoint instead of relying on MiniMax M2.7 chat-model vision behavior.
- Added OCR fallback with `tesseract.js` for image parsing.
- Image import now fills the existing admin import form instead of writing directly to Supabase.

## 2026-05

- Added WeChat article paste import.
- Added `/api/admin/parse-wechat` to clean pasted plain text, rich text, or HTML.
- Added metadata generation for title, category, keywords, and summary.
- Added stable fallback fields when AI metadata extraction fails.

## 2026-05

- Added Markdown upload parsing for `/admin/import`.
- Added `/api/admin/parse-markdown` with `gray-matter`.
- Markdown without frontmatter can use MiniMax to generate metadata.
- Admin still confirms and clicks Import before data is written to Supabase.

## 2026-05

- Added `/admin/documents`.
- Added `/api/admin/documents`.
- Admin can list documents, see chunk counts, refresh the list, edit metadata, and delete documents.
- Delete uses the `documents` table and relies on cascade delete for related `document_chunks`.

## 2026-05

- Added admin knowledge import.
- Added `/admin/import`.
- Added `/api/admin/import`.
- Import supports title, category, source, source URL, keywords, and content.
- Content is split into chunks before insertion into Supabase.
- Admin endpoints are protected by `ADMIN_IMPORT_TOKEN`.

## 2026-05

- Added Supabase `documents` and `document_chunks` as the server-side knowledge store.
- Added `scripts/syncKnowledgeToSupabase.ts` to sync local Markdown into Supabase.
- `/api/chat` now prefers Supabase chunk retrieval and can fall back to local Markdown search.

## 2026-05

- Added Supabase `question_logs`.
- `/api/chat` records question, answer status, matched sources, and error messages when Supabase is configured.
- Logging failures do not block normal chat answers.

## 2026-05

- Upgraded the mock local knowledge base into Markdown files under `content/knowledge/`.
- Added frontmatter parsing with `gray-matter`.
- Added local keyword search over title, category, keywords, and content.

## 2026-05

- Added MiniMax API integration for answer generation.
- Added provider layer in `src/lib/llm.ts`.
- `/api/chat` retrieves context first, then calls MiniMax only when relevant sources exist.
- System prompt requires answers to be grounded in provided context.

## Earlier

- Lovable generated the initial single-page UST Buddy prototype.
- Initial version used local mock data and mock answers.
- The project evolved into a TanStack Start SSR app with server-side API routes.
