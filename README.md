# guests — guest lists, seating charts and place cards (Իմ հյուրերը)

For Armenian weddings, christenings and celebrations: make the guest list (type it, paste it,
import Excel/CSV, or photograph a handwritten list and let Gemini read it), arrange it on paper
— by dragging, in columns or rows, or freely — and print a **seating chart**, a **guest list**
or **place cards** on any paper size, in 46 classic and creative templates with 40 Armenian
fonts. Interface in Armenian (default), Russian and English. Building is free and the
“Classic” template prints free; each premium template is bought once (Ameriabank) and then
prints on every list its buyer makes (`docs/PAYMENTS.md`).

## Quick start

Requirements: Node 24, pnpm 10, Docker.

```bash
pnpm install    # installs, creates missing env files from the examples, starts the Docker
                # Postgres (:5010) if it is down, applies pending migrations, seeds
pnpm dev        # http://localhost:7010 (web) · :9010 (api)
```

Run `pnpm install` again after pulling: it applies any new migrations.

Sign in with a seeded test account (`docs/DEV_CREDS.md`, password `guests-dev-1234`), or work
as a guest. For photo import set `GEMINI_API_KEY` in `server/.env`.

`pnpm verify` runs typecheck, lint, tests and the production build.

Production: `guests-seating-board.eapps.site` (web) and `api.guests-seating-board.eapps.site` (API),
deployed by `.github/workflows/deploy.yml` — `docs/DEPLOYMENT.md`, `docs/PRODUCTION_SETUP.md`.

## Docs

- `CLAUDE.md` — architecture, where things live, the invariants
- `docs/PAYMENTS.md` — template purchases, the Ameriabank gateway, refunds and going live
- `public/fonts/LICENSES.md` — where every font comes from and its licence

## Before launch

- Fill `server/.env` for production: `JWT_SECRET`, `CORS_ORIGIN`, `API_PUBLIC_URL`,
  `RENDER_ORIGIN`, Google OAuth, mail engine, `GEMINI_API_KEY`.
- Have the Terms / Privacy pages (`src/constants/legal.ts`) reviewed by a lawyer.
- Confirm the brand name (`src/constants/app.ts`), `SUPPORT_EMAIL` and the price.
