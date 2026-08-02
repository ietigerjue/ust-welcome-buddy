# Closed-Source Notice

UST Buddy is a private, proprietary project. The repository, source code, documentation, deployment configuration, knowledge base, prompts, and operational runbooks are for authorized collaborators only.

## Usage Restrictions

- Keep the repository private.
- Do not copy, publish, redistribute, sublicense, resell, or disclose the project without maintainer approval.
- Do not upload the repository or internal docs to public code hosts, public package registries, public model prompts, or public knowledge bases.
- Do not use this project as an open-source release unless the maintainer explicitly approves a separate license and release process.

## Secret Safety

Never commit or share these values through Git, screenshots, chat logs, issue comments, or pull request descriptions:

- `.env.local`, `.env`, or any real environment file.
- Supabase service role keys.
- Admin tokens.
- MiniMax, Jina, VLM, OCR, or future model provider API keys.
- Vercel, GitHub, DNS, or cloud provider credentials.
- Proxy credentials.

The database `app_config` table stores provider/model metadata and environment variable names only. It must not store real API keys.

## Team Access

- Add collaborators only through private GitHub repository permissions.
- Give Vercel, Supabase, and model provider access only to people who need it.
- Remove access promptly when a collaborator leaves the project.
- Prefer role-based permissions over shared accounts.

## If The Repo Is Ever Made Public

Before changing repository visibility or sharing a public archive:

1. Run a full secret scan.
2. Audit Git history for committed environment files or keys.
3. Rotate all provider keys, Supabase service role keys, admin tokens, Vercel tokens, and proxy credentials.
4. Remove or rewrite sensitive deployment notes.
5. Add an explicit license only after the maintainer chooses one.

## License Status

No open-source license is currently provided in this repository. If a `LICENSE` file is added later, confirm that it matches the intended private or commercial distribution policy.
