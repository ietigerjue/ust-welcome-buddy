# Internal Handoff Guide

This document is for authorized UST Buddy collaborators only. Do not publish it or send secrets through Git, email threads, screenshots, or public chat tools.

## Project Summary

UST Buddy is a private knowledge-base AI assistant for HKUST freshmen. Students ask life and arrival questions in chat. The server retrieves relevant knowledge chunks from Supabase and asks the configured text model to answer only from those chunks.

## Main Functions

- Public chat at `/chat`.
- Hybrid Search over Supabase `documents` and `document_chunks`.
- Source-grounded answers with document-level source deduplication.
- Question logging and rough model/token observability.
- Admin import for Markdown, WeChat paste, single Web URL, WeChat article URL, and image/long screenshot content.
- Admin document listing, metadata edit, and delete.
- Admin settings for non-secret provider/model/env-var-name configuration.

## Stack

- React and TanStack Start SSR.
- TypeScript and Vite.
- Nitro output for Vercel.
- Supabase for documents, chunks, app config, and question logs.
- MiniMax text model for chat and metadata generation.
- MiniMax API-vlm for image understanding.
- Jina-compatible embeddings and Supabase pgvector RPC.

## External Accounts To Hand Off

- GitHub private repository access.
- Vercel project access.
- Supabase project access.
- MiniMax account or API key ownership.
- Embedding provider account or API key ownership.
- DNS/domain provider access if a production custom domain is used.
- Proxy/network provider access if outbound proxy variables are used.

Share secrets only through a secure password manager or approved secret channel. Rotate keys after handoff when practical.

## Local Start

1. Clone the private repository.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Fill real environment variables from the secure secret handoff.
5. Run `npm run check:env`.
6. Run `npm run dev`.
7. Open `/chat`, `/admin/import`, `/admin/documents`, and `/admin/settings`.

## Supabase Initialization

Apply SQL files manually in Supabase SQL Editor when setting up a new project:

- `supabase/app-config.sql`
- `supabase/question-logs-observability.sql`
- documents/chunks schema and pgvector RPC maintained by the project owner

Confirm that these exist:

- `documents`
- `document_chunks`
- `question_logs`
- `app_config`
- RPC `match_document_chunks`

## Admin Usage

- Admin pages are not shown in public navigation.
- Use the Admin Token in `/admin/import`, `/admin/documents`, and `/admin/settings`.
- Parsed Markdown, WeChat, URL, and image content fills the Import form only.
- The admin must review and click Import before data is written to Supabase.

## Knowledge Base Import

- Use `/admin/import` for one-off imports.
- Use `scripts/syncKnowledgeToSupabase.ts` for local Markdown seed sync.
- After import, embeddings are attempted best-effort for the new document.
- If auto-embedding fails, run `npm run embed:chunks`.

## Embedding Rebuild

Run these after changing embedding provider, model, or dimensions:

```bash
npm run test:embedding
npm run embed:chunks
npm run test:vector-search
npm run test:retrieval
```

If dimensions change, update the database vector column and RPC first.

## Hybrid Search Tests

- `npm run test:retrieval` checks retrieval coverage.
- `npm run test:hybrid-stability` checks stable top chunk ordering.
- `npm run test:answer-stability` checks repeated context/source stability and answer previews.

## Model Config

- `/admin/settings` edits provider/model/env-var names only.
- Real API keys remain in `.env.local` or Vercel Environment Variables.
- Run `npm run test:model-config` after config changes.

## Deployment

- Vercel build command: `npm run build`.
- Output directory: `.output`.
- Configure all required env vars in Vercel.
- Run smoke tests after deployment:
  - `/chat` covered question.
  - `/chat` not-covered question.
  - `/admin/import` token failure and success.
  - `/admin/settings` Load Config.

## Troubleshooting

- Chat says not covered: run retrieval tests and enable `RAG_DEBUG=true` locally.
- Admin import succeeds but vector search misses new content: run `npm run embed:chunks`.
- Image import fails: check VLM env vars and provider account status.
- Supabase logs missing: confirm `question_logs` columns and service role key.
- Vercel 404: confirm TanStack Start SSR build uses `.output`, not `dist`.
