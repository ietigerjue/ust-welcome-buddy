# UST Buddy / 港科新生助手

UST Buddy is a knowledge-base AI assistant for HKUST freshmen. It answers student-life questions using a prepared knowledge base, Hybrid Search, and MiniMax API, with source-grounded responses.

UST Buddy 是一个面向 HKUST / 港科大新生的知识库 AI 问答助手。它基于提前整理好的新生生活资料，通过混合检索和 MiniMax API 生成有来源依据的回答。

## Overview / 项目简介

Many incoming students have repeated practical questions before and after arriving in Hong Kong: how to get to campus, what to prepare for dorm move-in, how Octopus cards work, where to eat, and how to use systems such as Canvas and SIS.

UST Buddy turns those scattered student-life notes into a structured Q&A experience. Students ask questions in a chat interface, while the server retrieves relevant knowledge base chunks and asks the language model to answer only from the provided context.

很多 HKUST 新生在抵港前后都会遇到相似的问题：如何从机场去学校、宿舍入住要准备什么、八达通怎么用、校园哪里吃饭、Canvas 和 SIS 是什么等。

UST Buddy 将这些分散的新生生活资料整理为知识库问答体验。学生只需要在聊天框提问，后端会检索相关资料片段，并要求模型只基于检索到的内容回答。

## Target Users / 目标用户

- Incoming HKUST undergraduate and postgraduate students
- New students preparing for arrival, registration, housing, transport, campus systems, payments, and daily life
- Student helpers, orientation groups, or mentors who need a lightweight Q&A assistant

- 即将入学的 HKUST 本科生和研究生
- 正在准备来港、注册、住宿、交通、校园系统和日常生活的新生
- 需要快速回答常见问题的迎新组织、学生导师或 student helpers

## Core Features / 核心功能

- Chat-first Q&A interface
- Admin-prepared knowledge base
- Markdown, WeChat paste, Web URL, image/long screenshot, and DOCX import workflows
- Supabase `documents` / `document_chunks` knowledge store
- Hybrid Search with keyword retrieval and pgvector semantic retrieval
- MiniMax answer generation grounded in retrieved context
- Source references deduplicated by document
- Admin document management and read-only model configuration status
- Question logging and retrieval/model observability

- 以聊天框为核心的问答体验
- 由管理员提前准备和维护知识库
- 支持 Markdown、公众号正文粘贴、网页 URL、图片/长图、DOCX 导入
- 使用 Supabase `documents` / `document_chunks` 管理知识库
- 结合关键词检索和 pgvector 语义检索的 Hybrid Search
- 使用 MiniMax 基于检索上下文生成回答
- 按 document 去重展示来源引用
- 后台支持文档管理和模型环境配置状态查看
- 支持问题日志、检索和模型使用观测

## Tech Stack / 技术栈

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

## How It Works / 工作流程

1. A student asks a question on the chat page.
2. The frontend sends the question to `/api/chat`.
3. The server runs Hybrid Search over Supabase `document_chunks`.
4. Top chunks are passed to the configured text model as grounded context.
5. The model answers only from the provided context.
6. The frontend displays the answer and deduplicated source references.
7. If the knowledge base does not cover the question, the app returns a clear not-covered message.

1. 学生在 Chat 页面提出问题。
2. 前端将问题发送到 `/api/chat`。
3. 后端在 Supabase `document_chunks` 中执行 Hybrid Search。
4. 排名前列的 chunks 会作为上下文传给文本模型。
5. 模型只能基于提供的上下文回答。
6. 前端展示回答和去重后的来源卡片。
7. 如果当前知识库没有覆盖该问题，系统会明确提示无法覆盖。

## Knowledge Base Format / 知识库格式

Local seed knowledge can be stored as Markdown files under:

本地种子知识库可以放在：

```text
content/knowledge/
```

Each Markdown document can use frontmatter:

每篇 Markdown 文档可以使用 frontmatter：

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

后台导入会将文档级 metadata 写入 `documents`，并将可检索内容切分写入 `document_chunks`。

## Local Development / 本地开发

Install dependencies:

安装依赖：

```bash
npm install
```

Create a local environment file from the template:

根据模板创建本地环境变量文件：

```bash
cp .env.example .env.local
```

Start the development server:

启动开发服务器：

```bash
npm run dev
```

Open the admin import page directly:

直接启动并打开后台导入页：

```bash
npm run admin
```

Useful checks:

常用检查命令：

```bash
npm run check:env
npm run check:secrets
npm run test:retrieval
npm run test:hybrid-stability
```

## Environment Variables / 环境变量

The project uses server-side environment variables for Supabase, admin access, LLM providers, image parsing, and embeddings.

本项目使用服务端环境变量配置 Supabase、管理员访问、LLM provider、图片解析和 embedding provider。

Typical variables include:

常见变量包括：

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ADMIN_IMPORT_TOKEN
MINIMAX_API_KEY
MINIMAX_BASE_URL
MINIMAX_MODEL
MINIMAX_VLM_API_KEY
MINIMAX_VLM_BASE_URL
MINIMAX_VLM_ENDPOINT
EMBEDDING_API_KEY
EMBEDDING_BASE_URL
EMBEDDING_MODEL
EMBEDDING_DIMENSIONS
```

Do not commit real API keys, service role keys, admin tokens, or `.env.local`.

请不要提交真实 API key、Supabase service role key、Admin Token 或 `.env.local`。

Model runtime configuration is environment-only. After changing `.env.local`, restart the development server; after changing Vercel Environment Variables, redeploy the project. `/admin/settings` is a read-only status page.

模型运行配置仅来自环境变量。修改 `.env.local` 后需要重启开发服务器；修改 Vercel Environment Variables 后需要重新部署。`/admin/settings` 只用于查看配置状态。

## Deployment / 部署

UST Buddy is a TanStack Start SSR app, not a static Vite SPA.

UST Buddy 是 TanStack Start SSR 应用，不是普通静态 Vite SPA。

Recommended Vercel settings:

推荐 Vercel 配置：

- Build Command: `npm run build`
- Output Directory: `.output`
- Root Directory: `.`

Configure all real secrets in Vercel Environment Variables.

所有真实密钥都应配置在 Vercel Environment Variables 中。

## Current Limitations / 当前限制

- Admin access currently uses a shared token instead of a full login system.
- Vector search requires prepared embeddings and a working Supabase pgvector RPC.
- Mainland China-friendly deployment still needs a dedicated runtime/CDN/provider access plan.
- The public chat page does not support user uploads.
- The app does not perform public real-time web search.

- 后台访问目前使用共享 Admin Token，还不是完整登录系统。
- 语义检索依赖已生成的 embeddings 和可用的 Supabase pgvector RPC。
- 面向中国大陆稳定访问的部署方案仍需要单独规划运行环境、CDN 和模型访问路径。
- 普通用户端 Chat 页面不支持上传资料。
- 当前不提供公开实时联网搜索。

## Future Improvements / 后续优化方向

- Full admin authentication and role-based access control
- More robust ingestion review and duplicate handling workflows
- Question analytics dashboard
- Larger retrieval evaluation set
- Mainland China-friendly deployment
- More model providers through the existing provider/router/config layer

- 完整后台登录和角色权限
- 更完善的导入审核与重复内容处理流程
- 问题日志和知识库质量分析面板
- 更大规模的检索评测集
- 更适合中国大陆访问的部署方案
- 通过现有 model router / config 层支持更多模型 provider

## Portfolio Note / 作品集说明

This project demonstrates a practical RAG product workflow: knowledge ingestion, chunking, retrieval, grounded answer generation, admin tooling, and deployment considerations.

这个项目展示了一个完整的 RAG 应用工作流：知识库导入、内容切分、检索、基于上下文回答、后台管理工具和部署规划。

## License / 许可

No license is currently included. Please contact the maintainer before reusing this code.

当前未附带开源许可证。如需复用代码，请先联系项目维护者。
