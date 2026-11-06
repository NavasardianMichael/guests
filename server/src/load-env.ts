import dotenv from 'dotenv'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Load `server/`'s env files, not whatever `.env` sits in `process.cwd()`. `pnpm watch` runs
 * concurrently from the repo root, so `import 'dotenv/config'` would otherwise read the
 * Next.js env and leave Prisma with the wrong `DATABASE_URL`.
 *
 * Same files and precedence as Next.js: `.env.<mode>.local` > `.env.local` > `.env.<mode>` >
 * `.env`, where mode is `NODE_ENV` (development when unset). dotenv never overrides, so the
 * first file to set a variable wins — and a variable already in the environment beats them all.
 * Also imported by `prisma.config.ts`, so the CLI sees the same `DATABASE_URL`.
 *
 * Importing `@prisma/client` loads `server/.env` by itself (the generated client points there),
 * and the lint's import order puts this side-effect import after it: whichever module reaches
 * the client first would pin `.env`'s values — the example's empty `GEMINI_API_KEY` — over the
 * `.local` files. So a variable holding exactly `.env`'s value is taken to be that load and
 * dropped first, and the files apply in their order. (A real variable that happens to equal
 * `.env`'s value yields to a `.local` file that sets it.)
 */
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.env.NODE_ENV || 'development'

const base = path.join(dir, '.env')
if (existsSync(base)) {
  for (const [key, value] of Object.entries(dotenv.parse(readFileSync(base)))) {
    if (process.env[key] === value) delete process.env[key]
  }
}

dotenv.config({
  path: [`.env.${mode}.local`, '.env.local', `.env.${mode}`, '.env'].map((file) => path.join(dir, file)),
  quiet: true,
})
