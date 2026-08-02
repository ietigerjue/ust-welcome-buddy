# GitHub Private Repository Checklist

Codex cannot safely change repository visibility through the GitHub UI for you. A repository owner should perform these steps manually.

## Keep Or Make The Repository Private

1. Open GitHub repository settings.
2. Go to Settings -> General.
3. Scroll to Danger Zone.
4. Use Change repository visibility only if needed.
5. Confirm the repository is Private.

## Collaborators

- Add only authorized collaborators.
- Prefer least-privilege roles.
- Remove inactive collaborators.
- Avoid shared GitHub accounts.

## Branch Protection

- Protect the main branch when the team is ready.
- Require pull request review for production changes if multiple contributors are active.
- Consider requiring status checks such as TypeScript/build checks.

## Secret Protection

- Enable secret scanning if available.
- Enable push protection if available.
- Run `npm run check:secrets` before commits and before any visibility change.
- Confirm `.env.local`, `.env`, and `.env.*.local` are not tracked.

## If The Repository Was Ever Public

1. Assume secrets may have been copied.
2. Rotate Supabase service role keys.
3. Rotate Admin Token.
4. Rotate MiniMax, VLM, embedding, OCR, proxy, Vercel, and GitHub tokens.
5. Audit Git history before inviting external collaborators.
