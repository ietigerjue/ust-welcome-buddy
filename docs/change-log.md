# UST Buddy Change Log

Important changes in reverse chronological order. Keep this file concise and update it whenever the project architecture or product surface changes.

## 2026-08-02

- Switched runtime model configuration to an environment-only source of truth. Supabase `app_config` and encrypted `model_secrets` no longer override `.env.local` or Vercel Environment Variables.
- Removed cross-provider model fallback so MiniMax can never inherit a stale `DEEPSEEK_MODEL`, and DeepSeek can never inherit `MINIMAX_MODEL`.
- Changed `/admin/settings` into a read-only environment status page and disabled `PUT /api/admin/config` with a clear `409` response, removing ambiguous backend model-setting saves.
- Updated model configuration tests to verify environment sourcing without writing temporary Supabase config rows.

## 2026-07-09

- Improved DeepSeek text LLM switching: env fallbacks now use `DEEPSEEK_BASE_URL`, `DEEPSEEK_API_KEY`, and `DEEPSEEK_MODEL` when DeepSeek is selected; chat provider errors no longer hard-code "MiniMax"; `check:env` accepts MiniMax or DeepSeek text LLM runtime config.
- Added backend encrypted model secret storage: `supabase/model-secrets.sql`, `src/lib/secureModelSecrets.ts`, write-only API Key/Base URL fields in `/admin/settings`, and runtime secret resolution through `modelRouter`. `app_config` remains non-secret and stores only provider/model/env-var metadata.

## 2026-06-03

- Added `docs/deployment-domestic.zh-CN.md`, a Chinese version of the Mainland China deployment pre-plan, and linked it from the English plan and project state.
- Expanded `docs/deployment-domestic.md` into a detailed Mainland China deployment pre-plan covering Vercel/Supabase/provider access risks, Alibaba/Tencent/Huawei/Cloudflare options, DNS/ICP/HTTPS, env vars, security, rollback, and test checkpoints. No business logic or UI changed.
- Confirmed image parser configuration is independent from chat answer generation: `/api/chat` uses `chat_llm`, metadata extraction uses `metadata_llm`, image import uses `image_parser`, and embeddings use the embedding provider.
- Added server-side image parser config logging for provider/model/env-var names/endpoint without printing API keys. The MiniMax API-vlm body still sends only `prompt` and `image_url`; `image_parser.model` is logged for observability and future endpoint support.

## 2026-06-02

- Made Admin Import backward-compatible when `documents.content_hash` or `document_chunks.content_hash` has not been migrated yet: import now retries without hash fields and returns warnings pointing to `supabase/deduplication.sql`.
- Added Task H Word / DOCX Import: installed `mammoth`, added `/api/admin/parse-docx`, added DOCX upload parsing in `/admin/import`, added fallback metadata behavior, semantic duplicate review support, and `npm run test:docx-parse`.
- Added Task K semantic duplicate review: `supabase/semantic-duplicate-review.sql`, `src/lib/semanticDuplicateReview.ts`, parse-time duplicate candidate review for Markdown/WeChat/Image/URL imports, an admin import warning panel, `SEMANTIC_DUPLICATE_THRESHOLD`, and `npm run test:semantic-dedupe`.
- Added Task J lightweight duplicate handling: `supabase/deduplication.sql`, normalized SHA-256 content hashes, import-time document/chunk hash writing, duplicate document warnings, same-document chunk dedupe, Hybrid Search content-hash dedupe, and `npm run test:dedupe`.
- Added `docs/portfolio-readme.md` to preserve a future public/portfolio README draft while keeping the root `README.md` focused on private internal handoff.
- Added closed-source internal handoff documentation: `docs/closed-source.md`, `docs/handoff.md`, `docs/env-vars.md`, `docs/setup-checklist.md`, `docs/deployment-checklist.md`, and `docs/github-private-checklist.md`.
- Reworked `README.md` as a private internal project README instead of an open-source or community-facing README.
- Added `.env.example` with placeholders only and added `npm run check:env` / `npm run check:secrets` for environment presence checks and pre-commit secret scanning without printing secret values.
- Updated `.gitignore` with explicit env and build output exclusions for closed-source handoff safety.
- Added `npm run test:answer-stability` to call Hybrid Search and answer generation three times per fixed question, comparing top source titles and context chunk ids while allowing minor answer text variation.
- Updated the RAG system prompt so partially relevant context produces a grounded partial answer instead of immediately returning `当前知识库没有覆盖这个问题。`
- Added server-only `RAG_DEBUG=true` retrieval debug logs for `/api/chat`, printing Hybrid Search context chunk metadata and score previews without returning debug details to users.
- Stabilized Hybrid Search ordering by adding `chunk_index` to keyword/vector results, moving shared merge/ranking into `src/lib/hybridSearch.ts`, sorting by final score then document id and chunk index, and adding `npm run test:hybrid-stability`.
- Stabilized `/api/chat` answer generation by setting knowledge-base chat LLM decoding to `temperature = 0.1`, `top_p = 0.3`, and `max_tokens = 1500`, reducing inconsistent answers when the same retrieved context is used repeatedly.

## 2026-06-01

- Added `/api/admin/embed-chunks` and wired `/admin/import` to automatically run best-effort embedding backfill for newly imported document chunks after Import succeeds.
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
