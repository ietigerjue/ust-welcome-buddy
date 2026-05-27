# UST Buddy

UST Buddy is a knowledge-base AI assistant for HKUST freshmen. It answers student-life questions using a prepared local knowledge base and MiniMax API, with source-grounded responses.

## Target Users

- Incoming HKUST undergraduate and postgraduate students
- New students planning arrival, housing, SIM cards, transport, campus dining, and campus systems
- Student helpers or orientation teams who need a lightweight freshman Q&A demo

## Core Features

- Chat-first interface for asking HKUST freshman-life questions
- Prepared local knowledge base managed by the app owner/admin
- Simple keyword retrieval over local documents before calling the LLM
- MiniMax-powered answer generation with source-grounded context
- Source references shown with title, source, update date, and category
- Fallback message when the local knowledge base does not cover a question
- Mobile-friendly single-page chat experience

## Tech Stack

- React / TanStack Start
- TypeScript
- Local knowledge base
- MiniMax API
- Vercel

## How It Works

1. The user asks a question in the chat page.
2. The frontend sends the question to `/api/chat`.
3. The server searches the prepared local knowledge base.
4. If no relevant document is found, the API returns: `当前知识库没有覆盖这个问题。`
5. If relevant documents are found, the API sends up to three context documents to MiniMax.
6. MiniMax generates a concise answer based only on the provided context.
7. The frontend renders the answer and source references.

普通用户不能上传资料。知识库由 app owner/admin 提前维护在本地文件中。

## Local Development

```bash
npm install
npm run dev
```

Open the local app at:

```text
http://127.0.0.1:8080/chat
```

Run a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Environment Variables

Create a `.env.local` file for local development:

```env
MINIMAX_API_KEY=your_minimax_api_key
MINIMAX_BASE_URL=your_minimax_openai_compatible_base_url
MINIMAX_MODEL=your_minimax_model
```

Never commit real API keys. Configure the same variables in Vercel Project Settings for production.

## Deployment

This project uses TanStack Start SSR and Nitro output for Vercel.

Recommended Vercel settings:

- Framework Preset: TanStack Start, or Other if TanStack Start is not available
- Build Command: `npm run build`
- Output Directory: `.output`
- Root Directory: `.` when this repository root is the project root

The build output is generated under `.output`, including `.output/public` and `.output/server`.

## Future Improvements

- Expand the HKUST freshman knowledge base with more official-source-backed documents
- Add better ranking, synonyms, and multilingual keyword matching
- Add automated tests for retrieval and `/api/chat`
- Improve answer formatting for bilingual questions
- Add admin-only workflows for maintaining the local knowledge base
- Add monitoring for API errors and missing-knowledge questions
