# UST Buddy Project State

Last updated: 2026-05-31

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
- MiniMax text model
- MiniMax API-vlm image understanding endpoint
- Local Markdown knowledge base
- Jina-compatible embedding provider layer
- Vercel deployment

## Deployment

- Deployment target: Vercel
- Build command: `npm run build`
- Output directory: `.output`
- Reason: This is a TanStack Start SSR app, not a static Vite SPA.
- Production output includes `.output/public` and `.output/server`.

## User-Facing Features

- Chat page for HKUST freshman-life questions.
- Chinese-first suggested questions.
- `/api/chat` receives the question from the frontend.
- Server-side retrieval checks Supabase `document_chunks` first.
- If Supabase retrieval fails, the app can fall back to local Markdown search.
- MiniMax generates answers from retrieved context only.
- If no relevant source is found, the answer is `当前知识库没有覆盖这个问题。`
- Source cards are deduplicated by document before being returned to the frontend.
- User questions are logged to Supabase `question_logs` when configured.
- Normal users cannot upload documents.

## Admin Features

- `/admin/import`
  - Not linked from the public navigation.
  - Protected by `ADMIN_IMPORT_TOKEN`.
  - Manual form import into Supabase.
  - Markdown upload and backend frontmatter parsing.
  - Markdown without frontmatter can use MiniMax to generate metadata.
  - WeChat article paste parsing and metadata generation.
  - Image / long screenshot import using MiniMax API-vlm first, with OCR fallback.

- `/admin/documents`
  - Not linked from the public navigation.
  - Protected by `ADMIN_IMPORT_TOKEN`.
  - Lists Supabase documents and chunk counts.
  - Supports refresh, edit metadata, and delete document.
  - Deleting a document relies on cascade delete for related chunks.

## Knowledge Base Sources

- Local seed knowledge lives in `content/knowledge/*.md`.
- Markdown files use frontmatter for metadata.
- Supabase is the active server-side knowledge store for retrieval.
- `scripts/syncKnowledgeToSupabase.ts` syncs local Markdown into Supabase.
- Admin import can add documents directly to Supabase.
- Users cannot upload knowledge files from the public chat UI.

## Supabase Tables

- `question_logs`
  - Records user questions, matched sources, answer status, and error messages.

- `documents`
  - Stores document-level metadata.
  - Expected fields include `id`, `slug`, `title`, `category`, `source`, `source_url`, `source_type`, `status`, `updated_at`, `created_at`.

- `document_chunks`
  - Stores chunk-level content.
  - Expected fields include `id`, `document_id`, `chunk_index`, `content`, `keywords`, `metadata`, `created_at`.
  - The embedding work assumes an `embedding` vector column will exist or has been added for pgvector.

## AI Model Configuration

Text generation:

- `MINIMAX_API_KEY`
- `MINIMAX_BASE_URL`
- `MINIMAX_MODEL`

Image understanding:

- `IMAGE_PARSE_PROVIDER`
- `MINIMAX_VLM_API_KEY`
- `MINIMAX_VLM_BASE_URL`
- `MINIMAX_VLM_ENDPOINT`

Embeddings:

- `EMBEDDING_PROVIDER`
- `EMBEDDING_API_KEY`
- `EMBEDDING_BASE_URL`
- `EMBEDDING_MODEL`
- `EMBEDDING_DIMENSIONS`
- Optional network proxy: `HTTPS_PROXY` or `HTTP_PROXY`

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
- Batch script: `npm run embed:chunks`.
- Default provider: Jina.
- Default Jina base URL: `https://api.jina.ai/v1`.
- Optional proxy support is available through `HTTPS_PROXY` or `HTTP_PROXY`.
- `embed:chunks` processes chunks with missing embeddings in batches and continues after per-chunk failures.
- Embeddings are not yet wired into `/api/chat` retrieval.

## Current Next Step

The active next step is pgvector semantic retrieval:

- Confirm or add `document_chunks.embedding vector(...)`.
- Run `npm run embed:chunks`.
- Add a Supabase RPC or SQL function for vector similarity search.
- Combine semantic retrieval with current keyword retrieval.
- Keep existing source deduplication and question logging.

## Known Limitations

- `/api/chat` still uses keyword-style Supabase chunk retrieval, not pgvector semantic retrieval.
- Embedding scripts need working embedding API configuration and network access.
- Mainland China network access to Jina or MiniMax may require a proxy or alternative deployment path.
- Admin pages use a shared token, not a full login system.
- No public user upload flow.
- No automated WeChat link crawling.
- No PDF parsing.
- No bulk image import.
- No production analytics dashboard for question logs yet.

## Do Not Do Yet

- Do not expose API keys or Supabase service role keys to the frontend.
- Do not add public user uploads.
- Do not replace admin token protection with a large auth system unless explicitly requested.
- Do not migrate the whole knowledge base away from Supabase documents/chunks without a plan.
- Do not remove local Markdown files; they are still useful as seed and backup content.
- Do not make MiniMax or embedding calls directly from the browser.
- Do not hard-code provider API keys.
