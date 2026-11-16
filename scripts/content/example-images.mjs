#!/usr/bin/env node
/**
 * `pnpm content:images` — draws each event example's sheet as WebP
 * (`public/content/examples/<slug>.webp`) and records what was drawn in
 * `src/content/exampleImages.json` (see `src/content/exampleImages.ts`).
 *
 * Needs the web running (`pnpm dev` or `pnpm start`, :7010, or CONTENT_IMAGES_ORIGIN). It opens
 * `/render` — the PDF's own print page — and hands it the list exactly as the API's headless
 * Chrome does (`window.__SHEET_RENDER__`), so the picture is the PDF's first page, unwatermarked.
 *
 * Run by tsx (it imports the TypeScript content): the package script takes care of that.
 * `--force` redraws every picture; otherwise only those whose fingerprint changed.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ORIGIN = (process.env.CONTENT_IMAGES_ORIGIN ?? 'http://localhost:7010').replace(/\/+$/, '')
const OUT_DIR = path.join(ROOT, 'public/content/examples')
const MANIFEST = path.join(ROOT, 'src/content/exampleImages.json')
/** Drawn at 2x the sheet's CSS size (96 dpi): an A4 page is ~1588 px wide, sharp on any screen. */
const SCALE = 2

/** Twin of the content test's: the hash of what the picture shows. */
export const fingerprint = (input) => createHash('sha256').update(JSON.stringify(input)).digest('hex').slice(0, 16)

const main = async () => {
  // Loaded here, not at the top: the content tests import `fingerprint` without tsx.
  const { EVENT_EXAMPLES } = await import('../../src/content/index.ts')
  const { exampleDocument } = await import('../../src/content/exampleDocument.ts')
  // Puppeteer is the API's dependency (it prints the PDFs); borrow it rather than add a second Chrome.
  const puppeteer = createRequire(path.join(ROOT, 'server/package.json'))('puppeteer')

  try {
    await fetch(`${ORIGIN}/render`, { signal: AbortSignal.timeout(120_000) })
  } catch {
    throw new Error(`the web is not answering at ${ORIGIN}: start it (pnpm dev) and run again`)
  }

  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const force = process.argv.includes('--force')
  mkdirSync(OUT_DIR, { recursive: true })

  const browser = await puppeteer.launch({ headless: 'shell' })
  let problems = 0
  try {
    for (const example of EVENT_EXAMPLES) {
      const doc = exampleDocument(example)
      const print = fingerprint(doc)
      if (!force && manifest[example.slug]?.fingerprint === print) {
        console.log(`  ${example.slug}: up to date`)
        continue
      }
      const page = await browser.newPage()
      // Wide and tall enough for an A4 or A3 page either way round; the clip takes the sheet.
      await page.setViewport({ width: 1700, height: 1700, deviceScaleFactor: SCALE })
      await page.evaluateOnNewDocument((injected) => {
        window.__SHEET_RENDER__ = injected
      }, doc)
      await page.goto(`${ORIGIN}/render`, { waitUntil: 'networkidle0', timeout: 180_000 })
      await page.waitForSelector('[data-sheet-ready="true"]', { timeout: 120_000 })
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      const sheets = await page.$$('.sh-page')
      const box = await sheets[0]?.boundingBox()
      if (!box) throw new Error(`${example.slug}: no page drawn`)
      if (sheets.length > 1) {
        problems += 1
        console.log(`  ${example.slug}: runs onto ${sheets.length} pages — lower its textScale or columns; the picture shows page 1`)
      }
      // A hall plan that does not fit its page is drawn anyway, past the edge or over its
      // neighbours: every block must sit inside the page and clear of the others.
      const clash = await sheets[0].evaluate((sheet) => {
        const edge = sheet.getBoundingClientRect()
        const blocks = [...sheet.querySelectorAll('.sh-block')].map((element) => ({ id: element.dataset.blockId, rect: element.getBoundingClientRect() }))
        const outside = blocks.find(({ rect }) => rect.left < edge.left - 1 || rect.top < edge.top - 1 || rect.right > edge.right + 1 || rect.bottom > edge.bottom + 1)
        if (outside) return `${outside.id} runs off the page`
        for (const [index, a] of blocks.entries()) {
          for (const b of blocks.slice(index + 1)) {
            const x = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left)
            const y = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top)
            if (x > 2 && y > 2) return `${a.id} overlaps ${b.id}`
          }
        }
        return null
      })
      if (clash) {
        problems += 1
        console.log(`  ${example.slug}: ${clash} — lower its textScale or take guests out`)
      }
      const file = path.join(OUT_DIR, `${example.slug}.webp`)
      const clip = { x: box.x, y: box.y, width: Math.round(box.width), height: Math.round(box.height) }
      await page.screenshot({ path: file, type: 'webp', quality: 82, clip })
      await page.close()
      manifest[example.slug] = { fingerprint: print, width: clip.width * SCALE, height: clip.height * SCALE, pages: sheets.length, fits: !clash }
      console.log(`  ${example.slug}: drawn (${Math.round(readFileSync(file).length / 1024)} KB, ${clip.width * SCALE}×${clip.height * SCALE})`)
    }
  } finally {
    await browser.close()
  }

  // Only the examples that exist, in their order.
  const ordered = Object.fromEntries(EVENT_EXAMPLES.flatMap((example) => (manifest[example.slug] ? [[example.slug, manifest[example.slug]]] : [])))
  writeFileSync(MANIFEST, `${JSON.stringify(ordered, null, 2)}\n`)
  if (problems) process.exitCode = 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
