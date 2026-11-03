# Production setup

The one-time, app-specific steps to run Guests on the server, in order. Assumed to be
in place already, so nothing here creates a user or installs them:

- the existing `michael` user, with sudo
- an x86-64 server (`uname -m` prints `x86_64`): Puppeteer has no Linux ARM build of Chrome
- Node 24 at **`/usr/bin/node`** (`command -v node`, `node -v`): both systemd units start that
  exact path, so a Node installed only through nvm is not enough. pnpm is optional: the
  deploy installs it into `~/.local/bin` if it cannot find it
- Docker with the compose plugin (`docker compose version`), and `michael` in the `docker`
  group: the deploy runs `docker compose` as `michael`, without sudo, to create the database
  (`groups michael` lists `docker`)
- nginx and certbot

How the pipeline works is in [DEPLOYMENT.md](DEPLOYMENT.md).

Nothing is downloaded on the server by hand: the deploy itself fetches Chrome. Each step links
the files from this repo's `deployment/` folder, each followed by the command that creates and
opens it on the server. Open the repo file, copy all of it, run the command, paste into nano
(right-click, or `Ctrl+Shift+V`), then save with `Ctrl+O`, `Enter` and exit with `Ctrl+X`.
Then run that step's commands.

To update a file that is already there, empty it first, then open and paste as above:
`sudo truncate -s 0 <path>`.

**[DNS]** DNS provider · **[PC]** your machine, repo root · **[SRV]** server, as `michael` ·
**[GH]** GitHub repo settings · **[EXT]** an outside service's console

Each step is marked **(once)**, done once for the app, or **(any time)**, safe to repeat. A
deploy never touches the files these steps put on the server, so when one of them changes in
the repo, its step says what to redo.

## Environment: two layers

The app (Next.js) and the server (Express API) each have their own settings, in development and
in production:

|            | Development                                                   | Production                                                                                         |
| ---------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **App**    | `.env.local` in the repo root, from [.env.example](../.env.example)         | one GitHub secret per key (step 8), built into the bundle by the pipeline. No file on the server. |
| **Server** | `server/.env`, from [server/.env.example](../server/.env.example) | `server/.env.production.local` on your PC → `ENV_API_BASE64` (steps 6–8) → the pipeline writes `/home/michael/apps/guests/shared/.env.api` |

The app's values are public: both `NEXT_PUBLIC_*` values end up in the browser bundle. The
server's are secret: the database password, the session signing key, the Google and bank
credentials.

## 1. DNS **[DNS]** (once)

| Type  | Name                        | Value                   | Serves                                      |
| ----- | --------------------------- | ----------------------- | ------------------------------------------- |
| A     | `guests.eapps.site`     | `<SERVER_IPV4>`         | the app (HTTP → HTTPS)                      |
| AAAA  | `guests.eapps.site`     | `<SERVER_IPV6>`         | the app (HTTP → HTTPS)                      |
| CNAME | `www.guests.eapps.site` | `guests.eapps.site` | redirect to `https://guests.eapps.site` |
| A     | `api.guests.eapps.site` | `<SERVER_IPV4>`         | the API, HTTPS only                         |
| AAAA  | `api.guests.eapps.site` | `<SERVER_IPV6>`         | the API, HTTPS only                         |

The two AAAA records only if the server has a public IPv6 address (`ip -6 addr show scope
global`); otherwise leave them out. The IPv6 address must really reach the server: Let's
Encrypt checks over IPv6 first, so a wrong AAAA record makes certbot fail. If the zone is on Cloudflare, set every record to **DNS only**.

## 2. Chrome's system libraries and sandbox **[SRV]** (once)

The PDFs are printed by headless Chrome. The deploy downloads Chrome itself (into
`~/.cache/puppeteer`), but Chrome needs a few system libraries a server without a desktop does
not have. Check your release first:

```bash
lsb_release -ds
```

Ubuntu 24.04 or newer, or Debian 13 (package names end in `t64`):

```bash
sudo apt install -y libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2t64
```

Ubuntu 22.04 or Debian 12:

```bash
sudo apt install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2
```

You do not have to get this list exactly right: every deploy checks Chrome against the host's
libraries before it switches anything over, and if one is missing it stops and names it.
Install that one and re-run the deploy.

Then the sandbox. Chrome isolates each page in a sandbox built on user namespaces, which
Ubuntu 23.10 and newer allow only to programs AppArmor names. Ubuntu 22.04 and Debian have no
such restriction, so there the sandbox needs nothing. Check:

```bash
sysctl kernel.apparmor_restrict_unprivileged_userns
```

If it prints `cannot stat` (Ubuntu 22.04, Debian) or `= 0`, the restriction is off: skip the
rest of this step and go to step 3. Do not create the profile below there — its
`abi <abi/4.0>` line needs AppArmor 4, which 22.04 does not have, so it would not even load.

Only if it prints `= 1` (Ubuntu 23.10 or newer), name Chrome to AppArmor:

```bash
sudo nano /etc/apparmor.d/guests-chrome
```

Paste this, then save and exit:

```text
abi <abi/4.0>,
include <tunables/global>

profile guests-chrome /home/michael/.cache/puppeteer/chrome-headless-shell/linux-*/chrome-headless-shell-linux64/chrome-headless-shell flags=(unconfined) {
  userns,
}
```

And load it:

```bash
sudo apparmor_parser -r /etc/apparmor.d/guests-chrome
```

The path is `chrome-headless-shell`, the lighter build the API prints with, not full Chrome.
The `*` covers every version a later Puppeteer upgrade downloads, and the profile can be
loaded before Chrome is there. A host that already has the profile with the older
`chrome/linux-*/chrome-linux64/chrome` path needs this one pasted over it and loaded again.

If a PDF still fails with "No usable sandbox" in `journalctl -u guests-api`, the fallback is
to run Chrome without its sandbox: add `PUPPETEER_NO_SANDBOX="true"` in step 6. That is
acceptable here because Chrome only ever opens this app's own `/render` page and aborts every
other request (`server/src/services/pdf.ts`), but the AppArmor profile is better.

## 3. systemd units **[SRV]** (once)

Paste [guests-web.service](../deployment/guests-web.service) into:

```bash
sudo nano /etc/systemd/system/guests-web.service
```

Paste [guests-api.service](../deployment/guests-api.service) into:

```bash
sudo nano /etc/systemd/system/guests-api.service
```

`sudo nano` creates them owned by `root`, mode `644`. Then load them and start them on every
boot:

```bash
sudo systemctl daemon-reload
sudo systemctl enable guests-web guests-api
```

Then let the deploy workflow restart the two services, and nothing else, without a password.
Open the rule file in nano through `visudo`, which checks the syntax on save and creates the
file with the mode `440` that sudo requires:

```bash
sudo EDITOR=nano visudo -f /etc/sudoers.d/guests-deploy
```

Paste this line, then save and exit as above:

```text
michael ALL=(root) NOPASSWD: /usr/bin/systemctl restart guests-web, /usr/bin/systemctl restart guests-api
```

The path must be where `systemctl` really is; `command -v systemctl` prints it, and
`/usr/bin/systemctl` is the usual one. Check the rule works (no password prompt):

```bash
sudo -n systemctl restart guests-api
```

Before the first deploy that restart fails with "Job for guests-api.service failed because
of unavailable resources or another system error": its working directory (`api/current`) and
env file (`shared/.env.api`) do not exist until the deploy creates them. That is expected;
what matters is that sudo does not ask for a password (`sudo: a password is required` means
the rule does not match).

If a `.service` file changes in the repo later, paste it again, then run
`sudo systemctl daemon-reload && sudo systemctl restart <that unit>`.

## 4. Certificates, auto-renewing **[SRV]** (once)

The vhosts in step 5 reference these certificates, so issue them first. There are two: one for
the app that also covers `www`, and one for the API. `certonly --nginx` lets certbot answer
Let's Encrypt's check through nginx by itself and only fetches the certificate: it never edits
a vhost file.

certbot's nginx plugin is needed. If `sudo certbot plugins` does not list `nginx`, install it
with `sudo apt install python3-certbot-nginx`.

```bash
sudo certbot certonly --nginx -d guests.eapps.site -d www.guests.eapps.site --deploy-hook "systemctl reload nginx"
sudo certbot certonly --nginx -d api.guests.eapps.site --deploy-hook "systemctl reload nginx"
```

Each certificate renews by itself: certbot's timer renews it before it expires, the same way it
was issued, and the `--deploy-hook`, saved in each renewal config, reloads nginx afterwards.
The timer is one for the whole server, shared with the other apps' certificates, so there is
nothing to set up for it here.

Check these two certificates only. The dry run asks for test certificates and changes nothing;
each should end with "all simulated renewals succeeded":

```bash
sudo certbot renew --dry-run --cert-name guests.eapps.site
sudo certbot renew --dry-run --cert-name api.guests.eapps.site
```

## 5. nginx **[SRV]** (once)

Paste [guests.eapps.site.conf](../deployment/guests.eapps.site.conf) into:

```bash
sudo nano /etc/nginx/sites-available/guests.eapps.site.conf
```

Paste [api.guests.eapps.site.conf](../deployment/api.guests.eapps.site.conf) into:

```bash
sudo nano /etc/nginx/sites-available/api.guests.eapps.site.conf
```

`sudo nano` creates them owned by `root`, mode `644`. Then enable them:

```bash
sudo ln -sf /etc/nginx/sites-available/guests.eapps.site.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/api.guests.eapps.site.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Run the reload only if `nginx -t` says `syntax is ok` and `test is successful`.

If a `.conf` file changes in the repo later, paste it again, then run
`sudo nginx -t && sudo systemctl reload nginx`.

## 6. Server environment **[PC]** + **[EXT]** (once)

Everything in this step runs on **your PC**, in the repo root, never on the server. Any
terminal works: PowerShell, Command Prompt, Git Bash, or the VS Code terminal.

Two random values first. Generate each once and keep it in your password manager. The
commands are Node only, so they are the same in every terminal.

The **database password**, 64 hex characters. The first deploy creates the database (a
Postgres 16 container on `127.0.0.1:5010`) from `DATABASE_URL`, so this becomes its password.
Changing it later does not change the password of the database already created.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The **session key**, `JWT_SECRET`, 128 hex characters. It signs every login; changing it later
signs everyone out.

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Then the outside services:

- **Google sign-in** (optional; empty hides the button): Google Cloud console → APIs & Services
  → Credentials → Create OAuth client ID → Web application. Authorized redirect URI, exactly:
  `https://api.guests.eapps.site/identity/google/callback`. Scopes: email, profile.
- **Mail engine** (password-reset links and the contact form): `MAIL_API_URL` is the engine's
  base URL from its [API docs](https://github.com/NavasardianMichael/api-mail-engine/blob/master/API_DOCS.md),
  bare — no `/mail`, no trailing path (the client appends `/mail/internal/send` itself).
  `MAIL_API_KEY` is the engine's `API_KEY`, the same one the other apps use
  (`server/src/lib/mail.ts`). Empty in production, both answer with an error; a wrong value
  answers the contact form with 502 and logs `[mail] … failed: <status> <reason>`.
- **Google Gemini** (photo import): an API key from https://aistudio.google.com/apikey as
  `GEMINI_API_KEY`. Without it the import dialog says photo import is unavailable.

`server/.env.production.local` (git-ignored). Put the database password after `guests:`:

```dotenv
DATABASE_URL="postgresql://guests:<database password>@127.0.0.1:5010/guests?schema=public"
JWT_SECRET="<session key>"
CORS_ORIGIN="https://guests.eapps.site"
API_PUBLIC_URL="https://api.guests.eapps.site"

MAIL_API_URL="https://api-mail-engine.mnavasardian.com"
MAIL_API_KEY="<the mail engine's API_KEY>"

GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="https://api.guests.eapps.site/identity/google/callback"

GEMINI_API_KEY=""
```

The first four are required; `GEMINI_API_KEY` turns photo import on.
Add `PUPPETEER_NO_SANDBOX="true"` only if step 2 sent you here. Leave out `NODE_ENV`, `PORT`,
`HOST` and `RENDER_ORIGIN`: the pipeline sets them itself.

Generate the `ENV_API_BASE64` value from it, straight to the clipboard. `clip` is Windows and
works in PowerShell, Command Prompt and Git Bash alike (on macOS use `| pbcopy`):

```bash
pnpm env:base64 production | clip
```

It prints only the base64 to the clipboard, and lists the key names (never values) and any
warnings in the terminal: a dev password, a key the deploy owns, the bank's test mode, an
`http://` origin. Read them before pasting.

If this file changes later, run the command again, update the `ENV_API_BASE64` secret and
redeploy (step 9's **Run workflow**).

## 7. Google consent screen and the bank's pages **[EXT]** (once)

- Only with Google sign-in (step 6's `GOOGLE_*` filled): Google Cloud console → OAuth consent
  screen: add `eapps.site` to the authorized domains, and
  `https://guests.eapps.site/privacy` and `/terms` as the privacy-policy and terms links.
- The Terms and Privacy pages (`/terms`, `/privacy`) are drafts (`src/constants/legal.ts`):
  have them reviewed before launch. Billing will add a refund page (`docs/BILLING.md`).

## 8. GitHub secrets **[GH]** (once)

Settings → Secrets and variables → Actions → **Secrets** tab → **Repository secrets** → **New
repository secret**. Every value below goes there: not in the Variables tab, and not under
Settings → Environments, whose secrets the deploy jobs cannot read (a value there arrives
empty, and the build stops with "NEXT_PUBLIC_API_URL is empty").

| Name                   | Value                                                    |
| ---------------------- | -------------------------------------------------------- |
| `SSH_HOST`             | `<SERVER_IPV4>`                                          |
| `SSH_USER`             | `michael`                                                |
| `SSH_KEY`              | your existing private key (its public half is already in `/home/michael/.ssh/authorized_keys`), BEGIN to END lines |
| `SSH_PORT`             | only if SSH is not on port 22                            |
| `APP_DIR`              | `/home/michael/apps/guests`                          |
| `ENV_API_BASE64`       | output of step 6                                         |
| `NEXT_PUBLIC_API_URL`  | `https://api.guests.eapps.site`                      |
| `NEXT_PUBLIC_SITE_URL` | `https://guests.eapps.site` (must equal `CORS_ORIGIN` in step 6) |

Optional ones, for analytics, error tracking and search engines, come from step 10; each one
left out simply turns its feature off.

A saved secret cannot be viewed again, and logs show it as `***`. To check or fix one, overwrite
it with the right value.

The two `NEXT_PUBLIC_*` secrets are built into the bundle: change one, then redeploy the web
(re-run **Deploy to Production**).

## 9. First deploy **[GH]** (once)

Actions → **Deploy to Production** → **Run workflow** (deploys both sides). The first run takes
longer: it downloads Chrome and creates the database. After that, every merge to `master`
deploys automatically, and every pull request runs **CI** first.

The deploy ends by printing a real PDF. If that step fails, its log says why: a missing library
(step 2), "No usable sandbox" (step 2's AppArmor profile), or a 403 (`CORS_ORIGIN` is not
exactly `https://guests.eapps.site`).

Check it (any time):

```powershell
curl.exe -s  https://api.guests.eapps.site/health    # "status":"ok", "ai":true once Gemini is set
curl.exe -sI https://guests.eapps.site/              # 200
curl.exe -sI https://www.guests.eapps.site           # 301 -> https://guests.eapps.site
```

Then in a browser: make a list without signing in (try a photo import), print and download its
PDF, then sign up and check the list moved to the account.

After a few downloads, see what the API really uses on the server: `systemctl status
guests-api` (its `Memory:` line counts Node and the Chrome each PDF launches, against the
unit's `MemoryHigh=512M` / `MemoryMax=768M`).

## 10. Analytics, error tracking, search engines **[EXT]** + **[GH]** (once, each optional)

Each item ends in a GitHub secret (step 8's page) or a DNS record. The secrets are built into
the bundle, so after adding any of them redeploy the web (**Deploy to Production** → **Run
workflow**).

**Google Analytics 4.** [analytics.google.com](https://analytics.google.com) → Admin → Create
property (time zone Armenia, currency AMD) → Web data stream for
`https://guests.eapps.site` → copy the Measurement ID `G-…` into the secret
`NEXT_PUBLIC_GA_ID`. Page views come by themselves; the app also sends `list_pdf`,
`guests_import`, `sign_up` and `login`. In Admin → Events, mark `list_pdf` and `sign_up` as
key events.

**Sentry** (errors in the web app). [sentry.io](https://sentry.io) → Create project, platform
Next.js → copy its DSN into the secret `NEXT_PUBLIC_SENTRY_DSN`. For readable stack traces
also add `SENTRY_AUTH_TOKEN` (Settings → Auth Tokens → an organization token), `SENTRY_ORG`
and `SENTRY_PROJECT` (the two slugs in the project's URL); without them errors still arrive,
with minified frames.

**Google Search Console.** [search.google.com/search-console](https://search.google.com/search-console)
→ Add property → **Domain** → `guests.eapps.site` → add the TXT record it shows at the DNS
provider (step 1's zone) → Verify. No secret, no redeploy. (A **URL prefix** property works too:
choose "HTML tag" and put only its `content="…"` value in `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`.)
Then Sitemaps → submit `https://guests.eapps.site/sitemap.xml`, and URL Inspection → the
homepage → Request indexing.

**Bing Webmaster Tools.** [bing.com/webmasters](https://www.bing.com/webmasters) → Import from
Google Search Console: verified with the sitemap included, nothing else to add. Worth doing
for answer engines too: Bing's index feeds ChatGPT search, Copilot and DuckDuckGo.
(Without the import: the meta-tag method, value in `NEXT_PUBLIC_BING_VERIFICATION`.)

**Yandex Webmaster** (Russian-language search). [webmaster.yandex.com](https://webmaster.yandex.com)
→ Add site `https://guests.eapps.site` → Meta tag → its `content` value into
`NEXT_PUBLIC_YANDEX_VERIFICATION` → redeploy → Check. Then Indexing → Sitemap files → add the
sitemap, and Site information → Regional settings → Armenia.

Nothing to submit for AI engines: `robots.txt` welcomes their crawlers by name, and
`/llms.txt` describes the service in Armenian, English and Russian.
