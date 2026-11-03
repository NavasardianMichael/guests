import puppeteer, { type Browser } from 'puppeteer'
import type { ListContent, ListDesign } from './listDocument.js'
import { config } from '../config.js'

/**
 * List -> PDF, by printing the web app's own `/render` page in headless Chrome. The PDF is
 * therefore the editor's sheet exactly: same layout engine, same CSS, same fonts — real,
 * selectable text with the fonts embedded, on paper of the sheet's own size.
 *
 * The document is handed to the page before any script runs (`evaluateOnNewDocument`), so
 * `/render` has no API of its own and no URL that could print someone else's list. Every
 * request the page makes outside `renderOrigin` is aborted.
 *
 * Every print launches its own browser and closes it, so between prints Chrome holds no
 * memory at all, and a crash or leak dies with the one print it happened in.
 * `MAX_CONCURRENT` caps the browsers alive at once, `MAX_WAITING` the queue behind them.
 */
/** `watermark` stamps the "made with" line on every page (`services/entitlement.ts`). */
export type RenderDocument = { title: string; content: ListContent; design: ListDesign; watermark: boolean; watermarkText?: string }

const MAX_CONCURRENT = 1
/** Beyond this many waiting, a print is refused (`PdfBusyError`) rather than queued. */
const MAX_WAITING = 8
const NAVIGATION_TIMEOUT_MS = 45_000

const launch = (): Promise<Browser> =>
  puppeteer.launch({
    headless: 'shell',
    // A PDF is drawn as vectors, never on a GPU: this only spares the GPU helper process.
    args: ['--disable-gpu', ...(config.puppeteerNoSandbox ? ['--no-sandbox', '--disable-setuid-sandbox'] : [])],
  })

let active = 0
const waiting: (() => void)[] = []

/** The print queue is full; try again shortly. */
export class PdfBusyError extends Error {}

const acquire = async (): Promise<void> => {
  if (active < MAX_CONCURRENT) {
    active += 1
    return
  }
  if (waiting.length >= MAX_WAITING) throw new PdfBusyError('PDF queue is full')
  await new Promise<void>((resolve) => waiting.push(resolve))
  active += 1
}

const release = (): void => {
  active -= 1
  waiting.shift()?.()
}

export const renderListPdf = async (doc: RenderDocument): Promise<Uint8Array> => {
  await acquire()
  let browser: Browser | null = null

  try {
    browser = await launch()
    const page = await browser.newPage()
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      const url = request.url()
      if (url.startsWith(`${config.renderOrigin}/`) || url.startsWith('data:')) void request.continue()
      else void request.abort()
    })

    await page.evaluateOnNewDocument((injected) => {
      ;(window as unknown as { __SHEET_RENDER__: unknown }).__SHEET_RENDER__ = injected
    }, doc)

    await page.goto(`${config.renderOrigin}/render`, { waitUntil: 'networkidle0', timeout: NAVIGATION_TIMEOUT_MS })
    await page.waitForSelector('[data-sheet-ready="true"]', { timeout: NAVIGATION_TIMEOUT_MS })
    await page.evaluate(() => globalThis.document.fonts.ready.then(() => undefined))

    // The page sets `@page { size }` to the sheet's own paper; Chrome honours it with this.
    return await page.pdf({ printBackground: true, preferCSSPageSize: true })
  } finally {
    await browser?.close().catch(() => undefined)
    release()
  }
}

/** A filesystem- and header-safe file name; Armenian and Cyrillic letters are kept. */
export const pdfFileName = (title: string): string => {
  const base = title
    .replace(/[\\/:*?"<>|\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
  return `${base || 'guests'}.pdf`
}
