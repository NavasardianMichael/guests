import { afterEach, describe, expect, it, vi } from 'vitest'
import { PdfBusyError, type RenderDocument,renderListPdf } from '../../../server/src/services/pdf'

/** A browser whose print finishes only when the test says so. */
const fakeBrowser = () => {
  let finish: (pdf: Uint8Array) => void = () => undefined
  let fail: (error: Error) => void = () => undefined
  const printed = new Promise<Uint8Array>((resolve, reject) => {
    finish = resolve
    fail = reject
  })
  const page = {
    setRequestInterception: async () => undefined,
    on: () => undefined,
    evaluateOnNewDocument: async () => undefined,
    goto: async () => undefined,
    waitForSelector: async () => undefined,
    evaluate: async () => undefined,
    pdf: () => printed,
  }
  return { browser: { newPage: async () => page, close: vi.fn(async () => undefined) }, finish, fail }
}

const { launch } = vi.hoisted(() => ({ launch: vi.fn() }))

// puppeteer is the server package's dependency; this is the ESM entry services/pdf.ts imports.
vi.mock('../../../server/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js', () => ({ default: { launch } }))

const doc = {} as RenderDocument

/** Queues the next launches; each print waits on its own `finish`/`fail`. */
const nextBrowsers = (count: number) => {
  const fakes = Array.from({ length: count }, fakeBrowser)
  for (const fake of fakes) launch.mockResolvedValueOnce(fake.browser)
  return fakes
}

afterEach(() => {
  launch.mockReset()
})

describe('renderListPdf', () => {
  it('prints on a fresh headless-shell browser and closes it', async () => {
    const [fake] = nextBrowsers(1)
    const pdf = renderListPdf(doc)
    await vi.waitFor(() => expect(launch).toHaveBeenCalledTimes(1))
    fake.finish(new Uint8Array([1]))

    await expect(pdf).resolves.toEqual(new Uint8Array([1]))
    expect(launch).toHaveBeenCalledWith(expect.objectContaining({ headless: 'shell' }))
    expect(launch.mock.calls[0][0].args).toContain('--disable-gpu')
    expect(fake.browser.close).toHaveBeenCalledTimes(1)
  })

  it('closes the browser when the print fails', async () => {
    const [fake] = nextBrowsers(1)
    const pdf = renderListPdf(doc)
    await vi.waitFor(() => expect(launch).toHaveBeenCalledTimes(1))
    fake.fail(new Error('render crashed'))

    await expect(pdf).rejects.toThrow('render crashed')
    expect(fake.browser.close).toHaveBeenCalledTimes(1)
  })

  it('keeps one browser alive at a time', async () => {
    const [first, second] = nextBrowsers(2)
    const pdfs = [renderListPdf(doc), renderListPdf(doc)]
    await vi.waitFor(() => expect(launch).toHaveBeenCalledTimes(1))

    first.finish(new Uint8Array())
    await vi.waitFor(() => expect(launch).toHaveBeenCalledTimes(2))
    expect(first.browser.close).toHaveBeenCalledTimes(1)

    second.finish(new Uint8Array())
    await Promise.all(pdfs)
  })

  it('refuses a print beyond the waiting cap', async () => {
    const fakes = nextBrowsers(9)
    const pdfs = fakes.map(() => renderListPdf(doc))
    await vi.waitFor(() => expect(launch).toHaveBeenCalledTimes(1))

    await expect(renderListPdf(doc)).rejects.toBeInstanceOf(PdfBusyError)

    for (const [index, fake] of fakes.entries()) {
      fake.finish(new Uint8Array())
      await vi.waitFor(() => expect(launch).toHaveBeenCalledTimes(Math.min(index + 2, fakes.length)))
    }
    await Promise.all(pdfs)
  })
})
