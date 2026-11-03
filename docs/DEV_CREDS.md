# Local test accounts

Created by `server/prisma/seed.ts` (runs on `pnpm install`, or `pnpm db:seed`). Local only —
never seeded into production. Every account uses the password **`guests-dev-1234`**.

| Email | State | Use it to test |
|---|---|---|
| `demo@guests.local` | No lists | First run: empty dashboard, creating a list |
| `ani@guests.local` | A wedding seating board (4 tables, Armenian/Russian/English names) and a short christening list | Editing a saved list, autosave, duplicate/delete, PDF of a saved list |

Password-reset and verification links print to the API console instead of being emailed.
Photo import needs `GEMINI_API_KEY` in `server/.env`; without it the import dialog says it is
unavailable.

The seed never overwrites an existing row. To reset an account, delete it (or run
`npx prisma migrate reset` in `server/`, which drops everything and re-seeds). Seed documents
are written loosely and completed by the API's own coercion (`coerceDesign`), so their
typography is the server's plain default, not a template's — apply a template in the editor.

Not seedable: a Google-only account (it needs a real Google sign-in with credentials in
`server/.env`).
