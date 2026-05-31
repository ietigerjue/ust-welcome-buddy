# UST Buddy Change Log

Important changes in reverse chronological order. Keep this file concise and update it whenever the project architecture or product surface changes.

## 2026-05-31

- Added embedding provider layer in `src/lib/embeddings.ts`.
- Added `npm run test:embedding` for single-text embedding checks.
- Added `npm run embed:chunks` for backfilling missing `document_chunks.embedding` values.
- Added Jina-compatible embedding configuration and proxy support through `HTTPS_PROXY` / `HTTP_PROXY`.
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
