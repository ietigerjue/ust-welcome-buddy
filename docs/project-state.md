# UST Buddy Project State

Last updated: 2026-07-09

This file is the current engineering snapshot for UST Buddy. Read it before making product, backend, retrieval, or deployment changes.

## Project

- Name: UST Buddy
- Purpose: A knowledge-base AI assistant for HKUST freshmen.
- Product shape: Users ask questions in a chat box. The app answers from an admin-prepared knowledge base with source references.
- Repository posture: closed-source, proprietary, and private. Internal collaborators only.
- Handoff docs: `docs/handoff.md`, `docs/env-vars.md`, `docs/setup-checklist.md`, `docs/deployment-checklist.md`, `docs/github-private-checklist.md`, and `docs/closed-source.md`.
- Portfolio/public README draft: `docs/portfolio-readme.md` is preserved separately for future portfolio or public presentation after a secret audit and key rotation review.

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
- Mainland China deployment is not active yet. Detailed deployment pre-plans live in `docs/deployment-domestic.md` and `docs/deployment-domestic.zh-CN.md`, and recommend a staged domestic SSR/CDN rollout before any data-plane migration.
- Recommended Mainland first experiment: deploy the existing `.output` SSR runtime to Alibaba Cloud Function Compute or Tencent Cloud SCF, put a domestic CDN/custom HTTPS domain in front, keep current Supabase for smoke testing, then migrate the data plane only if latency requires it.
- Deployment handoff checklist lives in `docs/deployment-checklist.md`.
- GitHub private repository checklist lives in `docs/github-private-checklist.md`.

## Secret Safety And Internal Handoff

- `.env.example` is the committed placeholder template.
- `.env.local`, `.env`, and `.env.*.local` must not be committed.
- `npm run check:env` checks required environment variable presence without printing values.
- `npm run check:secrets` scans committed files for obvious secret patterns and checks whether real env files are tracked.
- `docs/env-vars.md` documents variable purpose, required status, local/Vercel setup, and whether each value is secret.
- `/admin/settings` can save provider API Keys and direct Base URLs as write-only backend encrypted secrets when `supabase/model-secrets.sql` has been applied and `MODEL_SECRET_ENCRYPTION_KEY` is configured. These values are never returned to the frontend and are not stored in `app_config`.
- `docs/closed-source.md` records proprietary usage restrictions and key rotation expectations if the repository is ever exposed publicly.
- `docs/portfolio-readme.md` keeps a public-facing project description draft separate from the private root README.
- No open-source license is currently present.

## User-Facing Features

- Chat page for HKUST freshman-life questions.
- Chinese-first suggested questions.
- `/api/chat` receives the question from the frontend.
- Server-side retrieval uses Hybrid Search: Supabase keyword chunk search plus pgvector RPC search through `match_document_chunks`.
- Hybrid Search ranking is deterministic for unchanged data: results sort by final score descending, then document id ascending, then chunk index ascending, with top 6 chunks sent to the LLM.
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
  - Word / DOCX upload parsing with `mammoth`, metadata generation, and admin review before import. Legacy `.doc` files are not supported.
  - WeChat article paste parsing and metadata generation.
  - Image / long screenshot import using MiniMax API-vlm first, with OCR fallback.
  - Web URL import for a single public `http`/`https` page. It rejects localhost, private networks, `file://`, `data://`, oversized pages, and unsupported content types. Parsed content fills the import form only; the admin must still confirm Import.
  - WeChat article URL import for single `https://mp.weixin.qq.com/*` articles. It extracts the article title, account name, body text, and body image URLs. Detected body images are parsed with the MiniMax API-vlm image understanding flow and appended to the imported content. It does not batch, recurse, bypass login, or bypass access restrictions.
  - After a successful Import, the page clears import and parser fields while keeping the Admin Token so admins can import the next document without refreshing.
  - After a successful Import, the page also triggers a best-effort `/api/admin/embed-chunks` call for the newly imported document so missing chunk embeddings are generated automatically when embedding config is available.
  - Parse results can include semantic duplicate review candidates before import. The admin sees possible overlapping documents and can still choose whether to Import.

- `/admin/documents`
  - Not linked from the public navigation.
  - Protected by `ADMIN_IMPORT_TOKEN`.
  - Lists Supabase documents and chunk counts.
  - Supports refresh, edit metadata, and delete document.
  - Deleting a document relies on cascade delete for related chunks.

- `/admin/settings`
  - Not linked from the public navigation.
  - Protected by `ADMIN_IMPORT_TOKEN`.
  - Lets admins load and save model configuration for `chat_llm`, `metadata_llm`, `image_parser`, and `embedding`.
  - Stores provider/model/env variable names and non-secret settings in Supabase `app_config`.
  - Supports write-only API Key and direct Base URL fields. These are encrypted server-side into `model_secrets`, never returned to the browser, and never stored in `app_config`.

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

- `model_secrets`
  - Optional backend encrypted store for provider API Keys and direct Base URLs saved through `/admin/settings`.
  - SQL lives in `supabase/model-secrets.sql`.
  - Requires `MODEL_SECRET_ENCRYPTION_KEY`.
  - Stores encrypted values, IV, and auth tag only; real secret values are not returned by admin APIs.

- `question_logs`
  - Records user questions, matched sources, answer status, and error messages.
  - Observability fields can include retrieval mode, context chunk count, model provider/name, estimated input/output tokens, and latency.
  - Observability SQL lives in `supabase/question-logs-observability.sql`.

- `documents`
  - Stores document-level metadata.
  - Expected fields include `id`, `slug`, `title`, `category`, `source`, `source_url`, `source_type`, `status`, `updated_at`, `created_at`, `content_hash`.
  - If `content_hash` has not been migrated yet, Admin Import can still fall back and import without hash-based duplicate checking, but `supabase/deduplication.sql` should be applied to enable Task J dedupe.

- `document_chunks`
  - Stores chunk-level content.
  - Expected fields include `id`, `document_id`, `chunk_index`, `content`, `content_hash`, `keywords`, `metadata`, `created_at`.
  - The embedding work assumes an `embedding` vector column will exist or has been added for pgvector.
  - Deduplication SQL lives in `supabase/deduplication.sql`.
  - If `content_hash` has not been migrated yet, Admin Import retries chunk inserts without `content_hash`; exact chunk dedupe becomes active after the SQL migration.

## AI Model Configuration

Current default config is environment-driven. These defaults are operational details, not permanent architectural rules.

Text generation default:

- `MINIMAX_API_KEY`
- `MINIMAX_BASE_URL`
- `MINIMAX_MODEL`

Knowledge-base chat answer generation uses low-randomness decoding for repeatability:

- `temperature = 0.1`
- `top_p = 0.3`
- `max_tokens = 1500`

Image understanding default:

- `IMAGE_PARSE_PROVIDER`
- `IMAGE_PARSE_MODEL` or `MINIMAX_VLM_MODEL`
- `MINIMAX_VLM_API_KEY`
- `MINIMAX_VLM_BASE_URL`
- `MINIMAX_VLM_ENDPOINT`

Embedding default:

- `EMBEDDING_PROVIDER`
- `EMBEDDING_API_KEY`
- `EMBEDDING_BASE_URL`
- `EMBEDDING_MODEL`
- `EMBEDDING_DIMENSIONS`
- `SEMANTIC_DUPLICATE_THRESHOLD` defaults to `0.82` for admin semantic duplicate review.
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
- `chat_llm`, `metadata_llm`, `image_parser`, and `embedding` are independent config keys. Changing `image_parser` to MiniMax-M3 or a MiniMax VLM endpoint does not change `/api/chat`, which uses only `chat_llm`.
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
- Image parsing reads the `image_parser` provider descriptor, including `provider`, `model`, `base_url_env`, `api_key_env`, and `endpoint_env`.
- The MiniMax API-vlm request currently sends `prompt` and `image_url`; the configured `image_parser.model` is logged server-side for observability and future endpoint support, but is not forced into the request body.
- `/api/chat` remains isolated from image parser changes and continues to read `chat_llm`.
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
- `/api/admin/embed-chunks` lets Admin Import automatically backfill embeddings for the newly imported document. It is Admin Token protected, processes missing embeddings only, caps each request to 50 chunks, truncates long chunk text to 3000 characters, retries per chunk, and does not undo the import if embedding generation fails.
- Admin Import calculates `content_hash` for full documents and chunks with `src/lib/contentHash.ts`. It warns when a matching document hash already exists, dedupes repeated chunks inside the same document before insert, and treats chunk unique-index conflicts as warnings instead of failing the whole import.
- Vector search helper exists in `src/lib/searchVectorKnowledgeBase.ts`; it generates a query embedding, calls Supabase RPC `match_document_chunks` with `match_count = 8`, and enriches chunks with `documents` metadata including slug and source type.
- `/api/chat` now combines keyword and vector results, dedupes by chunk, reranks with normalized keyword score weight 0.5 plus vector similarity weight 0.5 plus a 0.15 overlap bonus, truncates each context chunk to 1200 characters, and sends the top 6 chunks to MiniMax.
- `src/lib/hybridSearch.ts` owns the shared Hybrid Search merge/ranking logic used by `/api/chat` and retrieval tests. It keeps ordering stable with final score, document id, chunk index, and chunk id tie-breakers, and dedupes repeated context chunks by `content_hash` or a fallback normalized content hash.
- `src/lib/semanticDuplicateReview.ts` checks parsed import content against existing embedded chunks through Supabase RPC `match_duplicate_chunks`. It uses up to 4000 characters for the query embedding, groups matches by document, keeps the best chunk per document, and returns review candidates for admin confirmation.
- Chat answer generation, metadata extraction, embedding generation, and image parsing now read provider/model settings through `src/lib/modelRouter.ts`.
- `docs/retrieval-eval.md` defines a fixed Hybrid Search evaluation set covering arrival, housing, transport, life, academic, food, shopping, official, WeChat paste, and image upload retrieval targets.
- `npm run test:retrieval` checks whether each expected category/source type or expected document keyword appears in the top 5 retrieval results without calling MiniMax answer generation.
- `npm run test:dedupe` validates normalized content hashing and Hybrid Search duplicate chunk handling without calling LLM or embedding APIs.
- `npm run test:semantic-dedupe` calls the embedding provider and Supabase `match_duplicate_chunks` RPC to print possible duplicate document candidates for a sample housing text.
- `npm run test:docx-parse` validates local DOCX parsing behavior and file-type/empty-content guards without calling metadata LLM by default.
- `npm run test:hybrid-stability` runs the same Hybrid Search question three times and fails if the ordered top chunk ids differ.
- `question_logs` records `retrieval_mode = "hybrid"` and `context_chunks_count` for chat requests when the Supabase table supports those fields.
- `/api/chat` also estimates input/output tokens with `src/lib/tokenEstimate.ts` and logs `model_provider`, `model_name`, `estimated_input_tokens`, `estimated_output_tokens`, and `latency_ms` when `question_logs` has those columns.
- `RAG_DEBUG=true` enables server-only `/api/chat` retrieval debug logs with the user question, retrieval mode, top context chunk count, chunk title/category/source type, scores, similarity, keyword score, and a 200-character content preview. Debug details are never returned to the frontend.

## Current Next Step

The active next step is validating admin model configuration, tuning pgvector Hybrid Search, preparing Mainland China deployment, and keeping closed-source handoff docs current:

- Use `docs/setup-checklist.md` and `docs/handoff.md` for collaborator onboarding.
- Run `npm run check:env` during local setup.
- Run `npm run check:secrets` before commits and before any repository visibility change.
- Apply `supabase/app-config.sql` if the `app_config` table does not exist.
- Use `/admin/settings` to load and save provider/model/env-var-name configuration.
- Confirm or add `document_chunks.embedding vector(...)`.
- Run `npm run embed:chunks`.
- Ensure Supabase RPC `match_document_chunks` exists and returns the expected chunk fields.
- Run `npm run test:retrieval` after knowledge base or retrieval changes.
- Apply `supabase/deduplication.sql` before relying on import-time document/chunk hashes or the chunk unique index.
- Apply `supabase/semantic-duplicate-review.sql` before relying on semantic duplicate review in parse responses.
- Tune keyword/vector weights, similarity thresholds, and result limits based on test questions.
- Apply `supabase/question-logs-observability.sql` before relying on model/token/latency fields in `question_logs`.
- Review `docs/deployment-domestic.md` or `docs/deployment-domestic.zh-CN.md` before deploying a Mainland-friendly runtime.
- Mainland deployment work should begin with a separate test subdomain and keep Vercel/Supabase as rollback until user, admin, retrieval, model, and security checks pass.
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
- No legacy `.doc` parsing; only `.docx` Word import is supported.
- Word import does not parse embedded images or preserve complex table layout in the first version.
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
