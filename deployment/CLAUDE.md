# Deployment — invariants

Host-side configuration templates. How the pipeline works and the secrets live in
[docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md), the ordered manual setup in
[docs/PRODUCTION_SETUP.md](../docs/PRODUCTION_SETUP.md); this file holds the rules that must not break.

```
deployment/
  guests.eapps.site.conf      nginx, web host -> 127.0.0.1:7010
  api.guests.eapps.site.conf  nginx, API host -> 127.0.0.1:9010
  guests-web.service          systemd, Next standalone
  guests-api.service          systemd, Express + headless Chrome
  docker-compose.prod.yml         production Postgres, loopback-bound on 5010
  db.env.example                  shape of $APP_DIR/db/.env — the first deploy writes it from DATABASE_URL
```

**These are templates, not live config.** Nothing deploys them — they are copied to the
server by hand. Paths assume `APP_DIR=/home/michael/apps/guests`. When you change one
here, say so in the PR: someone has to re-copy it.

## Rules

- **The release symlink is the deploy mechanism.** Both units set `WorkingDirectory` to
  `…/current`; `systemctl restart` is what promotes a release. Never point a unit at a
  concrete `releases/<sha>` path.
- **Never add `proxy_cache` to the web host.** `src/proxy.ts` answers `/dashboard` and
  `/account` by the visitor's cookies.
- **Never clear or rewrite `Origin`/`Referer` on the API host** — `requireSameOrigin` rejects
  state-changing requests whose `Origin` is not `CORS_ORIGIN`.
- **`client_max_body_size` on the API host stays above the photo import's 9MB limit**
  (`server/src/routes/ai.ts`) — nginx's default 1MB answers 413 before Express sees it.
- **`proxy_read_timeout` on the API host stays above the web's PDF wait** (`API_PDF_TIMEOUT_MS`,
  90s): a PDF is printed on the request, behind whatever else is in the print queue.
- **`proxy_buffering off` on the web host is load-bearing** — Next streams RSC payloads.
- **`/_next/static/` and `/fonts/` are served from disk, `immutable`; `/_next/image` is not** —
  it is the optimizer and must reach Node.
- **Chrome prints from the web process, over loopback.** The deploy writes
  `RENDER_ORIGIN=http://127.0.0.1:7010` into the API env, and `services/pdf.ts` aborts every
  request outside that origin. The web bundle therefore has to carry `public/` and
  `.next/static` itself (deploy.yml copies them in), not rely on nginx.
- **Chrome lives in `~/.cache/puppeteer`, outside the releases**, downloaded by the API's
  `pnpm install`. The unit's `PUPPETEER_CACHE_DIR` and the deploy's must name the same path.
- **Two origins, deliberately.** The browser calls the API host directly at
  `NEXT_PUBLIC_API_URL`, so CORS is required: `CORS_ORIGIN` names the web host, and
  `requireSameOrigin` checks `Origin` against it. The session cookie's `Domain` is the web
  host's name (`lib/cookie-domain.ts`), which covers `api.` beneath it.
- **The database is create-only from CI.** `ensure_database` (deploy.yml) may create the
  Postgres container when it is missing, or start a stopped one — never `down`, `rm`,
  `--force-recreate`, a volume operation, or a rewrite of an existing `db/.env` /
  compose file. Changes to `docker-compose.prod.yml` reach an existing host by hand.
- **No seed in production.** `prisma/seed.ts` creates the dev test accounts with a published
  password; the release does not even contain it.
- **`shared/.env.api` lives outside the releases** — rotation deletes everything under
  `releases/`.
- **Chrome is launched per print and is `chrome-headless-shell`** (`services/pdf.ts`). The
  deploy's `ensure_chrome` and the AppArmor profile (PRODUCTION_SETUP.md step 2) must name
  that binary, and the API unit's `MemoryMax` covers it: same cgroup.
- **One API process.** Rate limits and the PDF print queue are in-memory
  and per-process; `trust proxy` = 1 assumes exactly one hop.
- **Ports 7010 / 9010 / 5010** sit beside bookie (7004/9004/5004) and crossword
  (7007/9007/5007) on the same host. Changing one means editing every file listed in
  docs/DEPLOYMENT.md "Ports".
