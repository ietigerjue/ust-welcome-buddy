# Local Setup Checklist

Use this for authorized collaborators setting up UST Buddy locally.

1. Confirm you have access to the private GitHub repository.
2. Clone the repository.
3. Run `npm install`.
4. Copy `.env.example` to `.env.local`.
5. Fill `.env.local` with real values from the secure secret handoff.
6. Run `npm run check:env`.
7. Run `npm run dev`.
8. Open `http://localhost:8080/chat` or the dev server URL printed by Vite.
9. Ask a covered chat question.
10. Ask an uncovered chat question and confirm the fallback answer.
11. Open `/admin/import` and test Admin Token failure and success.
12. Open `/admin/settings` and run Load Config.
13. Confirm Supabase access by listing documents in `/admin/documents`.
14. If embedding config is available, run `npm run test:embedding`.
15. If pgvector RPC is available, run `npm run test:vector-search`.
16. If VLM config is available, test a small image import.
17. Before committing, run `npm run check:secrets`.

Do not commit `.env.local` or share it through Git.
