#!/usr/bin/env node
/**
 * Assembles the API's deployable release directory (default `out/api`).
 *
 * The API cannot ship as a slice of the workspace: `pnpm install --filter guests-server`
 * still installs every root dependency (next, antd, the whole web toolchain) and still runs
 * the root's `prepare: husky` and `postinstall`, which do not belong on a production host.
 * And it cannot ship a prebuilt `node_modules` either: `pnpm deploy` reassembles the virtual
 * store in a layout where Prisma's generated client fails to resolve its own
 * `#main-entry-point` self-reference — and Puppeteer's Chrome and the argon2 binary must be
 * fetched for the host's platform, not the runner's.
 *
 * So the release is a standalone, single-package project: `dist/` + `prisma/` + a
 * `package.json` holding only the runtime dependencies, at the **exact** versions the
 * workspace lockfile resolved. Exact versions matter — a `^` range would let the server
 * install a different patch than CI tested. The deploy then runs a plain
 * `pnpm install --prod --frozen-lockfile` on the host, which is the same code path as a
 * normal install: `@prisma/client`'s postinstall generates a working client and
 * `puppeteer`'s downloads Chrome into `PUPPETEER_CACHE_DIR`.
 *
 * Usage: node scripts/build-api-release.mjs [outDir]
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const serverDir = path.join(rootDir, 'server')
const outDir = path.resolve(rootDir, process.argv[2] ?? 'out/api')

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

const serverPkg = readJson(path.join(serverDir, 'package.json'))
const rootPkg = readJson(path.join(rootDir, 'package.json'))
const workspace = readFileSync(path.join(rootDir, 'pnpm-workspace.yaml'), 'utf8')

/** The version actually on disk after `pnpm install`, so prod matches what CI tested. */
function resolvedVersion(name) {
  const manifest = path.join(serverDir, 'node_modules', name, 'package.json')
  if (!existsSync(manifest)) {
    throw new Error(`${name} is not installed under server/node_modules — run \`pnpm install\` before this script.`)
  }
  return readJson(manifest).version
}

const dependencies = Object.fromEntries(
  Object.keys(serverPkg.dependencies)
    .sort()
    .map((name) => [name, resolvedVersion(name)])
)

if (!existsSync(path.join(serverDir, 'dist', 'src', 'index.js'))) {
  throw new Error('server/dist is missing — run `pnpm --filter guests-server build` first.')
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

// Only the API. tsc also compiles the dev seed (dist/prisma) and prisma.config: neither runs
// in production — the seed creates the test accounts in docs/DEV_CREDS.md.
cpSync(path.join(serverDir, 'dist', 'src'), path.join(outDir, 'dist', 'src'), { recursive: true })
// The schema and migrations ship too: the deploy runs `prisma migrate deploy` on the host.
const prismaDir = path.join(serverDir, 'prisma')
const prismaOut = path.join(outDir, 'prisma')
mkdirSync(prismaOut, { recursive: true })
cpSync(path.join(prismaDir, 'schema.prisma'), path.join(prismaOut, 'schema.prisma'))
cpSync(path.join(prismaDir, 'migrations'), path.join(prismaOut, 'migrations'), { recursive: true })

writeFileSync(
  path.join(outDir, 'package.json'),
  `${JSON.stringify(
    {
      name: serverPkg.name,
      version: serverPkg.version,
      private: true,
      type: 'module',
      // Pins the host install to the pnpm that resolved the lockfile. A corepack shim
      // reads this and fetches that exact version, so the deploy stops depending on
      // whichever pnpm the server happens to carry.
      packageManager: rootPkg.packageManager,
      // No `postinstall`/`prepare`: the host install must not migrate, seed, or reach for
      // husky. Migrations are an explicit, ordered step in the deploy script instead.
      scripts: { start: 'node dist/src/index.js' },
      dependencies,
    },
    null,
    2
  )}\n`
)

// `packages: []` makes the release its own workspace root. Without it pnpm walks up,
// resolves against the repo's workspace, and produces no standalone lockfile.
//
// `onlyBuiltDependencies` is copied from the repo's own pnpm-workspace.yaml and is REQUIRED:
// pnpm 10 blocks dependency install scripts by default. A blocked @prisma/client postinstall
// means the API dies at boot with "Cannot find module '.prisma/client/default'"; a blocked
// puppeteer one means there is no Chrome and every PDF fails.
const workspaceLines = workspace.split(/\r?\n/)
const listStart = workspaceLines.indexOf('onlyBuiltDependencies:') + 1
const listEnd = workspaceLines.findIndex((line, index) => index >= listStart && !line.trimStart().startsWith('- '))
const builtDependencies = listStart ? workspaceLines.slice(listStart, listEnd === -1 ? undefined : listEnd) : []
if (!builtDependencies.some((line) => line.includes('puppeteer'))) {
  throw new Error('pnpm-workspace.yaml: onlyBuiltDependencies must list puppeteer and the Prisma packages.')
}

writeFileSync(
  path.join(outDir, 'pnpm-workspace.yaml'),
  ['packages: []', '', 'onlyBuiltDependencies:', ...builtDependencies, ''].join('\n')
)

console.log(`API release assembled at ${path.relative(rootDir, outDir)}`)
console.log(`  ${Object.keys(dependencies).length} runtime dependencies, pinned exactly`)
