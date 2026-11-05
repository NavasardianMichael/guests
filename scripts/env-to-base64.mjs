#!/usr/bin/env node
/**
 * Encodes an API env file to base64 for the `ENV_API_BASE64` GitHub secret.
 *
 *   pnpm env:base64 production        -> reads server/.env.production.local
 *   pnpm env:base64 staging           -> reads server/.env.staging.local
 *   pnpm env:base64 production | clip       (Windows)
 *   pnpm env:base64 production | pbcopy     (macOS)
 *
 * The base64 is the ONLY thing on stdout, so it pipes cleanly. Everything else —
 * the banner, the key list, the warnings — goes to stderr. Values are never echoed.
 *
 * Usage: node scripts/env-to-base64.mjs <environment> [directory]
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const [environment, dir = 'server'] = process.argv.slice(2)

if (!environment) {
  console.error('Usage: pnpm env:base64 <environment> [directory]')
  console.error('   e.g. pnpm env:base64 production')
  process.exit(1)
}

const fileName = `.env.${environment}.local`
const filePath = path.resolve(rootDir, dir, fileName)

if (!existsSync(filePath)) {
  console.error(`Not found: ${path.relative(rootDir, filePath)}`)
  console.error(`Create it as docs/PRODUCTION_SETUP.md step 6 describes (keys: ${path.join(dir, '.env.example')}).`)
  process.exit(1)
}

// Normalised to LF before encoding. A CRLF file checked out on Windows would otherwise
// carry \r into every value on the Linux host — `HOST=127.0.0.1\r` is not an IP address.
// The deploy workflow strips them too, belt and braces.
const content = readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n')

/** `KEY` -> its value without quotes, for the checks below. Never printed. */
const values = new Map(
  content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const at = line.indexOf('=')
      return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^(["'])(.*)\1$/, '$2')]
    })
)
const keys = [...values.keys()]
const value = (key) => values.get(key) ?? ''

const warnings = []
const warn = (message) => warnings.push(message)

// The deploy workflow strips and rewrites these so they cannot drift from the ports the
// systemd units use. Keeping them here just invites a confusing diff.
const OWNED_BY_DEPLOY = ['NODE_ENV', 'PORT', 'HOST', 'RENDER_ORIGIN']
const owned = keys.filter((key) => OWNED_BY_DEPLOY.includes(key))
if (owned.length) warn(`${owned.join(', ')} — the deploy overwrites these; remove them`)

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGIN', 'API_PUBLIC_URL']
const missing = REQUIRED.filter((key) => !value(key))
if (missing.length) warn(`missing or empty: ${missing.join(', ')}`)

const databaseUrl = value('DATABASE_URL')
// Dev and production both publish Postgres on 5010, so `localhost` vs `127.0.0.1` is the
// only thing distinguishing a dev URL from a production one. Worth shouting about.
if (/@localhost:/.test(databaseUrl)) warn('DATABASE_URL uses `localhost` — production needs 127.0.0.1')
if (/:5432\//.test(databaseUrl)) warn('DATABASE_URL uses :5432 — production publishes Postgres on 5010')
if (databaseUrl.includes('guests:guests@')) warn('DATABASE_URL still has the dev password')
if (/^postgresql:\/\/[^:]*:@/.test(databaseUrl)) warn('DATABASE_URL has an empty password')

const jwtSecret = value('JWT_SECRET')
if (jwtSecret && (jwtSecret.length < 64 || jwtSecret.startsWith('change-me'))) {
  warn('JWT_SECRET is short or the example value — 128 hex characters, docs/PRODUCTION_SETUP.md step 6')
}

for (const key of ['CORS_ORIGIN', 'API_PUBLIC_URL', 'GOOGLE_REDIRECT_URI']) {
  const origin = value(key)
  if (origin && !origin.startsWith('https://')) warn(`${key} is not https:// — still the dev value?`)
}

if (!value('GEMINI_API_KEY')) warn('GEMINI_API_KEY is empty — photo import is off')
if (!value('MAIL_API_URL') || !value('MAIL_API_KEY')) {
  warn('MAIL_API_URL/MAIL_API_KEY empty — password reset and the contact form fail in production')
}
if (!value('GOOGLE_CLIENT_ID')) warn('GOOGLE_CLIENT_ID is empty — "Sign in with Google" stays hidden')

console.error('')
console.error(`Encoded ${path.relative(rootDir, filePath)} — ${keys.length} variables`)
console.error(`  ${keys.join(', ')}`)
console.error('')
for (const message of warnings) console.error(`  WARNING  ${message}`)
if (warnings.length) console.error('')

console.error('Paste the line below into the ENV_API_BASE64 GitHub secret:')
console.error('')

console.log(Buffer.from(content, 'utf8').toString('base64'))
