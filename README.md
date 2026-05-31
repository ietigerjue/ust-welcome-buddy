# UST Buddy

UST Buddy is a knowledge-base AI assistant for HKUST freshmen. It answers student-life questions using a prepared Markdown knowledge base and MiniMax API, with source-grounded responses.

## Development Context

Before making changes, read these project notes first:

- `docs/project-state.md` - current architecture, features, limits, and next step
- `docs/change-log.md` - important change history
- `docs/decisions.md` - technical decisions and rationale

AI-assisted development should follow `AGENTS.md`.

## Target Users

- Incoming HKUST undergraduate and postgraduate students
- New students preparing for arrival, registration, housing, transport, SIM cards, payments, and campus systems
- Orientation helpers or student groups who need a lightweight freshman Q&A assistant

## Core Features

- Chat-first Q&A experience for HKUST freshman-life questions
- Prepared Markdown knowledge base maintained by the app owner/admin
- Local keyword search before calling the LLM
- MiniMax answer generation grounded in retrieved documents
- Source references with document title, source, update date, and category
- Clear fallback when the knowledge base does not cover a question
- Mobile-friendly single-page chat UI

## Tech Stack

- React
- TanStack Start
- TypeScript
- Markdown knowledge base
- `gray-matter` frontmatter parsing
- MiniMax OpenAI-compatible Chat Completions API
- Vercel deployment with Nitro output

## How It Works

1. A user asks a question in the chat page.
2. The frontend sends the question to `/api/chat`.
3. The server searches local Markdown documents in `content/knowledge/`.
4. If no relevant document is found, the API returns `当前知识库没有覆盖这个问题。`
5. If relevant documents are found, the server sends up to three context documents to MiniMax.
6. MiniMax generates a concise answer based only on the provided context.
7. The frontend renders the answer and source references.

Users cannot upload files in the current version. The knowledge base is prepared and maintained by the app owner/admin.

## Knowledge Base Format

Knowledge documents live in:

```text
content/knowledge/
```

Each Markdown file uses frontmatter:

```md
---
id: arrival
title: Arrival Routes to HKUST / 新生来港路线参考
category: Arrival
source: MSSS WeChat article - 2025年新生攻略20
updatedAt: 2025-08-13
keywords:
  - arrival
  - airport
  - HKUST
  - 新生来港
  - 机场
---

Markdown content goes here.
```

`keywords` should include both English and Chinese terms to improve retrieval for Chinese, English, and mixed-language questions.

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open the app:

```text
http://localhost:8081/chat
```

Run a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Environment Variables

Create `.env.local` for local development:

```env
MINIMAX_API_KEY=your_minimax_api_key
MINIMAX_BASE_URL=your_minimax_openai_compatible_base_url
MINIMAX_MODEL=your_minimax_model
```

Do not commit real API keys. Configure the same variables in Vercel Project Settings for production.

## Deployment

This project uses TanStack Start SSR with Nitro output for Vercel.

Recommended Vercel settings:

- Framework Preset: TanStack Start, or Other if TanStack Start is not available
- Build Command: `npm run build`
- Output Directory: `.output`
- Root Directory: `.`

The production build generates `.output/public` and `.output/server`.

## Current Limitations

- Retrieval is keyword-based, not semantic vector search
- The knowledge base is edited manually in Markdown files
- No admin import page yet
- No Supabase database or pgvector storage yet
- No user upload flow
- No question logging or analytics dashboard yet
- Answers depend on the coverage and freshness of the prepared documents

## Roadmap

### Current Version

- Markdown knowledge base
- Local search
- MiniMax answer generation
- Source references
- Vercel deployment

### Next

- Admin import page
- Supabase documents/chunks
- Question logs
- Hybrid search
- Image/OCR import
- Mainland China-friendly deployment

## Future Improvements

- Add an admin-only workflow for importing and validating Markdown documents
- Store documents and chunks in Supabase for easier maintenance
- Add question logs to identify missing knowledge and improve coverage
- Upgrade retrieval from keyword search to hybrid search
- Support image/OCR import for screenshots, PDFs, and public posts
- Improve deployment options for users in Mainland China
