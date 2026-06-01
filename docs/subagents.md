# UST Buddy Subagents

This document defines lightweight subagent roles for future AI-assisted development. Subagents must not assume fixed providers or model names. All AI calls should go through provider, router, or config layers.

## model-agent

Responsibilities:

- LLM provider abstraction.
- Model router design.
- `app_config` schema and config loading.
- Provider fallback behavior.
- Model usage logging.
- Clear missing-config errors.

Constraints:

- Do not hardcode provider or model names in business logic.
- Do not expose API keys to frontend code.
- Do not scatter model config across API routes or Admin UI.
- Preserve current working providers through compatibility fallbacks.

## retrieval-agent

Responsibilities:

- Hybrid Search.
- Supabase pgvector search.
- Keyword and vector result merging.
- Embedding provider calls.
- Embedding dimension consistency.
- Retrieval testing and ranking evaluation.

Constraints:

- Do not assume a permanent embedding provider or dimension.
- Read current defaults from docs/config and provider env.
- If embedding dimensions change, document SQL/RPC migration steps.
- Preserve source deduplication by document.

## ingestion-agent

Responsibilities:

- Markdown import.
- WeChat paste import.
- Image import.
- Metadata extraction.
- Image parsing provider integration.
- Import fallback behavior.

Constraints:

- Do not assume one permanent image parser provider.
- Do not auto-write parsed content to Supabase without admin confirmation.
- Do not fake OCR or image understanding results.
- Do not expose provider secrets to the browser.

## admin-agent

Responsibilities:

- `/admin/settings`.
- Model configuration UI.
- Admin Token protected APIs.
- Safe display and update of provider/model config.

Constraints:

- Admin Token must be validated server-side.
- Do not display raw API keys in the browser.
- Admin UI may edit provider/model/config key references, not secrets.
- Do not add admin links to public user navigation unless explicitly requested.

## qa-agent

Responsibilities:

- Test different provider configurations.
- Test fallback behavior.
- Test missing-config behavior.
- Test model usage logs.
- Test retrieval quality across keyword/vector/hybrid modes.

Constraints:

- Do not call expensive real models unless the task explicitly allows it.
- Prefer dry-run and config validation scripts.
- Verify that provider failures do not break unrelated user flows.

## docs-agent

Responsibilities:

- Keep `docs/project-state.md`, `docs/change-log.md`, and `docs/decisions.md` synchronized.
- Maintain `docs/model-config.md`.
- Record current default provider/model configuration.
- Record provider change history and migration notes.

Constraints:

- Separate current defaults from permanent rules.
- Do not describe a provider as required unless the architecture truly requires it.
- Keep docs concise enough for future agents to read quickly.
