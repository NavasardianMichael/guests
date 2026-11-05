import dotenv from 'dotenv'
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
 */
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.env.NODE_ENV || 'development'

dotenv.config({
  path: [`.env.${mode}.local`, '.env.local', `.env.${mode}`, '.env'].map((file) => path.join(dir, file)),
  quiet: true,
})
