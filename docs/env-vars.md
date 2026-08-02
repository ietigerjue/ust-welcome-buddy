# Environment Variables

UST Buddy keeps real secrets in local or deployment environment variables. `.env.example` is a safe template. `.env.local` is private and must not be committed.

`/admin/settings` stores provider/model names and environment variable names in Supabase `app_config`. If an admin enters a direct API Key or Base URL, it is saved only to backend encrypted secret storage and is never returned to the frontend.

| Variable | Purpose | Required | Source | Local config | Vercel config | Secret |
|---|---|---:|---|---|---|---:|
| `RAG_DEBUG` | Enables server-only retrieval debug logs for `/api/chat` when set to `true`. | No | App runtime | `.env.local` | Project Environment Variables | No |
| `ADMIN_IMPORT_TOKEN` | Protects admin pages and admin APIs through `x-admin-token`. | Yes | Maintainer generated | `.env.local` | Project Environment Variables | Yes |
| `SUPABASE_URL` | Supabase project URL used by server-side APIs and scripts. | Yes | Supabase project settings | `.env.local` | Project Environment Variables | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase privileged key for admin writes and logs. | Yes | Supabase API settings | `.env.local` | Project Environment Variables | Yes |
| `MODEL_SECRET_ENCRYPTION_KEY` | Encrypts model API keys and direct Base URLs saved through `/admin/settings`. Required only when using backend secure model secret storage. Use a random 32-byte base64 or 64-character hex key. | No | Maintainer generated | `.env.local` | Project Environment Variables | Yes |
| `LLM_PROVIDER` | Optional chat provider selector fallback. | No | Maintainer choice | `.env.local` | Project Environment Variables | No |
| `MINIMAX_API_KEY` | MiniMax text LLM API key for chat answers and metadata extraction. Required only when MiniMax is the selected text provider. | Provider-dependent | MiniMax console | `.env.local` | Project Environment Variables | Yes |
| `MINIMAX_BASE_URL` | MiniMax text LLM base URL. | Provider-dependent | MiniMax docs/config | `.env.local` | Project Environment Variables | No |
| `MINIMAX_MODEL` | MiniMax text LLM model name. | Provider-dependent | MiniMax docs/config | `.env.local` | Project Environment Variables | No |
| `DEEPSEEK_API_KEY` | Optional DeepSeek text LLM API key for chat answers and metadata extraction. Required only when DeepSeek is the selected text provider. | Provider-dependent | DeepSeek console | `.env.local` | Project Environment Variables | Yes |
| `DEEPSEEK_BASE_URL` | Optional DeepSeek OpenAI-compatible API base URL. | Provider-dependent | DeepSeek docs/config | `.env.local` | Project Environment Variables | No |
| `DEEPSEEK_MODEL` | Optional DeepSeek model name, for example `deepseek-v4-pro`. | Provider-dependent | DeepSeek docs/config | `.env.local` | Project Environment Variables | No |
| `METADATA_LLM_PROVIDER` | Optional metadata provider selector fallback. | No | Maintainer choice | `.env.local` | Project Environment Variables | No |
| `IMAGE_PARSE_PROVIDER` | Image parser provider, currently `minimax_vlm` by default. | No | Maintainer choice | `.env.local` | Project Environment Variables | No |
| `MINIMAX_VLM_API_KEY` | MiniMax API-vlm key for image and long screenshot import. | Required for image import | MiniMax console | `.env.local` | Project Environment Variables | Yes |
| `MINIMAX_VLM_BASE_URL` | MiniMax VLM base URL. | Required for image import | MiniMax docs/config | `.env.local` | Project Environment Variables | No |
| `MINIMAX_VLM_ENDPOINT` | MiniMax VLM endpoint path. | Required for image import | MiniMax docs/config | `.env.local` | Project Environment Variables | No |
| `EMBEDDING_PROVIDER` | Embedding provider selector, currently `jina` by default. | Required for vector search rebuilds | Maintainer choice | `.env.local` | Project Environment Variables | No |
| `EMBEDDING_API_KEY` | Embedding API key. | Required for vector search rebuilds | Provider console | `.env.local` | Project Environment Variables | Yes |
| `EMBEDDING_BASE_URL` | Embedding API base URL. | Required for vector search rebuilds | Provider docs/config | `.env.local` | Project Environment Variables | No |
| `EMBEDDING_MODEL` | Embedding model name. | Required for vector search rebuilds | Provider docs/config | `.env.local` | Project Environment Variables | No |
| `EMBEDDING_DIMENSIONS` | Embedding vector dimensions. | Required for vector search rebuilds | Provider docs/config | `.env.local` | Project Environment Variables | No |
| `SEMANTIC_DUPLICATE_THRESHOLD` | Similarity threshold for admin duplicate review before import. Defaults to `0.82`. | No | Maintainer choice | `.env.local` | Project Environment Variables | No |
| `HTTPS_PROXY` | Optional outbound proxy for provider calls. | No | Network operator | `.env.local` | Project Environment Variables | Secret if it contains credentials |
| `HTTP_PROXY` | Optional outbound proxy for provider calls. | No | Network operator | `.env.local` | Project Environment Variables | Secret if it contains credentials |
| `OPENAI_API_KEY` | Reserved for future provider work. | No | Provider console | `.env.local` | Project Environment Variables | Yes |
| `DEEPSEEK_API_KEY` | Reserved for future provider work. | No | Provider console | `.env.local` | Project Environment Variables | Yes |

## Operational Rules

- Do not commit `.env.local`, `.env`, or `.env.*.local`.
- `/admin/settings` may accept direct API Keys and Base URLs only as write-only fields. They must go to backend encrypted secret storage, not `app_config`, logs, or frontend state.
- Prefer env var names such as `MINIMAX_API_KEY` for portable deployments; use backend secure storage when admins need to rotate providers without editing deployment env vars.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.
- Apply `supabase/model-secrets.sql` before saving direct provider secrets from `/admin/settings`.
- Rotate keys after any suspected exposure.
- Run `npm run check:env` before local handoff testing.
- Run `npm run check:secrets` before committing or changing repository visibility.

## DeepSeek Text LLM Example

For local DeepSeek chat and metadata testing, keep secrets in `.env.local`:

```env
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=replace_with_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
```

If Supabase `app_config` already has rows for `chat_llm` or `metadata_llm`, update `/admin/settings` so those sections use `provider=deepseek`, `model=deepseek-v4-pro`, `base_url_env=DEEPSEEK_BASE_URL`, and `api_key_env=DEEPSEEK_API_KEY`; otherwise the Supabase row can continue pointing runtime calls at MiniMax.
