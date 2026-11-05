#!/usr/bin/env node
/**
 * Runs after `pnpm install`:
 * 1. stop a running API dev server (Windows only — see stopApiDevServer)
 * 2. prisma generate (always)
 * 3. locally (not CI/production): create missing env files from their examples, apply every
 *    pending migration — starting the Docker Postgres first if it is not reachable — and seed
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Windows needs a shell to resolve `pnpm.cmd` — Node refuses to spawn a `.cmd` without
// one. But Node 24 raises DEP0190 when an args array is combined with `shell: true`,
// because the args are then concatenated rather than escaped. Every argument passed
// below is a static literal, so pre-joining the command is equivalent and stays quiet.
const useShell = process.platform === 'win32'

function run(label, command, args, { allowFailure = false } = {}) {
  console.log(`\n[postinstall] ${label}...`)
  const options = { cwd: rootDir, stdio: 'inherit' }
  const result = useShell
    ? spawnSync([command, ...args].join(' '), { ...options, shell: true })
    : spawnSync(command, args, options)

  if (result.status !== 0 && !allowFailure) {
    process.exit(result.status ?? 1)
  }

  return result.status === 0
}

// The default `port` in server/src/config.ts.
const API_PORT = 9010

/**
 * A running API holds Prisma's query engine DLL open, and on Windows `prisma generate`
 * then fails with EPERM renaming the new engine over it. So stop whichever node process
 * listens on the API port. That is the child of `node --watch-path`, which does not restart
 * it on its own (it waits for a change under src/), so restart `pnpm dev` after an install.
 * Other platforms can replace a loaded library, so they skip this.
 */
function stopApiDevServer() {
  if (process.platform !== 'win32') return

  const netstat = spawnSync('netstat', ['-ano'], { encoding: 'utf8' })
  const pids = new Set()
  for (const line of netstat.stdout?.split(/\r?\n/) ?? []) {
    // TCP  [::]:9004  [::]:0  LISTENING  61124 — matched on the zero remote port rather
    // than the state column, which Windows localises.
    const [proto, local, remote, , pid] = line.trim().split(/\s+/)
    if (proto === 'TCP' && local?.endsWith(`:${API_PORT}`) && remote?.endsWith(':0')) {
      pids.add(pid)
    }
  }

  for (const pid of pids) {
    const task = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
    })
    if (!task.stdout?.toLowerCase().startsWith('"node.exe"')) {
      console.warn(`\n[postinstall] :${API_PORT} is held by PID ${pid}, which is not node — leaving it.`)
      continue
    }
    console.log(`\n[postinstall] Stopping the API dev server on :${API_PORT} (PID ${pid})...`)
    spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore' })
  }
}

/** A missing env file is copied from its example: the examples' dev defaults work as they are. */
function ensureEnvFile(relativePath, relativeExample) {
  const target = path.join(rootDir, relativePath)
  const example = path.join(rootDir, relativeExample)
  if (existsSync(target) || !existsSync(example)) return
  copyFileSync(example, target)
  console.log(`\n[postinstall] Created ${relativePath} from ${relativeExample}.`)
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

/** The container docker-compose.yml names, polled until its healthcheck passes. */
const POSTGRES_CONTAINER = 'guests-postgres'
const POSTGRES_WAIT_MS = 60_000

function startPostgres() {
  console.log('\n[postinstall] Postgres is not reachable — starting it with docker compose...')
  const up = spawnSync('docker', ['compose', 'up', '-d'], { cwd: rootDir, stdio: 'inherit' })
  if (up.status !== 0) return false

  const deadline = Date.now() + POSTGRES_WAIT_MS
  while (Date.now() < deadline) {
    const health = spawnSync('docker', ['inspect', '-f', '{{.State.Health.Status}}', POSTGRES_CONTAINER], {
      encoding: 'utf8',
    })
    if (health.stdout?.trim() === 'healthy') return true
    sleep(1000)
  }
  console.warn(`\n[postinstall] ${POSTGRES_CONTAINER} did not become healthy within ${POSTGRES_WAIT_MS / 1000}s.`)
  return false
}

stopApiDevServer()

run('Generating Prisma client', 'pnpm', ['--filter', 'guests-server', 'run', 'db:generate'])

// A build machine installs too, and must never create env files or start containers.
if (process.env.CI || process.env.NODE_ENV === 'production' || process.env.SKIP_DB_SETUP) {
  console.log('\n[postinstall] CI/production install — skipping database setup.')
  process.exit(0)
}

ensureEnvFile('server/.env', 'server/.env.example')
ensureEnvFile('.env.local', '.env.example')

const deploy = () =>
  run('Applying pending migrations', 'pnpm', ['--filter', 'guests-server', 'run', 'db:deploy'], { allowFailure: true })

// The first attempt covers a Postgres that is already up, Docker or not; only when that fails
// is the compose service started and the deploy retried.
const migrated = deploy() || (startPostgres() && deploy())

if (!migrated) {
  console.warn(
    '\n[postinstall] Migrations NOT applied — Postgres is unreachable (is Docker running?).',
    'Fix that, then run: pnpm db:setup'
  )
  process.exit(0)
}

const seeded = run('Seeding database', 'pnpm', ['--filter', 'guests-server', 'run', 'db:seed'], {
  allowFailure: true,
})

console.log(
  seeded
    ? '\n[postinstall] Database setup complete.'
    : '\n[postinstall] Migrations applied but seeding failed — run `pnpm db:seed` for the error.'
)
