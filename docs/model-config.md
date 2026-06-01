# UST Buddy Model Configuration

UST Buddy should support replaceable providers for AI-related work. Provider and model choices must be read through configuration layers, not hardcoded in business logic.

## Configurable Model Types

- `chat_llm`: answer generation for `/api/chat`.
- `metadata_llm`: metadata extraction for Markdown, WeChat paste, image/OCR text, and future ingestion flows.
- `image_parser`: VLM/OCR/image understanding provider for image and long screenshot import.
- `embedding`: embedding provider and model for pgvector retrieval.

## Recommended Supabase Table

```sql
create table if not exists app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);
```

The concrete SQL for this project lives in `supabase/app-config.sql`.

## Recommended Config Shape

This is an example shape and may reflect the current default deployment. It is not a permanent rule.

```json
{
  "chat_llm": {
    "provider": "minimax",
    "model": "MiniMax-M2.7",
    "base_url_env": "MINIMAX_BASE_URL",
    "api_key_env": "MINIMAX_API_KEY"
  },
  "metadata_llm": {
    "provider": "minimax",
    "model": "MiniMax-M2.7",
    "base_url_env": "MINIMAX_BASE_URL",
    "api_key_env": "MINIMAX_API_KEY"
  },
  "image_parser": {
    "provider": "minimax_vlm",
    "model": "api-vlm",
    "base_url_env": "MINIMAX_VLM_BASE_URL",
    "api_key_env": "MINIMAX_VLM_API_KEY",
    "fallback_provider": "ocr"
  },
  "embedding": {
    "provider": "jina",
    "model": "jina-embeddings-v3",
    "dimensions": 1024,
    "base_url_env": "EMBEDDING_BASE_URL",
    "api_key_env": "EMBEDDING_API_KEY"
  }
}
```

## Secret Handling

- `app_config` stores provider names, model names, env var names, dimensions, and fallback settings.
- `app_config` must not store real API keys.
- `base_url_env`, `api_key_env`, and `endpoint_env` values must be environment variable names such as `DEEPSEEK_API_KEY`, not raw URLs, tokens, or API keys.
- Real API keys must stay in `.env.local`, deployment environment variables, or a secrets manager.
- Admin Settings may show provider/model/config fields, but must not reveal secret values.

## Operational Rules

- If `chat_llm` changes, test `/api/chat` before release.
- If `metadata_llm` changes, test Markdown, WeChat paste, and image-derived metadata extraction.
- If `image_parser` changes, test `/api/admin/parse-image` before release.
- If `embedding` provider or model changes, test `npm run test:embedding` and `npm run test:vector-search`.
- If embedding dimensions change, rebuild `document_chunks.embedding`, update pgvector SQL/RPC, rerun `npm run embed:chunks`, and document migration steps.
- Missing config must produce a clear error or explicit fallback.
- Model usage logs should record provider/model actually used when available.

## Current Implementation

- Config reader: `src/lib/appConfig.ts`.
- Model router: `src/lib/modelRouter.ts`.
- Admin settings page: `/admin/settings`.
- Admin config API: `GET /api/admin/config` and `PUT /api/admin/config`.
- Supported keys: `chat_llm`, `metadata_llm`, `image_parser`, `embedding`.
- Test script: `npm run test:app-config`.
- Router test script: `npm run test:model-router`.
- Admin config API test script: `npm run test:admin-config`.
- Model config QA script: `npm run test:model-config`.
- Supabase rows override environment defaults when present.
- Missing rows, missing table, or Supabase read errors fall back to current environment defaults.
- The reader returns env var names and env existence booleans only; it must not print or return secret values.
- `getLLMProvider()`, `getEmbeddingProvider()`, and `getImageParserProvider()` return non-secret provider descriptors.
- Before a provider call, `modelRouter` checks the configured `api_key_env` and `base_url_env` against `process.env`. Missing variables produce: `Provider is configured but required environment variable is missing.`
- Existing chat generation, metadata extraction, embedding generation, and image parser configuration use the router while preserving current provider behavior.
- The current image parser endpoint does not require a model field at runtime; API key and base URL remain required.
- `/api/admin/config` rejects raw secret-like fields such as `api_key`, `secret`, `token`, and `password`.
- `/api/admin/config` only persists provider, model, base URL env var name, API key env var name, endpoint env var name, dimensions, fallback provider, and enabled.
- Changing embedding dimensions returns a warning because it requires rebuilding `document_chunks.embedding` and the pgvector RPC.
- `npm run test:model-config` does not call real models. It temporarily updates `chat_llm` provider/model in `app_config`, verifies `getModelConfig("chat_llm")` reads the new values, and restores the original row.

## Admin Settings Fields

`/admin/settings` lets admins view and update:

- provider
- model
- base URL env var name
- API key env var name
- `keyConfigured` true/false status for the named API key env var
- dimensions for embeddings
- fallback provider
- enabled

It should not let admins view or paste raw API keys into the browser.

When `keyConfigured=false`, configure the named API key variable in `.env.local`
for local development or Vercel Environment Variables for deployment.
