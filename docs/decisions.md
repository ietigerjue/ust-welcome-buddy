# UST Buddy Technical Decisions

This file records why the project is shaped the way it is. Update it when a major architectural choice changes.

## Closed-Source Repository Strategy

UST Buddy is maintained as a private, proprietary project rather than an open-source package. The README and handoff docs are written for authorized internal collaborators, not public community distribution. The repository should remain private unless the maintainer explicitly approves a public release process, secret audit, key rotation, and licensing decision.

No open-source license is currently provided. If an open-source license is added later, the team must confirm that it matches the intended distribution policy before making the repository public.

The public/portfolio README is preserved separately as `docs/portfolio-readme.md` instead of mixed into the root private README. If the repository is made public later, the team can promote that draft after removing private operational details, running secret checks, and rotating any credentials that may have been exposed.

## Secrets Stay Outside Git

Real environment files and credentials must stay outside Git. `.env.example` is committed as a placeholder-only template, while `.env.local`, `.env`, and `.env.*.local` are ignored. `npm run check:env` verifies environment variable presence without printing values, and `npm run check:secrets` checks tracked files for obvious secret patterns and tracked env files before commits or visibility changes.

`app_config` remains non-secret by design. It stores provider/model metadata and environment variable names only. Real API keys, Supabase service role keys, Admin Tokens, Vercel tokens, provider keys, and proxy credentials must stay in `.env.local`, Vercel Environment Variables, or backend encrypted secret storage.

Backend model secret storage is intentionally separate from `app_config`. `/admin/settings` may accept direct provider API Keys and Base URLs as write-only inputs, but the API encrypts them into `model_secrets` using `MODEL_SECRET_ENCRYPTION_KEY`. GET responses return only configured booleans, never raw values. This lets authorized admins rotate provider credentials without exposing them through frontend state or non-secret configuration rows.

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

## Web URL Import Is Single-Page And SSRF-Guarded

Admin URL import exists to help maintainers turn one known public webpage into knowledge base content. It is not a public search feature, crawler, or recursive scraper. `/api/admin/parse-url` accepts only `http` and `https`, validates DNS resolution, rejects localhost/private-network/file/data URLs, limits response size, follows only a small number of redirects, and never writes directly to Supabase. Admin review plus the existing Import action remains the write boundary.

For `https://mp.weixin.qq.com/*`, URL import uses a dedicated WeChat article parser because title, account name, body content, and body images live in WeChat-specific DOM fields. The parser handles one administrator-provided article URL only, does not crawl related links, and does not bypass WeChat access restrictions. If WeChat returns an abnormal or access-restricted page, the API returns a clear error instead of importing partial content. Body images are parsed through the existing MiniMax API-vlm image understanding path and appended to the content for admin review.

## Word Import Supports `.docx` Only

Task H uses `mammoth` to extract raw text from modern Word `.docx` files. The first version does not support legacy `.doc` files because that generally requires a conversion tool such as LibreOffice and a separate operational setup. Uploading `.doc` returns `Only .docx is supported for now.`

Word import does not parse embedded images, perform OCR on Word media, or preserve complex table layout in the first version. Extracted text is cleaned and then sent through the existing metadata LLM configuration; metadata failure falls back to the file name/content preview without blocking parse success.

## Sources Are Deduplicated By Document

Retrieval can return multiple chunks from the same document. Showing each chunk as a separate source card creates repeated references and confuses users. `/api/chat` can pass top chunks to the model, but the frontend should receive deduplicated document-level sources.

## Duplicate Handling Uses Exact Normalized Hashes

The first duplicate-handling layer uses exact SHA-256 hashes over normalized text. `normalizeForHash()` lowercases text, trims it, compresses repeated whitespace, and removes obvious extra blank lines before hashing. This catches repeated imports and repeated chunks caused by formatting differences without introducing costly semantic duplicate detection.

Admin Import writes `documents.content_hash` and `document_chunks.content_hash`. If a document with the same full-content hash already exists, the API returns a warning but does not block import. Repeated chunks inside the same document are skipped, and chunk unique-index conflicts become warnings so one duplicate chunk does not fail the whole import.

Hybrid Search also dedupes top context candidates by `content_hash`, falling back to a normalized content hash when the database field is missing. When duplicate chunks are found, the highest-ranked candidate is kept.

This version intentionally does not do semantic similarity duplicate detection, automatic document merging, automatic duplicate deletion, or hard duplicate-document blocking. Those choices keep the system predictable while the knowledge base and admin workflow are still evolving.

## Semantic Duplicate Review Is Advisory

Task K adds semantic duplicate review before admin import, but it remains advisory. Parse endpoints call `reviewSemanticDuplicates()` after content extraction and metadata generation, then return `duplicate_review` candidates to `/admin/import`. The admin can review potential overlaps and still choose to import.

The first semantic duplicate review uses the existing embedding provider and Supabase pgvector RPC `match_duplicate_chunks`. The default threshold is `0.82`, configurable through `SEMANTIC_DUPLICATE_THRESHOLD`. Similarity `>= 0.88` is treated as high-risk overlap, while `0.82-0.88` is treated as possible overlap.

The system does not automatically delete, merge, replace, block, cluster, or rebuild embeddings. This keeps ingestion reversible and human-reviewed while still reducing accidental duplicate imports.

## MiniMax API-vlm For Image Parsing

MiniMax M2.7 chat-model image input was unreliable for long screenshots and posters. The image import flow therefore prioritizes MiniMax API-vlm through `/v1/coding_plan/vlm`, which is designed as an independent image understanding endpoint. If VLM fails, the app can fall back to OCR; it must not invent OCR output.

## Jina For Embeddings

Jina is the current default embedding provider because it exposes a straightforward embeddings API and works well for a replaceable provider layer. The implementation remains provider-oriented so MiniMax or another OpenAI-compatible embedding service can be swapped in through environment variables.

## Admin Import Embedding Backfill Is Best-Effort

Admin Import writes `documents` and `document_chunks` first, then triggers `/api/admin/embed-chunks` for the newly imported document. Embedding generation is intentionally outside the import transaction because provider calls can be slow, fail, or cost money. If automatic embedding fails, the import remains valid and the admin can retry with `npm run embed:chunks`.

The endpoint is protected by `ADMIN_IMPORT_TOKEN`, processes only chunks whose `embedding` is null, caps one request to 50 chunks, and uses the existing embedding provider layer. This keeps new documents more likely to appear in vector search quickly without making import success depend on an external embedding API.

## Configurable Model Providers

Provider/model choices should be configurable rather than hardcoded in business logic. Chat answers, metadata extraction, image parsing, OCR/VLM behavior, and embeddings should move toward a provider/router/config architecture. `app_config` may store provider/model metadata and env var names, but real API keys must remain in environment variables or a secrets manager.

## Model Router Returns Non-Secret Descriptors

`src/lib/modelRouter.ts` is the runtime boundary between app configuration and provider calls. It returns provider/interface/model/env-var-name descriptors for chat LLM, metadata LLM, embeddings, and image parsing without exposing real API keys. Server-side callers resolve API keys only at the final call site, keeping secrets out of test output, UI state, and config records.

Before any configured provider call, the router validates that the configured `api_key_env` and `base_url_env` names exist in `process.env`. Missing variables return the shared message `Provider is configured but required environment variable is missing.` plus the missing variable names. The error path reports env var names only and never logs or returns real API key values.

## Admin Settings Keeps `app_config` Non-Secret

`/admin/settings` lets admins change provider/model configuration without editing code, but it intentionally stores only provider names, model names, dimensions, fallback settings, and environment variable names in Supabase `app_config`. Real API keys stay in `.env.local`, Vercel Environment Variables, or another secrets manager. This keeps the admin UI useful while avoiding credential exposure through browser state, database rows, logs, or API responses.

The admin settings surface may show `api_key_env` and booleans such as `keyConfigured` / `baseUrlConfigured`, but it must not show real key values. If direct API Key or Base URL entry is needed, those fields are write-only and saved to `model_secrets`, not `app_config`. If `keyConfigured=false`, admins should configure the named variable in `.env.local` or Vercel Environment Variables, or save a write-only key after enabling backend encrypted storage.

## Model Config Tests Avoid Real Model Calls

Model configuration tests validate the configuration path rather than provider behavior. `npm run test:model-config` reads `app_config`, checks env-var-name wiring, temporarily changes `chat_llm` provider/model, verifies the read layer sees the change, and restores the original row. It does not call MiniMax, Jina, OCR, VLM, or any other paid model endpoint, which keeps the test safe to run during admin settings work.

## Hybrid Search For `/api/chat`

Keyword search handles exact phrases, HKUST-specific names, and bilingual terms well. Vector search improves recall for paraphrased questions. `/api/chat` therefore combines both paths, dedupes by chunk, reranks with normalized keyword score weight 0.5 and vector similarity weight 0.5, adds a 0.15 bonus when both methods find the same chunk, truncates each selected chunk to control token cost, and still dedupes displayed sources by document.

Hybrid Search ranking must be stable when the question and database are unchanged. The shared `src/lib/hybridSearch.ts` merge layer sorts by final score descending, then document id ascending, then chunk index ascending, then chunk id. This prevents equal or near-equal retrieval scores from changing the context chunk order sent to the LLM.

## Low-Randomness Chat Generation

For knowledge-base Q&A, answer stability is more important than creative variation. `/api/chat` keeps retrieval deterministic enough through Hybrid Search, and `generateAnswer()` now uses `temperature = 0.1`, `top_p = 0.3`, and `max_tokens = 1500` so repeated questions over the same context are less likely to drift into unsupported fallback answers.

## Retrieval Evaluation As A Script

Hybrid Search quality depends on the current Supabase knowledge base, embeddings, and RPC behavior, so retrieval evaluation is implemented as a repeatable script rather than a mocked unit test. `docs/retrieval-eval.md` records fixed questions and expectations, while `npm run test:retrieval` checks top retrieval results without calling answer generation.

## Question Log Observability

`question_logs` is the first observability surface for chat quality, retrieval behavior, and rough cost control. `/api/chat` logs retrieval mode, context chunk count, model provider/name, coarse token estimates, and latency on best-effort inserts. Token counts are approximate (`Math.ceil(text.length / 3)`) because this is meant for trend tracking and debugging, not billing-grade accounting. Logging failures must remain non-blocking so user chat is not affected by analytics table drift.

## Mainland China Access Is Deferred

Network access from Mainland China to model providers can be unstable. The current code supports proxy variables for embeddings, but full Mainland-friendly deployment is postponed. That work should be handled as a deployment and provider-routing decision, not patched ad hoc into chat or admin UI code.

## Mainland Deployment Should Be Staged

The Mainland China deployment plan should start with a domestic SSR runtime plus CDN while keeping Vercel and the current Supabase deployment as the rollback path. This avoids rewriting TanStack Start into a static SPA and lets the team test real Mainland latency before migrating the data plane.

If Supabase international access is too slow from the domestic runtime, the preferred compatible path is self-hosted Supabase in Mainland China, because the current app uses Supabase HTTP APIs, service role keys, and RPC-style pgvector search. Moving directly to plain managed PostgreSQL may be valuable later, but it requires a planned data-access refactor rather than a deployment-only change.

Domestic CDN/runtime setup must handle ICP, HTTPS, CDN no-cache rules for `/api/*` and `/admin/*`, and server-only secret storage. `/admin/settings` should continue to store provider/model/env-var names only; real keys remain in runtime environment variables.

The first recommended Mainland experiment is Alibaba Cloud Function Compute or Tencent Cloud SCF plus domestic CDN/custom HTTPS domain, with current Supabase kept for smoke testing. This separates app-delivery problems from database/provider egress problems. Only after measuring `/api/chat`, Admin Import, retrieval, and question log latency should the team move the data plane.

Cloudflare China Network is documented as an enterprise-grade option rather than the default path. It can be useful for institutional deployment, but it still requires China-specific onboarding/compliance and is too heavy for the first small production experiment.
