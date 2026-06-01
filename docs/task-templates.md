# UST Buddy Task Templates

Use these templates when creating future subagent tasks.

## Common Constraints

- Do not hardcode provider/model names.
- Read `docs/model-config.md` before changing AI-related code.
- If changing model provider behavior, update `docs/model-config.md`.
- If changing embedding model dimensions, update Supabase SQL/RPC docs and document migration steps.
- Do not expose API keys, service role keys, or admin tokens to frontend code.
- Keep changes scoped and update `docs/project-state.md`, `docs/change-log.md`, and `docs/decisions.md` when architecture changes.

## Feature Task

```md
Task:

Owner subagent:

Goal:

Scope:

Out of scope:

Constraints:
- Do not hardcode provider/model names.
- Read `docs/model-config.md` before changing AI-related code.

Acceptance:

Verification:

Docs to update:
```

## Provider Task

```md
Task:

Owner subagent: model-agent

Goal:

Provider config fields:

Fallback behavior:

Scope:

Out of scope:

Constraints:
- Do not store real API keys in Supabase.
- Do not expose secrets in Admin UI.
- Do not call expensive models in tests unless explicitly allowed.

Acceptance:

Verification:

Docs to update:
- `docs/model-config.md`
- `docs/project-state.md`
- `docs/change-log.md`
- `docs/decisions.md`
```

## Retrieval Task

```md
Task:

Owner subagent: retrieval-agent

Goal:

Retrieval mode:

Embedding config assumptions:

Scope:

Out of scope:

Constraints:
- Do not assume a fixed embedding provider or dimension.
- If dimensions change, document SQL/RPC migration steps.
- Preserve document-level source deduplication.

Acceptance:

Verification:

Docs to update:
```

## Ingestion Task

```md
Task:

Owner subagent: ingestion-agent

Goal:

Input type:

Provider config assumptions:

Scope:

Out of scope:

Constraints:
- Admin must confirm Import before writing to Supabase.
- Do not assume a fixed image parser or metadata provider.
- Do not fake OCR or VLM output.

Acceptance:

Verification:

Docs to update:
```
