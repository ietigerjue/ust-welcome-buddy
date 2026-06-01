# UST Buddy Project State

Last updated: 2026-06-01

This file is the current engineering snapshot for UST Buddy. Read it before making product, backend, retrieval, or deployment changes.

## Project

- Name: UST Buddy
- Purpose: A knowledge-base AI assistant for HKUST freshmen.
- Product shape: Users ask questions in a chat box. The app answers from an admin-prepared knowledge base with source references.

## Tech Stack

- React
- TanStack Start SSR
- TypeScript
- Vite
- Nitro output
- Supabase
- Configurable text model provider
- Configurable image parser / VLM / OCR provider
- Local Markdown knowledge base
- Jina-compatible embedding provider layer
- Vercel deployment

## Deployment

- Deployment target: Vercel
- Build command: `npm run build`
- Output directory: `.output`
- Reason: This is a TanStack Start SSR app, not a static Vite SPA.
- Production output includes `.output/public` and `.output/server`.
- Mainland China deployment is not active yet. A deployment pre-plan lives in `docs/deployment-domestic.md` and recommends a staged domestic SSR/CDN rollout before any data-plane migration.

## User-Facing Features

- Chat page for HKUST freshman-life questions.
- Chinese-first suggested questions.
- `/api/chat` receives the question from the frontend.
- Server-side retrieval uses Hybrid Search: Supabase keyword chunk search plus pgvector RPC search through `match_document_chunks`.
- If either keyword or vector search fails, the other retrieval path can still provide context.
- MiniMax generates answers from retrieved context only.
- If no relevant source is found, the answer is `当前知识库没有覆盖这个问题。`
- Source cards are deduplicated by document before being returned to the frontend.
- User questions are logged to Supabase `question_logs` when configured.
- Normal users cannot upload documents.

## Admin Features

- Admin pages share a private admin navigation bar for `/admin/import`, `/admin/documents`, and `/admin/settings`.
- The admin navigation is not shown in the public Home, Chat, or About pages.

- `/admin/import`
  - Not linked from the public navigation.
  - Protected by `ADMIN_IMPORT_TOKEN`.
  - Manual form import into Supabase.
  - Markdown upload and backend frontmatter parsing.
  - Markdown without frontmatter can use MiniMax to generate metadata.
  - WeChat article paste parsing and metadata generation.
  - Image / long screenshot import using MiniMax API-vlm first, with OCR fallback.
  - Web URL import for a single public `http`/`https` page. It rejects localhost, private networks, `file://`, `data://`, oversized pages, and unsupported content types. Parsed content fills the import form only; the admin must still confirm Import.
  - WeChat article URL import for single `https://mp.weixin.qq.com/*` articles. It extracts the article title, account name, body text, and body image URLs. Detected body images are parsed with the MiniMax API-vlm image understanding flow and appended to the imported content. It does not batch, recurse, bypass login, or bypass access restrictions.
  - After a successful Import, the page clears import and parser fields while keeping the Admin Token so admins can import the next document without refreshing.

- `/admin/documents`
  - Not linked from the public navigation.
  - Protected by `ADMIN_IMPORT_TOKEN`.
  - Lists Supabase documents and chunk counts.
  - Supports refresh, edit metadata, and delete document.
  - Deleting a document relies on cascade delete for related chunks.

- `/admin/settings`
  - Not linked from the public navigation.
  - Protected by `ADMIN_IMPORT_TOKEN`.
  - Lets admins load and save non-secret model configuration for `chat_llm`, `metadata_llm`, `image_parser`, and `embedding`.
  - Stores provider/model/env variable names in Supabase `app_config`; real API keys remain only in `.env.local` or deployment environment variables.

## Knowledge Base Sources

- Local seed knowledge lives in `content/knowledge/*.md`.
- Markdown files use frontmatter for metadata.
- Supabase is the active server-side knowledge store for retrieval.
- `scripts/syncKnowledgeToSupabase.ts` syncs local Markdown into Supabase.
- Admin import can add documents directly to Supabase.
- Users cannot upload knowledge files from the public chat UI.

## Supabase Tables

- `app_config`
  - Stores non-secret provider/model configuration for `chat_llm`, `metadata_llm`, `image_parser`, and `embedding`.
  - Expected fields are `key`, `value`, and `updated_at`.
  - SQL lives in `supabase/app-config.sql`.
  - `value` stores provider/model/base URL env var name/API key env var name only, never real API keys.

- `question_logs`
  - Records user questions, matched sources, answer status, and error messages.
  - Observability fields can include retrieval mode, context chunk count, model provider/name, estimated input/output tokens, and latency.
  - Observability SQL lives in `supabase/question-logs-observability.sql`.

- `documents`
  - Stores document-level metadata.
  - Expected fields include `id`, `slug`, `title`, `category`, `source`, `source_url`, `source_type`, `status`, `updated_at`, `created_at`.

- `document_chunks`
  - Stores chunk-level content.
  - Expected fields include `id`, `document_id`, `chunk_index`, `content`, `keywords`, `metadata`, `created_at`.
  - The embedding work assumes an `embedding` vector column will exist or has been added for pgvector.

## AI Model Configuration

Current default config is environment-driven. These defaults are operational details, not permanent architectural rules.

Text generation default:

- `MINIMAX_API_KEY`
- `MINIMAX_BASE_URL`
- `MINIMAX_MODEL`

Image understanding default:

- `IMAGE_PARSE_PROVIDER`
- `MINIMAX_VLM_API_KEY`
- `MINIMAX_VLM_BASE_URL`
- `MINIMAX_VLM_ENDPOINT`

Embedding default:

- `EMBEDDING_PROVIDER`
- `EMBEDDING_API_KEY`
- `EMBEDDING_BASE_URL`
- `EMBEDDING_MODEL`
- `EMBEDDING_DIMENSIONS`
- Optional network proxy: `HTTPS_PROXY` or `HTTP_PROXY`

Future direction:

- Use Supabase `app_config` for provider/model selection.
- Keep API keys in environment variables only.
- `/admin/settings` is available for provider/model configuration.
- Record actual provider/model in question logs or model usage logs when available.

Config reader:

- `src/lib/appConfig.ts` reads Supabase `app_config` when available.
- If Supabase is unavailable, the table is missing, or a config row is missing, it falls back to current environment defaults.
- Test with `npm run test:app-config`.
- Model configuration QA script: `npm run test:model-config` reads all model configs, validates required fields and env var presence, temporarily updates `chat_llm`, verifies `getModelConfig()` sees the change, then restores the original row.

Model router:

- `src/lib/modelRouter.ts` provides provider descriptors for `chat_llm`, `metadata_llm`, `embedding`, and `image_parser`.
- `getLLMProvider()`, `getEmbeddingProvider()`, and `getImageParserProvider()` return non-secret provider/interface metadata.
- Runtime callers resolve API keys from the configured environment variable names server-side only.
- Test with `npm run test:model-router`; the script does not call real model APIs.
- Admin config API:
  - `GET /api/admin/config` returns app_config settings or env fallback settings plus `keyConfigured` / `baseUrlConfigured` booleans.
  - `PUT /api/admin/config` saves only non-secret fields: provider, model, env var names, endpoint env var name, dimensions, fallback provider, and enabled.
  - Env-name fields must contain variable names only, not raw API keys, tokens, or URLs.
  - `npm run test:admin-config` checks the admin config API without calling real model APIs.
- Runtime model calls check configured `api_key_env` / `base_url_env` before sending requests. Missing env variables return `Provider is configured but required environment variable is missing.` without exposing real key values.
- If `embedding.dimensions` changes, rebuild `document_chunks.embedding` and update the pgvector RPC before relying on vector search.

Admin and Supabase:

- `ADMIN_IMPORT_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Never expose service role keys or API keys to the frontend.

## Image Parsing

- Current primary path: MiniMax API-vlm independent image understanding endpoint.
- Default endpoint: `/v1/coding_plan/vlm`.
- Input: single uploaded PNG, JPEG, or WebP image.
- Output: cleaned Markdown-like content plus metadata for the admin import form.
- Fallback: local OCR with `tesseract.js`, then MiniMax text metadata generation.
- The app must not fake OCR results. If both VLM and OCR fail, return a clear error.

## Embedding Work

- Provider layer: `src/lib/embeddings.ts`.
- Single test script: `npm run test:embedding`.
- Vector search test script: `npm run test:vector-search`.
- Retrieval evaluation script: `npm run test:retrieval`.
- Batch script: `npm run embed:chunks`.
- Default provider: Jina.
- Default Jina base URL: `https://api.jina.ai/v1`.
- Optional proxy support is available through `HTTPS_PROXY` or `HTTP_PROXY`.
- `embed:chunks` processes chunks with missing embeddings in batches of 10, truncates long text to 3000 characters, retries failed chunks with 1s / 3s / 6s delays, and continues after per-chunk failures.
- Vector search helper exists in `src/lib/searchVectorKnowledgeBase.ts`; it generates a query embedding, calls Supabase RPC `match_document_chunks` with `match_count = 8`, and enriches chunks with `documents` metadata including slug and source type.
- `/api/chat` now combines keyword and vector results, dedupes by chunk, reranks with normalized keyword score weight 0.5 plus vector similarity weight 0.5 plus a 0.15 overlap bonus, truncates each context chunk to 1200 characters, and sends the top 6 chunks to MiniMax.
- Chat answer generation, metadata extraction, embedding generation, and image parsing now read provider/model settings through `src/lib/modelRouter.ts`.
- `docs/retrieval-eval.md` defines a fixed Hybrid Search evaluation set covering arrival, housing, transport, life, academic, food, shopping, official, WeChat paste, and image upload retrieval targets.
- `npm run test:retrieval` checks whether each expected category/source type or expected document keyword appears in the top 5 retrieval results without calling MiniMax answer generation.
- `question_logs` records `retrieval_mode = "hybrid"` and `context_chunks_count` for chat requests when the Supabase table supports those fields.
- `/api/chat` also estimates input/output tokens with `src/lib/tokenEstimate.ts` and logs `model_provider`, `model_name`, `estimated_input_tokens`, `estimated_output_tokens`, and `latency_ms` when `question_logs` has those columns.

## Current Next Step

The active next step is validating admin model configuration, tuning pgvector Hybrid Search, and preparing Mainland China deployment:

- Apply `supabase/app-config.sql` if the `app_config` table does not exist.
- Use `/admin/settings` to load and save provider/model/env-var-name configuration.
- Confirm or add `document_chunks.embedding vector(...)`.
- Run `npm run embed:chunks`.
- Ensure Supabase RPC `match_document_chunks` exists and returns the expected chunk fields.
- Run `npm run test:retrieval` after knowledge base or retrieval changes.
- Tune keyword/vector weights, similarity thresholds, and result limits based on test questions.
- Apply `supabase/question-logs-observability.sql` before relying on model/token/latency fields in `question_logs`.
- Review `docs/deployment-domestic.md` before deploying a Mainland-friendly runtime.
- Keep existing source deduplication and question logging.

## Known Limitations

- `/api/chat` depends on Supabase RPC `match_document_chunks` for vector retrieval; if the RPC or embeddings are not ready, Hybrid Search falls back to keyword results only.
- Embedding scripts need working embedding API configuration and network access.
- Mainland China network access to Jina or MiniMax may require a proxy or alternative deployment path.
- Domestic deployment requires ICP/domain/CDN/runtime work and has not been implemented yet.
- Admin pages use a shared token, not a full login system.
- No public user upload flow.
- No automated WeChat crawling. Only single admin-provided `mp.weixin.qq.com` article URLs are supported for import.
- No PDF parsing.
- No bulk image import.
- No recursive web crawling or public user web search.
- No production analytics dashboard for question logs yet.

## Do Not Do Yet

- Do not expose API keys or Supabase service role keys to the frontend.
- Do not add public user uploads.
- Do not replace admin token protection with a large auth system unless explicitly requested.
- Do not migrate the whole knowledge base away from Supabase documents/chunks without a plan.
- Do not remove local Markdown files; they are still useful as seed and backup content.
- Do not make MiniMax or embedding calls directly from the browser.
- Do not hard-code provider API keys.
- Do not hard-code provider/model names in new business logic.
