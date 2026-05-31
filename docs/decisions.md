# UST Buddy Technical Decisions

This file records why the project is shaped the way it is. Update it when a major architectural choice changes.

## TanStack Start SSR

UST Buddy needs server-side routes for `/api/chat` and admin imports because MiniMax keys and Supabase service role keys must never be exposed to the browser. TanStack Start SSR keeps React routes and server APIs in one project while still supporting Vercel deployment.

## Vercel Uses `.output`

This is not a plain static Vite SPA. TanStack Start builds through Nitro, so the deployable output is `.output`, including `.output/public` and `.output/server`. Vercel should use `npm run build` and `.output`, not `dist/index.html`.

## Supabase `documents` / `document_chunks`

Documents and chunks are separated because document metadata and retrieval units have different responsibilities:

- `documents` stores stable metadata such as title, category, source, URL, status, and dates.
- `document_chunks` stores searchable content chunks, keywords, metadata, and future embeddings.

This makes admin listing, chunk refresh, cascade delete, and pgvector search cleaner.

## Admin Import Uses Token Protection

The admin pages can create, update, and delete knowledge base content, so they require backend token validation through `ADMIN_IMPORT_TOKEN`. A full login system is intentionally postponed to keep the project small. Frontend-only checks are not enough; every admin API must validate `x-admin-token`.

## Sources Are Deduplicated By Document

Retrieval can return multiple chunks from the same document. Showing each chunk as a separate source card creates repeated references and confuses users. `/api/chat` can pass top chunks to the model, but the frontend should receive deduplicated document-level sources.

## MiniMax API-vlm For Image Parsing

MiniMax M2.7 chat-model image input was unreliable for long screenshots and posters. The image import flow therefore prioritizes MiniMax API-vlm through `/v1/coding_plan/vlm`, which is designed as an independent image understanding endpoint. If VLM fails, the app can fall back to OCR; it must not invent OCR output.

## Jina For Embeddings

Jina is the current default embedding provider because it exposes a straightforward embeddings API and works well for a replaceable provider layer. The implementation remains provider-oriented so MiniMax or another OpenAI-compatible embedding service can be swapped in through environment variables.

## Mainland China Access Is Deferred

Network access from Mainland China to model providers can be unstable. The current code supports proxy variables for embeddings, but full Mainland-friendly deployment is postponed. That work should be handled as a deployment and provider-routing decision, not patched ad hoc into chat or admin UI code.
