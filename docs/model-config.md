# UST Buddy Model Configuration

UST Buddy supports replaceable providers for AI-related work. Provider and model choices are routed through the configuration layer, with server environment variables as the only runtime source of truth.

## Configurable Model Types

- `chat_llm`: answer generation for `/api/chat`.
- `metadata_llm`: metadata extraction for Markdown, WeChat paste, image/OCR text, and future ingestion flows.
- `image_parser`: VLM/OCR/image understanding provider for image and long screenshot import.
- `embedding`: embedding provider and model for pgvector retrieval.

## Legacy Supabase Table

```sql
create table if not exists app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);
```

The concrete SQL lives in `supabase/app-config.sql`, but the table is retained only for compatibility/history and no longer overrides runtime configuration.

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

- Runtime provider/model/Base URL/API Key values come only from `.env.local` or deployment environment variables.
- Legacy `app_config` and `model_secrets` rows are not read by model calls.
- `base_url_env`, `api_key_env`, and `endpoint_env` values must be environment variable names such as `DEEPSEEK_API_KEY`, not raw URLs, tokens, or API keys.
- Real API keys must stay in `.env.local`, deployment environment variables, or backend encrypted secret storage.
- Admin Settings shows provider/model/env-var names and configured booleans, but cannot edit or reveal secret values.

## Operational Rules

- If `chat_llm` changes, test `/api/chat` before release.
- Knowledge-base chat answers should use low-randomness decoding (`temperature = 0.1`, `top_p = 0.3`, `max_tokens = 1500`) so repeated questions over the same retrieved context remain stable.
- If `metadata_llm` changes, test Markdown, WeChat paste, and image-derived metadata extraction.
- If `image_parser` changes, test `/api/admin/parse-image` before release.
- If `embedding` provider or model changes, test `npm run test:embedding` and `npm run test:vector-search`.
- After changing `embedding`, test a small Admin Import because `/admin/import` now triggers `/api/admin/embed-chunks` for newly imported document chunks.
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
- `getAppConfig()` always returns environment-derived configuration. Supabase rows do not override it.
- `CHAT_LLM_PROVIDER` or `LLM_PROVIDER` selects the chat provider; `METADATA_LLM_PROVIDER` or `LLM_PROVIDER` selects the metadata provider. If none is set, the default is `minimax`.
- Text model fallback is provider-specific: MiniMax reads `MINIMAX_MODEL`, DeepSeek reads `DEEPSEEK_MODEL`. A model value from the other provider is never reused.
- Switching providers requires updating the relevant environment variables and restarting the local server or redeploying production.
- The reader returns env var names and env existence booleans only; it must not print or return secret values.
- `getLLMProvider()`, `getEmbeddingProvider()`, and `getImageParserProvider()` return non-secret provider descriptors.
- Before a provider call, `modelRouter` checks the configured `api_key_env` and `base_url_env` against `process.env`. Missing variables produce: `Provider is configured but required environment variable is missing.`
- Before a provider call, `modelRouter` resolves the configured environment variable names only.
- Existing chat generation, metadata extraction, embedding generation, and image parser configuration use the router while preserving current provider behavior.
- `/api/admin/embed-chunks` uses the same embedding provider configuration as `npm run embed:chunks` and `searchVectorKnowledgeBase`.
- The current image parser endpoint does not require a model field at runtime; API key and base URL remain required.
- `GET /api/admin/config` reports environment-derived config and presence booleans without returning values.
- `PUT /api/admin/config` is disabled and returns `409` with environment update instructions.
- `npm run test:model-config` does not call real models or write Supabase rows. It verifies that all routed configs are environment-managed.

## Admin Settings Fields

`/admin/settings` lets admins view:

- provider
- model
- base URL env var name
- API key env var name
- `keyConfigured` true/false status for the named API key env var
- dimensions for embeddings
- fallback provider
- enabled

It does not save configuration. When `keyConfigured=false`, configure the named API key variable in `.env.local` for local development or Vercel Environment Variables for deployment, then restart or redeploy.
