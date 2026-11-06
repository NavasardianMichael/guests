# Deployment

Push to `master` → GitHub Actions builds → two tarballs land on the server → symlink flip →
`systemctl restart` → health checks → a real PDF printed. Same machinery as Bookie and
Crossword, on the same host.

## Shape

```
      guests-seating-board.eapps.site ──► nginx ──► 127.0.0.1:7010  guests-seating-board-web  (Next standalone)
                                                    └────► /_next/static/, /fonts/  from disk
  api.guests-seating-board.eapps.site ──► nginx ──► 127.0.0.1:9010  guests-seating-board-api  (Express)
                                                                  │   └──► headless Chrome ──► 127.0.0.1:7010/render
                                                                  ▼
                                                       127.0.0.1:5010  Postgres (Docker)
```

Two origins, not one. The browser calls the **API** host directly, at `NEXT_PUBLIC_API_URL`,
so every browser request is cross-origin and the API answers CORS for exactly one origin:
`CORS_ORIGIN`, which names the **web** host. `requireSameOrigin`
(`server/src/middleware/csrf.ts`) checks the `Origin` of every state-changing request against
that same value, and the session cookie is set on the web host's name so the web's
`src/proxy.ts` sees it too (`server/src/lib/cookie-domain.ts`).

PDFs are printed by the API: Puppeteer's Chrome opens the **web** process's `/render` page
over loopback (`RENDER_ORIGIN=http://127.0.0.1:7010`, written by the deploy) and prints it.
So a PDF needs both services up, and the web bundle must serve its own static files.

On-host layout:

```
$APP_DIR/                         /home/michael/apps/guests-seating-board
  web/releases/<sha>/             server.js · .next · public · node_modules
  web/current        -> releases/<sha>
  api/releases/<sha>/             dist · prisma · package.json · node_modules
  api/current        -> releases/<sha>
  shared/.env.api                 mode 600, written by the deploy — outside every release
  db/docker-compose.prod.yml      written by the first API deploy, never rewritten
  db/.env                         POSTGRES_* derived from DATABASE_URL — same, mode 600
~/.cache/puppeteer/               Chrome, downloaded by the API install, shared by every release
```

`WorkingDirectory` in both units points at `current`; systemd resolves the symlink at start,
so `systemctl restart` is what promotes a release.

## One-time server setup

The app-specific manual steps — DNS, Chrome's system libraries, systemd, certificates, nginx,
the server env, GitHub secrets and the first deploy — in the order they have to happen, are
[PRODUCTION_SETUP.md](PRODUCTION_SETUP.md). The one ordering trap: both vhosts name Let's
Encrypt files, so the certificates are issued **before** either vhost is enabled, with
`certbot certonly --nginx`.

The first deploy creates the release directories, downloads Chrome, creates the database,
migrates and starts both services.

### The database is created by the first deploy, once

`ensure_database` in `deploy.yml` runs before every `prisma migrate deploy` and is create-only:

| State on the host                          | What it does                                                        |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `guests-seating-board-postgres-prod` running         | nothing                                                             |
| container exists, stopped                  | `docker start` — no recreate, no config change                      |
| no container, no volume (first deploy)     | writes `db/docker-compose.prod.yml` + `db/.env` (from `DATABASE_URL`), `up -d --no-recreate` |
| no container, volume survives              | the same `up`, which **reattaches** the existing data               |
| `DATABASE_URL` not `127.0.0.1:5010`        | skipped — an external database is not ours to manage                |

It never runs `down`, `rm` or anything on a volume, and never rewrites an existing `db/.env`
or compose file. Postgres reads `POSTGRES_PASSWORD` only when it initialises an empty volume,
so changing the password later is done inside Postgres (see `deployment/db.env.example`), not
by editing either file. The password must be URL-safe (`openssl rand -hex 32`); the deploy
refuses anything else, since compose would interpolate `$` in `.env`.

There is **no seed** in production: `server/prisma/seed.ts` creates the dev test accounts
(`docs/DEV_CREDS.md`) and is not part of the release.

## GitHub configuration

**Secrets** (Settings → Secrets and variables → Actions):

| Name                   | Value                                                         |
| ---------------------- | ------------------------------------------------------------- |
| `SSH_HOST`             | server hostname or IP                                         |
| `SSH_USER`             | `michael`                                                     |
| `SSH_KEY`              | private half of the deploy key (full PEM)                     |
| `SSH_PORT`             | optional, defaults to 22                                      |
| `APP_DIR`              | `/home/michael/apps/guests-seating-board`                                   |
| `ENV_API_BASE64`       | see below                                                     |
| `NEXT_PUBLIC_API_URL`  | `https://api.guests-seating-board.eapps.site`                 |
| `NEXT_PUBLIC_SITE_URL` | `https://guests-seating-board.eapps.site`                     |

Optional, each one empty turns its feature off (setup: PRODUCTION_SETUP.md step 7):
`NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, and
`SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` for readable stack traces (source maps
uploaded at build).

The `NEXT_PUBLIC_*` values are public anyway (inlined into the browser bundle); the workflow
also accepts them as Variables (`secrets.*` first, then `vars.*`), so a Secret with the same
name as a Variable wins. Deploy fails closed if either origin is missing, loopback or
`http://`.

`ENV_API_BASE64` is `server/.env.production.local`, encoded: `DATABASE_URL`, `JWT_SECRET`,
`CORS_ORIGIN`, `API_PUBLIC_URL`, the mail engine (`MAIL_API_*`), Google OAuth (`GOOGLE_*`) and
photo import (`GEMINI_API_KEY`) — every key in `server/.env.example` except the
"Local dev only" ones. Do **not** put `NODE_ENV`, `PORT`, `HOST` or `RENDER_ORIGIN` in it: the
deploy strips and rewrites those four so they cannot drift from the units.

```bash
pnpm env:base64 production              # base64 on stdout, key names (never values) and warnings on stderr
pnpm env:base64 production | clip       # Windows
```

Values that must match something else exactly:

|                       | must equal                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `CORS_ORIGIN`         | `NEXT_PUBLIC_SITE_URL` — CORS allows only it, `requireSameOrigin` compares `Origin` to it, and the session cookie's `Domain` is its hostname |
| `API_PUBLIC_URL`      | `NEXT_PUBLIC_API_URL`                                                                          |
| `GOOGLE_REDIRECT_URI` | `https://api.guests-seating-board.eapps.site/identity/google/callback`, and the same URI in Google Cloud console |
| `DATABASE_URL`        | the credentials the Postgres volume was created with — the first deploy derives `$APP_DIR/db/.env` from it, port 5010 |

## The workflows

|              |                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`     | PR → master. typecheck · typecheck:server · lint · unit tests · build · build:api. No database and no Chrome needed.                                     |
| `deploy.yml` | Push to `master` (or **Run workflow**). `changes` picks the sides, `verify` runs the non-build gates, `build-web` and `build-api` in parallel, `deploy`. |

The API deploys **first**: the browser calls it the moment new pages serve, so the schema and
the API must be new before they do. API side: `pnpm install --prod --frozen-lockfile` (which
also downloads Chrome) → `prisma generate` → `ensure_chrome` (fails on missing system
libraries, before anything changes) → `ensure_database` (creates Postgres only if missing) →
`prisma migrate deploy` → flip → restart → poll `/health`. Web side: extract, flip, restart,
poll `/`. Then, whichever side deployed, `check_pdf` prints the free black-and-white PDF of an
empty draft through the live API and web: the one check that covers Chrome and `/render`.

The web bundle is booted in CI before it ships (standalone output can miss traced files), and
the API ships as a standalone package with pinned dependencies
(`scripts/build-api-release.mjs`) — both for the reasons documented in Bookie's
`docs/DEPLOYMENT.md`. The runners skip Puppeteer's Chrome download (`PUPPETEER_SKIP_DOWNLOAD`);
only the host needs it.

## Ports

| Port | What     | Declared in                                                                                                              |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| 7010 | Next     | `guests-seating-board-web.service`, `guests-seating-board.eapps.site.conf`, `deploy.yml` (`WEB_PORT`, and so `RENDER_ORIGIN`) |
| 9010 | Express  | deploy's env file (`PORT`), API `.conf`, `deploy.yml` (`API_PORT`)                                                       |
| 5010 | Postgres | `docker-compose.prod.yml`, `DATABASE_URL` inside `ENV_API_BASE64`, `ensure_database` in `deploy.yml`                     |

Bookie holds 7004/9004/5004, Crossword 7007/9007/5007 and cv-builder 7009/9009/5009 on the
same host. The dev ports are
the same numbers (`package.json`, `server/src/config.ts`, `docker-compose.yml`). Changing a
port means editing every row above — grep for the old number afterwards.

## Operations

```bash
journalctl -u guests-seating-board-web -f
journalctl -u guests-seating-board-api -f
systemctl status guests-seating-board-web guests-seating-board-api

# rollback — migrations do NOT roll back
ls -t /home/michael/apps/guests-seating-board/web/releases
ln -sfn /home/michael/apps/guests-seating-board/web/releases/<sha> /home/michael/apps/guests-seating-board/web/current
sudo systemctl restart guests-seating-board-web                     # same shape for api

# lists per kind
docker exec guests-seating-board-postgres-prod psql -U guests-seating-board -d guests-seating-board \
  -c 'select kind, count(*) from "GuestList" group by 1;'

# Chrome versions: a Puppeteer upgrade downloads a new one beside the old (~300MB each)
ls ~/.cache/puppeteer/chrome
rm -rf ~/.cache/puppeteer/chrome/linux-<old version>     # only versions no kept release uses
```

After the first deploy, submit `https://guests-seating-board.eapps.site/sitemap.xml` in Google
Search Console. `/llms.txt` summarises the site for AI
assistants.

## Gotchas

- **Three hostnames, two certificates.** `guests-seating-board.eapps.site` (the app) and
  `www.guests-seating-board.eapps.site` (301 to the app, HTTP and HTTPS) share one Let's
  Encrypt certificate, named after the app host; `api.guests-seating-board.eapps.site` (HTTPS only —
  its `:80` drops every connection) has its own. Both are issued and renewed by certbot over HTTP-01 with
  the nginx authenticator. If the zone is on Cloudflare, all three records stay **DNS only**:
  Universal SSL does not cover two-label names like `api.guests-seating-board…`, and proxying would break
  HTTP-01 renewal.
- **`/health` green does not mean PDFs work.** Chrome starts for each print and exits with it,
  never at boot — which is why the deploy ends with `check_pdf`. "No usable sandbox" there means the host
  blocks Chrome's sandbox: PRODUCTION_SETUP.md step 2.
- **Photo import is off until `GEMINI_API_KEY` is in `ENV_API_BASE64`**: the web says so in
  the import dialog; everything else works. Billing is not built (`docs/BILLING.md`).
- **`deploy` needs `verify` to have passed, not merely "not failed".** A failed `verify` skips
  both build jobs instead of failing them, so a "no failed build" condition let the deploy job
  start anyway.
- **Changing `NEXT_PUBLIC_*` requires a rebuild** — they are inlined.
- **Never add `proxy_cache`** to the web host, **never strip `Origin`/`Referer`** on the API
  host, **one API process only** — see `deployment/CLAUDE.md`.
- **The database is the only state** — back up the Postgres volume; releases and Chrome are
  disposable.
