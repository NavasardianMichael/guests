# Pre-release review — 2026-11-12

Whole-app review before production: security, payments, ops, performance, SEO, UX/responsiveness,
accessibility, maintainability. Findings below as found on 2026-11-12; what was done about each
is in [Status](#status-2026-11-13), what is left to do by hand in [Manual steps](#manual-steps-2026-11-13).

**Baseline:** `pnpm verify` passes (typecheck, server typecheck, lint, tests, build).
No Critical vulnerability was found: list scoping, payment verification (server-to-server, CAS,
amount/order checked), CSRF, cookies, password hashing, Google OAuth, Puppeteer SSRF guard and
input coercion are all sound. The risks are **production config that fails open, money/data
safety in ops, cost abuse, and a handful of UX dead ends**.

Priorities:

- **P0 — fix before launch.** Money, data loss, legal, or unbounded cost.
- **P1 — launch week.** Real users will hit these.
- **P2 — soon after.** Hardening and polish.
- **P3 — backlog.**

## Status (2026-11-15)

Every finding was re-checked against the code at `c3259d8` (which had already changed payments,
the payment result page and photo import) before it was fixed. `pnpm verify` passes with all of
the fixes below. Nothing is committed.

**Brought over from crossword's and CV Builder's reviews (2026-11-15):**
- The deploy's first job, **Check configuration** (`scripts/check-deploy-config.mjs`, tested in
  `tests/unit/deployConfig.spec.ts`), checks every secret in seconds: SSH, `APP_DIR`, both public
  origins, and inside `ENV_API_BASE64` `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` = site,
  `API_PUBLIC_URL` = API, the Google callback and the Ameria set. Optional features that are off
  are warnings. It replaces the scattered `grep` checks in the workflow.
- The host reads the API env file literally instead of sourcing it: as shell code an `&` in
  `DATABASE_URL` (`?schema=public&connection_limit=5`) backgrounded the assignment and the
  migration saw no URL.
- `SSH_KNOWN_HOSTS` removed again: back to `ssh-keyscan`, as in crossword.
- `returnTo` is resolved through the URL parser (`safeReturnPath`) and returned cleaned, instead
  of refused on any odd character.
- Backups keep 22 days, as the other apps, with their own guide: `docs/DRIVE_BACKUP.md`.
- The consent banner shows only where the law asks for an opt-in (EU/EEA, UK, Switzerland, told
  by the device's time zone); elsewhere, Armenia included, analytics cookies are on from the
  first page. Closing the banner counts as accepting, and its text says so. Privacy §6 says the
  same.

**P0 — all addressed in code; 2, 6 and part of 4 need the manual steps at the end.**
1. Config — fixed. In production the API refuses to start with a short or example `JWT_SECRET`,
   or with `AMERIA_AMOUNT_OVERRIDE` beside `AMERIA_TEST_MODE="false"`. The override is also
   ignored on the live terminal, and the deploy's Check configuration job and `pnpm env:base64`
   check both. Running on the
   test terminal is still allowed (it is the step before the bank signs off), with a loud warning
   at boot.
2. Backups — fixed in code: `deployment/backup-db.sh` (nightly to Google Drive, 22 days kept,
   `docs/DRIVE_BACKUP.md`) and a `pg_dump` before every migration. **Manual: install it.**
3. Paid but never credited — fixed: an hourly sweep (`services/paymentSweep.ts`) settles every
   payment still pending after its bank page timed out (up to 30 days back). Paid becomes
   succeeded; nothing charged becomes failed.
4. Gemini cost — mostly fixed already by `c3259d8`: photo reading needs a running pass, 5 reads
   per pass, each claimed before the model is called. Every limiter now keys on the client's /64
   for IPv6 (`clientAddress`). **Manual: a budget cap on the Gemini key.**
5. Deploy — fixed:
   - A re-run of a live commit installs into a side directory instead of deleting the live one.
   - The env file is 0600 and removed by `trap` however the script ends.
   - A failed health check or `check_pdf` rolls back to the previous release.
   - The env file is read literally on the host, and every secret is checked first.
6. Legal:
   - GA now waits for consent where the law asks for it (EU/EEA, UK, Switzerland): Consent Mode
     v2, a banner on site pages, "Cookie settings" in the footer everywhere, privacy §6 updated.
   - **Manual:** get the drafts reviewed by a lawyer.
   - Operator details: left out, by your decision.

**P1**
- **Fixed:**
  - 1 storage-blocked loop: a translated screen instead of a redirect.
  - 2 pending page: `c3259d8` already fixed the copy; a "Check again" button is added.
  - 3 date-less success copy.
  - 4 checkout buttons wrap.
  - 5 bottom bar labels wrap to two lines, with soft hyphens.
  - 6 graceful shutdown (SIGTERM, 25 s).
  - 8 autosave stops on 4xx instead of looping.
  - 9 rollback.
  - 10 limits:
    - Login: 40 per address per 15 min, whatever the email.
    - Prints: at most 2 per address, printing or queued; a queued print is dropped when its client hangs up.
    - Bank: reads that only show state reconcile at most every 3 s per owner.
  - 11 previews lay out only near the screen.
  - 12 font re-layouts coalesced to one per frame.
  - 13 `llms.txt`.
  - 14 JSON-LD `isAccessibleForFree` per template.
- **Partly:**
  - 7 monitoring: `/health` now fails when the database is down, and uptime monitors are a
    manual step. No Sentry on the API (journald, as before).

**P2**
- **Fixed:**
  - HSTS (nginx, manual re-paste), API `nosniff`, a basic CSP (`frame-ancestors`, `base-uri`,
    `object-src`, `form-action`).
  - Seed refuses a non-local database.
  - Two tabs: 409 `listChangedElsewhere` → "Changed elsewhere — Reload".
  - Bank return uses the unique index.
  - `User.lastActiveAt` index (new migration).
  - `/health` checks the database.
  - API gzip (nginx, manual re-paste) and CORS `maxAge`.
  - PDF waits for `load`, not `networkidle0`.
  - `memo(GuestRow)`.
  - Editor dialogs load with `next/dynamic`.
  - `sheet-fonts.css` and its fonts carry a content hash.
  - Import dialog drops stale photo reads.
  - Touch delete in the import preview.
  - Contrast: focus ring, CTA text, small accent text.
  - Slider pauses on focus and has a pause button.
  - CI runs on test-only pushes.
  - New tests: return path, `clientAddress`, the PDF queue's drop-on-disconnect, the deploy
    config check, consent by region.
- **Not done, on purpose:**
  - Logout revocation: bumping `tokenVersion` would sign every device out, and the cookie is
    httpOnly.
  - The sign-in list cap: a guest owns at most 10 lists.
  - Actions pinned by SHA: well-known publishers; Dependabot is the better tool.
  - Pinning the deploy's SSH host key: `ssh-keyscan` at deploy time, as in crossword.
  - A warm Chrome: one per print isolates crashes; fine at this scale.
  - Virtualising the guest rows: dnd-kit's cross-table sorting needs every row in the DOM.
  - antd locales: a few KB, and loading lazily breaks hydration.
- **Not done, worth doing later:**
  - Unit tests for the DB paths (payments settle/sweep, claim, retention purge, CSRF): they need
    a Prisma mock or a test database.

**P3**
- **Fixed:**
  - `HintTooltip` on tapped controls.
  - Darker field borders.
  - 40 px targets: slider dots, card menu, back arrow.
  - Zoom `aria-label`, bottom bar `aria-current`.
  - Translated breadcrumb label and sort labels.
  - Per-kind "All … templates" links, the hall badge naming the template.
  - Slider `scale` transition, frozen progress bar.
  - Sitemap `lastModified`; robots no longer blocks `/editor/` (it is `noindex`).
  - UI italic faces dropped.
  - Stale "buy a template" / "CV" comments.
- **Moot:** the 5-photo message — one photo per request now.
- **Not done:**
  - `<Link><Button/></Link>` (14 places, wants a shared link-button).
  - SelectionBar tap targets.
  - Arrow keys in radio tiles.
  - Keyboard placement on the canvas.
  - Static `[locale]` pages.
  - Splitting `GuestsPanel.tsx`.
  - `paidAt` = settle time.
  - Draft import duplicated across two tabs.

---

## P0 — before launch

### 1. Production config fails open
- **Session secret fallback.**
  - Where: `server/src/config.ts:19`. `jwtSecret` falls back to the public `'dev-secret-change-me'`.
  - Risk: with a known secret, anyone can forge sessions and OAuth state cookies.
- **Test amount override applies in live mode.**
  - Where: `server/src/services/gateways/ameria.ts:28`, `config.ts:64`.
  - `chargeOf` honours `AMERIA_AMOUNT_OVERRIDE` even when `AMERIA_TEST_MODE=false`. If it is left set after go-live, every pass sells for 10 AMD, and `check` accepts that as paid.
- **Test terminal grants real passes.** `AMERIA_TEST_MODE` defaults to `true`. While production runs on the test terminal (as `PRODUCTION_SETUP.md` suggests), anyone with Ameria's public test cards gets real passes.
- **Fix:** when `NODE_ENV=production`, refuse to boot if any of these hold:
  - `JWT_SECRET` is missing, shorter than 64 characters, or starts with `change-me` / `dev-secret`.
  - `amountOverride` is set while `testMode` is false. Also make `chargeOf = testMode ? override ?? amount : amount`.
  - `testMode` is true without an explicit `ALLOW_TEST_TERMINAL=true`.

### 2. No database backups
- **Where:** `docs/DEPLOYMENT.md:206` only says "back up the volume". `deploy.yml:607` runs `prisma migrate deploy` on the live DB with no dump first.
- **Risk:** a disk loss or bad migration permanently loses `Payment` and `PdfDownload`, which are the accounting record and the refund evidence.
- **Fix:**
  - Daily `pg_dump -Fc` to an off-host target, with a retention period.
  - A `pg_dump` step in `deploy.yml` before migrating.
  - A documented restore procedure.

### 3. Paid but never credited after 3 days
- **Where:** `server/src/services/payments.ts:29`, `109-119`.
- **Problem:** pending payments are re-checked only when the owner reads `/purchases`, only within 3 days, and only the last 5.
- **Risk:** if the bank redirect fails and the buyer doesn't come back in time, the card is charged and no pass is ever granted. Nothing alerts anyone.
- **Fix:** make the daily sweep (`retentionSweep.ts`) also settle `pending` rows that are older than about 30 minutes and have a `gatewayPaymentId`. Log or alert on the ones it can't settle.

### 4. Unbounded Gemini cost and spam
- **Where:** `server/src/routes/ai.ts:30`. Every limiter (`lists.ts:61`, `pdf.ts:40`, `identity.ts:61/93`, `purchases.ts:151`) keys on raw `req.ip`, and nginx listens on IPv6.
- **Risk:** one /64 rotates through unlimited addresses, giving unlimited paid photo reads, list creation (2 MB each) and draft PDFs.
- **Fix:**
  - One `clientKey(req)` helper that reduces IPv6 addresses to their /64, used by every limiter.
  - A process-wide daily cap on `/ai/extract-guests` (answer 503 once it is reached).
  - A budget cap on the Gemini key in Google Cloud.

### 5. Deploy can take the live API down; secrets left in `/tmp`
- **Re-run deletes the live release** (`.github/workflows/deploy.yml:537`, `:617`).
  - `rm -rf "$NEW"` deletes the directory `current` points to when the same SHA is redeployed (a re-run after a flaky `check_pdf`, or `workflow_dispatch`).
  - Fix: extract to `releases/$RELEASE.tmp-$$` then `mv`, or skip the step when `readlink current` already equals `$NEW`.
- **Secrets file readable by other users** (`deploy.yml:340`, `:364`, `:634`).
  - The env file with `DATABASE_URL`, `JWT_SECRET` and the Ameria credentials is written with the default umask and copied to `/tmp`. It is removed only at the end, so it stays if any step fails.
  - Fix: `umask 077`, copy straight into `$APP_DIR/shared/`, and remove it in `trap … EXIT`.

### 6. Legal and compliance for a paid service
- **Draft legal texts.** `src/constants/legal.ts:5-9` marks terms, privacy and refund as a draft "to be reviewed by a lawyer before launch". Get them reviewed.
- **No operator identity.** The site shows no legal name, taxpayer number (ՀՎՀՀ) or address. Bank vPOS merchant checklists usually require these, so check Ameria's list and add them to the footer and terms.
- **No analytics consent.** GA4 loads with no consent step (`components/analytics/Analytics.tsx`). Add a consent banner, at least for EU visitors.

---

## P1 — launch week

### Money and user-facing dead ends
1. **Guests caught in a redirect loop when storage is blocked.**
   - Where: `src/components/editor/NewListClient.tsx:46` ignores `writeLocalDraft`'s `false`; `EditorShell.tsx:113` then sends back to `/editor/new`, and the two pages bounce forever.
   - Fix: if the write fails, open the editor with the document in memory (or show an error). Don't redirect.
2. **The pending payment page stops checking but says it will refresh.**
   - Where: `src/components/payment/PaymentResultClient.tsx:82-86`. Polling stops after about 32 s.
   - Fix: after the last poll, show different copy and a "Check again" button.
3. **"Full access until ." with an empty date.**
   - Where: `PaymentResultClient.tsx:96`. `until` is null when the access lookup fails or the payment was made in another browser.
   - Fix: use a version of the success text without a date.
4. **Checkout buttons overflow on phones.**
   - Where: `CheckoutModal.tsx:387-396` and `424-434`, and `GuestWarning` at `263-268`. These are antd large Buttons with fixed height and nowrap; long hy/ru labels run past about 240 px.
   - Fix: use the inline override `SpreadsheetModal` already has (`height:auto; minHeight:42; whiteSpace:normal`).
5. **Phone bottom bar truncates Armenian labels.**
   - Where: `src/components/editor/EditorBottomBar.tsx:182`. Seven tabs share 320–375 px, so labels show as "Դասավո…".
   - Fix: `line-clamp-2` instead of `truncate`, or shorter hy `tabsShort` labels.

### Reliability and observability
6. **No graceful shutdown.**
   - Where: `server/src/index.ts`. systemd's SIGTERM kills in-flight PDFs, autosaves and bank settles on every deploy.
   - Fix: on SIGTERM, `server.close()`, drain the PDF queue (up to about 25 s), then `prisma.$disconnect()`.
7. **No error monitoring on the API** (Sentry is web-only). Payment, settle and PDF failures go only to journald.
   - Fix: add `@sentry/node`, or at least an alert on `[payments]` and `[pdf]` log lines.
8. **Autosave retries permanent errors forever.**
   - Where: `src/components/editor/useAutosave.ts:32-34`, `61-65`. A 404, 401 or 413 loops every 5 s, floods Sentry, and the leave guard prompts on every navigation.
   - Fix: retry only network errors and 5xx; stop on 4xx with translated copy.
9. **No rollback on a failed deploy.**
   - Where: `deploy.yml:610-625`. The symlink flips before the health check.
   - Fix: remember the old `readlink current` and restore it in `trap … ERR`.
10. **Throttle the expensive endpoints.**
    - **Login floods the CPU.** Login is limited per `ip:email` only, so changing the email gives unlimited argon2 runs (64 MiB each) under `MemoryMax=768M`. Add a plain per-IP (/64) limiter (`identity.ts:93`).
    - **One client can hold the only printer.** One PDF slot and a queue of 8: one client can fill it. Allow one print in flight per IP/owner, and drop a queued job on `req.on('close')` (`services/pdf.ts:21-45`).
    - **Unlimited calls to the bank.** `GET /purchases` makes up to 5 bank calls each time with no limit. Reconcile at most once per owner every 15–30 s (`routes/purchases.ts:128`).

### Performance
11. **Previews draw while off-screen, so pages fetch every sheet font on load.**
    - Where: `src/components/sheet/SheetPreview.tsx:55`.
    - Impact: the landing page draws 19 previews and fetches about 1.3 MB of fonts; `/templates` draws 46 and fetches about 2.1 MB. The dashboard lays out every list on mount.
    - Fix: gate layout on an `IntersectionObserver` (rootMargin about 300 px).
12. **Every font load re-lays out every sheet.**
    - Where: `src/hooks/useSheetLayout.ts:17-21`, `:117`. Each `loadingdone` clears the cache and re-lays out all N sheets: about N×N layouts, roughly 2,000 on `/templates`. The editor's main canvas re-lays out each time the Template step loads a thumbnail font.
    - Fix: coalesce `bump()` to once per animation frame.

### SEO and content correctness
13. **`llms.txt` still says "price per template".**
    - Where: `src/app/llms.txt/route.ts:42`.
    - Fix: say "`${price}` դրամ — `${PASS_DAYS}` օր լիարժեք հասանելիություն".
14. **Template JSON-LD claims every template is free.**
    - Where: `src/app/(site)/templates/[templateId]/page.tsx:68`, `isAccessibleForFree: true`.
    - Fix: use `TEMPLATES[id].free`.

---

## P2 — soon after launch

### Security hardening
- **Logout doesn't revoke the session.** It only clears the cookie (`identity.ts:168`). Increment `tokenVersion` on logout.
- **No HSTS or CSP.** Neither `next.config.ts` nor nginx sends them, and the API has no `X-Content-Type-Options: nosniff`. Add HSTS on both hosts, nosniff on the API, and a basic CSP.
- **Seed has no environment guard.** `prisma/seed.ts` would create the known `guests-dev-1234` accounts against whatever `DATABASE_URL` it gets. Refuse unless the host is localhost.
- **SSH host key not pinned.** `deploy.yml:321` uses `ssh-keyscan` at deploy time. Store `known_hosts` as a secret.
- **Actions pinned by tag.** Pin third-party actions (`dorny/paths-filter`, `webfactory/ssh-agent`) by SHA.

### Data correctness
- **Two tabs or devices silently overwrite each other** (`routes/lists.ts:101-115`, `useAutosave.ts:29`).
  - Fix: send `updatedAt`, answer 409 on mismatch (`updateMany where {id, updatedAt}`), and show "changed elsewhere — reload".
- **Bank return ignores the index.** The `gatewayPaymentId` lookup is case-insensitive, which bypasses the unique index (`routes/payments.ts:46`). Store it upper-cased and match exactly.
- **No index for the retention sweep.** Add an index on `User.lastActiveAt`.
- **`/health` doesn't touch the DB** (`server/src/app.ts:158`), so deploys pass with Postgres down. Add `SELECT 1`.
- **Sign-in can exceed the list cap.** `claimGuestLists` moves guest lists past `MAX_LISTS_PER_USER` (`services/guestLists.ts:75`).

### Performance
- **No compression on the API.** Add `gzip on; gzip_proxied any; gzip_types application/json;` to the API nginx server block. `GET /lists` returns full documents uncompressed.
- **Preflight on almost every save.** Set `cors({ ..., maxAge: 7200 })` (`server/src/app.ts:26`) so autosave doesn't pay an extra request each time.
- **Slow PDF start** (`services/pdf.ts:59`, `:72`).
  - Use `waitUntil: 'domcontentloaded'`; `data-sheet-ready` already waits for what matters.
  - Optionally keep one warm browser with a fresh context per print.
- **The guest panel renders up to 2,000 rows**, each with an antd Select, and re-renders all of them on every keystroke (`GuestsPanel.tsx:388`, `:735`). Add `memo(GuestRow)`, and virtualize or render the Select only on focus.
- **Editor modals in the initial bundle.** Load `ImportModal`, `SpreadsheetModal` and `CheckoutModal` with `next/dynamic` and mount them only when open (`EditorShell.tsx:249-251`). Load only the active antd locale (`components/App.tsx`).
- **Stale sheet-fonts stylesheet.** `sheet-fonts.css` is cached `immutable` for a year under a fixed URL. Add `?v=<hash>` (`constants/fonts.ts:126`).

### UX and accessibility
- **Closing the import dialog doesn't stop photo reading** (`ImportModal.tsx:116-119`, `169-189`). Results land later in the closed dialog. Fix: ignore stale runs with a run counter, or disable Cancel while busy.
- **Delete-row button hidden on touch.** In the import preview it is hover-only. Add `pointer-coarse:opacity-100` (`ImportPreview.tsx:44`).
- **Contrast too low.**
  - The focus ring is accent `#f08a24` at 2.5:1 (`globals.css:101-104`, `TileButton.tsx:234`). Use `APRICOT[700]`.
  - White text on the accent (pricing CTA, `FinalCta`, `EditorSteps`) is 2.5:1. Use ink text or the 700/800 steps.
- **Slider can't be stopped.** `KindSlider` doesn't pause on keyboard focus and has no pause button (WCAG 2.2.2). Pause on `onFocus`/`onBlur` and add a toggle.

### Tests and CI
- **No tests for the money and auth paths.** Add unit tests with a mocked `prisma` for:
  - `services/payments.ts`: settle compare-and-set, reconcile, `printTermsFor`
  - `claimGuestLists`
  - the retention purge
  - `middleware/csrf.ts`
  - `tokenVersion` revocation
  - `rateLimit`
  - editor undo/redo
- **Test-only pushes to master run nothing.** CI runs only on `pull_request`, so a push that touches only tests skips `verify`.

---

## P3 — backlog

- **Accessibility:**
  - Use `HintTooltip` instead of a plain `Tooltip` on tapped controls (`PreviewModal`, `TextStyleEditor`, the canvas fit/reset buttons).
  - Give form controls a darker border (`theme.ts:16` is 1.3:1).
  - Enlarge touch targets under 40 px: KindSlider dots, ListCard "more", SelectionBar tools, the editor back arrow, the canvas buttons.
  - Stop nesting `<Link><Button/></Link>` (Header, Dashboard, PaymentResult, …). Style the link itself.
  - Add `aria-label` to the zoom % button, and `aria-current` to the active bottom-bar tab.
  - Support arrow keys in the `role=radiogroup` tiles.
- **i18n:**
  - Translate the breadcrumb `aria-label`.
  - Move the `Ա→Ֆ` sort labels into messages.
  - Say so when more than 5 photos are picked, instead of dropping the extras.
- **Uncommitted landing changes:**
  - `TemplateShowcase.tsx:65` gives five identical "All templates" links with different targets. Use per-kind labels.
  - The "Free" badge on one hall card reads as if the arrangement were free. Name the template instead.
  - In `KindSlider.tsx:327`, the transition doesn't cover Tailwind 4's `scale` property, so hover snaps. Use `transition-[scale,background-color]`.
- **SEO:**
  - Add `lastModified` to the sitemap.
  - `/editor/new?template=…` is linked from template pages but disallowed in robots. Let `noindex` do the work instead.
  - Content pages are all dynamic because of the cookie locale. A `[locale]` rewrite in `proxy.ts` would make them static, but that's a bigger change; do it only if TTFB matters.
- **UI font:** don't preload the two italic faces (about 82 KB on every page; `src/styles/fonts.ts`), and fix the comment claiming the cache is shared with the editor's fonts.
- **Code health:**
  - Remove stale "buy a template" comments: `routes/lists.ts:21-23,117,151`, `DEPLOYMENT.md:189`, `config.ts:77`, `env-to-base64.mjs:115`, `helpers/sentry.ts` ("A CV…").
  - Split `GuestsPanel.tsx` (762 lines) into quick add, by-table view and rows.
- **Minor:**
  - `paidAt` is the settle time, not the bank's payment time; it can only favour the buyer.
  - Two tabs at sign-in can each import the same guest draft.

---

## What is already solid

- **Auth and access:**
  - Every `/lists` route is scoped by owner; there is no IDOR on lists, payments or downloads.
  - Guest key is 256-bit and stored hashed; cookies are httpOnly, `secure`, `sameSite=lax`.
  - CSRF uses an Origin/Referer check; CORS allows a single origin.
  - Passwords use argon2id with a dummy hash for timing.
  - Reset and verify tokens are hashed and single-use; Google OAuth uses PKCE and state.
- **Payments:**
  - Settled only from `GetPaymentDetails` server-to-server, checking amount and order, with a compare-and-set status change (no double-credit).
  - The mock gateway is refused in production.
- **Inputs and PDF:**
  - All list writes are coerced and capped; the AI route accepts only JPEG/PNG/WebP data URLs and caps Gemini's output.
  - Puppeteer is restricted to the render origin (no SSRF), with a fresh browser per print, closed in `finally`.
- **Deploy:**
  - `migrate deploy` only.
  - Deploy is gated on `verify` succeeding.
  - Chrome dependencies are checked.
  - An end-to-end `check_pdf` runs after deploy.
  - systemd sandboxing and memory caps are in place.
- **Retention:** sweeps only data unused for 365 days; payments and downloads survive.
- **Editor:**
  - Memoized canvas.
  - Layout keyed on measured fields only.
  - rAF-throttled drag and resize.
  - Capped undo history.
  - Serialized autosave.
  - Leave guard on unsaved work.
- **i18n:** all 770 message keys exist in hy, ru and en; errors always show translated copy; `<html lang>` follows the cookie.
- **Responsive editor and SEO basics:**
  - Bottom sheets on phones; dialogs capped to the screen.
  - Canonicals, noindex on private pages, sitemap, valid JSON-LD, static OG images.

---

## Manual steps (2026-11-15)

What code cannot do by itself, in order. **[PC]** your machine, repo root · **[SRV]** the server,
as `michael` · **[GH]** GitHub → the repo → Settings · **[EXT]** a third-party console · **[WEB]** a browser.

### Before pushing

1. **Apply the new migration and verify** **[PC]** (Docker Desktop running):
   ```powershell
   pnpm db:up
   pnpm db:migrate
   pnpm verify
   ```
2. **Try the two-tab conflict locally** **[PC]**: `pnpm dev`, sign in as a seeded account
   (`docs/DEV_CREDS.md`), and open the same list in two tabs. Edit in tab A, wait for "Saved",
   then edit in tab B. Tab B should show **Changed elsewhere** with a **Reload** button and a
   message, and must not overwrite tab A.
3. **Check `JWT_SECRET`** **[PC]** in the server's production env file (`server/.env.production.local`).
   It must be at least 32 characters and must not start with `change-me`, or the deploy stops
   and the API refuses to start. To make a new one, run `openssl rand -hex 64` in Git Bash and
   paste it as `JWT_SECRET="…"`. A new secret signs everyone out once.
4. **Check the Ameria pair** **[PC]**, in the same file. With `AMERIA_TEST_MODE="false"`, delete
   the `AMERIA_AMOUNT_OVERRIDE` line, or the API refuses to start. With the test terminal still
   on, leave both as they are.
5. **If you changed that file, re-encode it**: run `pnpm env:base64 production | clip` **[PC]**,
   then **[GH]** Secrets and variables → Actions → `ENV_API_BASE64` → Update, and paste.
6. **If you created `SSH_KNOWN_HOSTS`** from the earlier version of these steps **[GH]**: Secrets
   and variables → Actions → `SSH_KNOWN_HOSTS` → Remove. Nothing reads it any more.
7. **Review the diff, commit, push to `master`.** The deploy's first job, **Check configuration**,
   checks every secret and stops the run within seconds if one is missing or wrong; its log names
   the secret and the fix. Yellow warnings there are optional features that are off (photo
   import, mail, or the test terminal). The deploy then dumps the database before migrating, and
   rolls back by itself if the new release fails its checks.

### On the server, after the deploy is green

8. **nginx: HSTS on both hosts, gzip on the API** **[SRV]**. Empty each conf, paste the repo
   file into it, then test and reload:
   ```bash
   sudo truncate -s 0 /etc/nginx/sites-available/guests-seating-board.eapps.site.conf
   sudo nano /etc/nginx/sites-available/guests-seating-board.eapps.site.conf        # deployment/guests-seating-board.eapps.site.conf
   sudo truncate -s 0 /etc/nginx/sites-available/api.guests-seating-board.eapps.site.conf
   sudo nano /etc/nginx/sites-available/api.guests-seating-board.eapps.site.conf    # deployment/api.guests-seating-board.eapps.site.conf
   sudo nginx -t && sudo systemctl reload nginx
   ```
   Check from **[PC]**:
   - `curl.exe -sI https://guests-seating-board.eapps.site/ | findstr /i strict` should print
     `Strict-Transport-Security: max-age=31536000`.
   - `curl.exe -s -o NUL -w "%{http_code}" https://api.guests-seating-board.eapps.site/health`
     should print `200`.
9. **Nightly backups to Google Drive** **[SRV]**: follow [DRIVE_BACKUP.md](DRIVE_BACKUP.md).
   rclone and its `gdrive` remote are already on the server (crossword set them up). In short:
   - Paste `deployment/backup-db.sh` into `/home/michael/apps/guests-seating-board/shared/backup-db.sh`,
     run `sudo chown michael:michael` on it, then `chmod 700` it.
   - Run it once by hand, without `sudo`, and check `rclone ls gdrive:guests-seating-board-backups`.
   - `crontab -e`, add the `15 4 * * * …` line from the guide (15 minutes after CV Builder's).
   - Do the restore drill once.
10. **Backup alert** (optional) **[EXT]**: create a check at https://healthchecks.io (period 1 day,
    grace 2 hours), and put its URL in the `PING_URL="…"` line of the server's `backup-db.sh`.
11. **Uptime alerts** **[EXT]**: follow
    [PRODUCTION_SETUP.md step 13](PRODUCTION_SETUP.md#13-uptime-alerts-ext-once). Add two
    UptimeRobot HTTP(s) monitors, every 5 minutes:
    - `https://api.guests-seating-board.eapps.site/health`, with the keyword `"status":"ok"`.
    - `https://guests-seating-board.eapps.site/`.
12. **Test terminal still on?** **[SRV]**:
    `journalctl -u guests-seating-board-api -n 100 --no-pager | grep -i "TEST terminal"`. A line
    means anyone with Ameria's test cards gets real passes. Switch to the live terminal (step 4)
    as soon as the bank signs off.

### Outside the code

13. **Cap the Gemini spend** **[EXT]**: Google Cloud console, the project of `GEMINI_API_KEY`.
    - Billing → Budgets & alerts → Create budget, for example 10 USD a month with email alerts at
      50/90/100%.
    - APIs & Services → Generative Language API → Quotas: lower "Generate content requests per
      day" to a sane ceiling, for example 500.
14. **Legal review** **[EXT]**: have a lawyer review the terms, privacy and refund texts in
    `src/constants/legal.ts`. The file still calls them a draft; drop that note from its comment
    once they are reviewed.

### Check by hand on the live site

15. **Consent banner** **[WEB]**: it shows only where an opt-in is needed (EU/EEA, UK,
    Switzerland — by the device's time zone, `src/constants/consent.ts`).
    - From Armenia: a private window shows no banner and sets `_ga*` cookies at once
      (DevTools → Application → Cookies).
    - The EU case: DevTools → ⋮ → More tools → Sensors → Location → Berlin (it overrides the time
      zone), then reload in a fresh private window. The banner shows, and there is no `_ga*`
      cookie until you click **Accept** or the **×** (closing counts as accepting); **Decline**
      keeps it cookieless.
    - Footer → **Cookie settings** reopens the banner anywhere. It never shows in the editor.
16. **Phone at 360 px** (a real phone or DevTools device mode) **[WEB]**, in hy and ru:
    - The editor's bottom bar labels fit on two lines.
    - The checkout dialog's buttons wrap instead of overflowing.
    - Pause/play on the template page's slider works.
17. **A real payment on the test terminal** **[WEB]**: pay, then close the tab on the bank page
    before it redirects. Within the next hour the payment should settle on its own: the access
    shows up, and the admin mail says "settled by the hourly check".
