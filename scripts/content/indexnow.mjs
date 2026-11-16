#!/usr/bin/env node
/**
 * Tells IndexNow engines (Bing, Yandex, Seznam, Naver; Bing feeds ChatGPT search) which content
 * pages a deploy changed, so they recrawl them now rather than whenever they next pass. Google
 * does not take IndexNow: it reads the sitemap, whose `lastModified` comes from each page's
 * `updated` date. Run by `.github/workflows/content.yml` after the pages are live.
 *
 *   node scripts/content/indexnow.mjs --base <sha> --head <sha>   pages changed between two commits
 *   node scripts/content/indexnow.mjs --all                       every content page
 *   add --dry-run to print the URLs without sending them
 *
 * The site comes from NEXT_PUBLIC_SITE_URL; the key is the `public/<32 hex>.txt` file whose
 * content is its own name (the protocol's proof that the key belongs to the host).
 *
 * A failed notification is a warning, never a failed deploy: the pages are live either way.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ENDPOINT = 'https://api.indexnow.org/indexnow'
/** `src/content/<folder>/<slug>.ts` is served at `<route>/<slug>` (src/constants/routes.ts). */
const FOLDERS = { guides: '/guides', examples: '/examples' }
/** What content.yml deploys: the copy, and the pictures and video made for it. */
const CONTENT_ROOTS = ['src/content', 'public/content']

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const option = (name) => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? '' : (args[index + 1] ?? '')
}

const warn = (message) => {
  // GitHub Actions shows `::warning::` lines as annotations; elsewhere they read fine as text.
  console.log(`::warning::indexnow: ${message}`)
}

const readKey = () => {
  const dir = path.join(ROOT, 'public')
  const file = readdirSync(dir).find((name) => /^[0-9a-f]{32}\.txt$/.test(name))
  if (!file) throw new Error('no public/<32 hex>.txt key file')
  const key = readFileSync(path.join(dir, file), 'utf8').trim()
  if (`${key}.txt` !== file) throw new Error(`public/${file} must contain exactly its own name`)
  return key
}

const isCommit = (sha) => {
  if (!/^[0-9a-f]{7,40}$/.test(sha) || /^0+$/.test(sha)) return false
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: ROOT, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/** Every page's file, or those a range changed (deleted ones too: engines then drop them). */
const contentFiles = (base, head) => {
  if (!base) {
    return Object.keys(FOLDERS).flatMap((folder) =>
      readdirSync(path.join(ROOT, 'src/content', folder)).map((name) => `src/content/${folder}/${name}`)
    )
  }
  const out = execFileSync('git', ['diff', '--name-only', base, head, '--', ...CONTENT_ROOTS], { cwd: ROOT, encoding: 'utf8' })
  return out.split('\n').filter(Boolean)
}

/** Paths to announce: each changed page (its copy or its picture), and the hub that lists it. */
export const pathsFor = (files) => {
  const paths = new Set()
  for (const file of files) {
    const page = /^src\/content\/(guides|examples)\/([a-z0-9-]+)\.ts$/.exec(file)
    const picture = /^public\/content\/examples\/([a-z0-9-]+)\.webp$/.exec(file)
    if (page) {
      paths.add(`${FOLDERS[page[1]]}/${page[2]}`)
      paths.add(FOLDERS[page[1]])
    } else if (picture) {
      paths.add(`${FOLDERS.examples}/${picture[1]}`)
      paths.add(FOLDERS.examples)
    } else if (CONTENT_ROOTS.some((root) => file.startsWith(`${root}/`))) {
      // The registry, the types, a video: the hubs' lists or cards may have changed.
      for (const route of Object.values(FOLDERS)) paths.add(route)
    }
  }
  return [...paths].sort()
}

const main = async () => {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '')
  if (!/^https:\/\//.test(site)) {
    warn('NEXT_PUBLIC_SITE_URL is not an https origin; nothing sent')
    return
  }

  const head = option('head') || 'HEAD'
  const base = flag('all') ? '' : option('base')
  if (base && !isCommit(base)) warn(`base ${base} is not a commit here; announcing every content page`)
  const paths = pathsFor(contentFiles(base && isCommit(base) ? base : '', head))
  if (paths.length === 0) {
    console.log('indexnow: no content page changed')
    return
  }

  const urlList = paths.map((p) => `${site}${p}`)
  console.log(`indexnow: ${urlList.length} URL(s)\n${urlList.map((url) => `  ${url}`).join('\n')}`)
  if (flag('dry-run')) return

  const key = readKey()
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: new URL(site).host, key, keyLocation: `${site}/${key}.txt`, urlList }),
    signal: AbortSignal.timeout(30_000),
  })
  // 200: received. 202: received, key not yet verified (the first time). Anything else: say so.
  if (response.status === 200 || response.status === 202) console.log(`indexnow: accepted (HTTP ${response.status})`)
  else warn(`HTTP ${response.status} ${(await response.text()).slice(0, 300)}`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => warn(error instanceof Error ? error.message : String(error)))
}
