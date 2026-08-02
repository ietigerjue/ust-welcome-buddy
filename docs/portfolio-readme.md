# UST Buddy

UST Buddy is a knowledge-base AI assistant for HKUST freshmen. It answers student-life questions using a prepared knowledge base, hybrid retrieval, and MiniMax API, with source-grounded responses.

> Portfolio README draft: this file is kept for future public or portfolio presentation. Before using it as the root `README.md` in a public repository, run a full secret audit, rotate exposed credentials if needed, and remove any private operational details.

## One-Sentence Description

UST Buddy helps incoming HKUST students get practical answers about arrival, housing, transport, campus life, academic systems, payments, and other freshman-life topics from a curated knowledge base.

## Target Users

- Incoming HKUST undergraduate and postgraduate students
- New students preparing for arrival, registration, housing, transport, SIM cards, payments, campus systems, and daily life
- Student helpers or orientation groups who need a lightweight, source-grounded Q&A assistant

## Core Features

- Chat-first Q&A experience
- Prepared knowledge base maintained by the app owner/admin
- Supabase documents and chunks as the server-side knowledge store
- Hybrid Search with keyword retrieval plus pgvector semantic retrieval
- MiniMax answer generation based only on retrieved context
- Source references deduplicated by document
- Admin import for Markdown, WeChat paste, public URL content, and images/long screenshots
- Admin document management and model configuration
- Question logging and retrieval/model observability

## Tech Stack

- React
- TanStack Start SSR
- TypeScript
- Vite
- Supabase
- pgvector
- MiniMax text model
- MiniMax API-vlm image understanding
- Jina-compatible embeddings
- Vercel deployment

## How It Works

1. A student asks a question in the chat page.
2. The frontend sends the question to `/api/chat`.
3. The server performs Hybrid Search over Supabase `document_chunks`.
4. The top chunks are passed to the configured text model as grounded context.
5. The model answers only from the retrieved context.
6. The frontend shows the answer and deduplicated source references.
7. If the knowledge base does not cover the question, the app returns `当前知识库没有覆盖这个问题。`

## Knowledge Base Format

Local seed documents live in:

```text
content/knowledge/
```

Markdown documents use frontmatter:

```md
---
id: arrival
title: Arrival Routes to HKUST / 新生来港路线参考
category: arrival
source: UST Buddy local knowledge base
source_url:
updatedAt: 2026-06-02
keywords:
  - arrival
  - airport
  - HKUST
  - 新生来港
  - 机场
---

Markdown content goes here.
```

Admin imports write document metadata into `documents` and searchable chunks into `document_chunks`.

## Local Development

Install dependencies:

```bash
npm install
```

Copy the environment template:

```bash
cp .env.example .env.local
```

Start the development server:

```bash
npm run dev
```

Useful checks:

```bash
npm run check:env
npm run check:secrets
npm run test:retrieval
npm run test:hybrid-stability
```

## Environment Variables

This project uses server-side environment variables for Supabase, Admin Token, LLM, image parser, and embedding providers. See `docs/env-vars.md` for the full list.

Do not commit real API keys or `.env.local`.

## Deployment

UST Buddy is a TanStack Start SSR app. It should be deployed as an SSR project, not a static Vite SPA.

Recommended Vercel settings:

- Build Command: `npm run build`
- Output Directory: `.output`
- Root Directory: `.`

## Current Limitations

- Admin access uses a shared token rather than a full login system.
- Vector search requires prepared embeddings and a working Supabase pgvector RPC.
- Mainland China deployment needs a separate runtime/CDN/provider access plan.
- The app does not support public user uploads.
- The app does not perform public real-time web search.

## Future Improvements

- Full admin authentication and role management
- More robust knowledge ingestion workflows
- Question analytics dashboard
- Retrieval quality tuning with larger evaluation sets
- Mainland China-friendly deployment
- Additional model providers through the existing provider/router/config layer

## License

No public license is included in this draft. If this project is published later, choose an explicit license or keep it source-available/private according to the maintainer's distribution plan.
