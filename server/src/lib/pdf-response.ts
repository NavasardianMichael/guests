import type { Response } from 'express'
import { fail } from './api-response.js'
import { ERROR_CODE } from './error-codes.js'
import { clientAddress } from './request.js'
import { PdfAbortedError, PdfBusyError, pdfFileName, type RenderDocument, renderListPdf } from '../services/pdf.js'

/**
 * Prints one address may have printing or waiting at once. There is one Chrome
 * (`MAX_CONCURRENT`) and a short queue: without this, one client could fill the queue with
 * heavy drafts and every other buyer would get "too many prints".
 */
const MAX_PRINTS_PER_ADDRESS = 2
const printsByAddress = new Map<string, number>()

/**
 * Prints the document and answers it as an attachment: every PDF route ends here. Rate
 * limiting stays with the caller, which knows whose budget the print spends.
 *
 * `onSent` runs once the whole file is handed to the connection (`finish`) — not when the
 * print fails or the client hangs up first (`close` alone) — with the file's size.
 */
export const sendPdf = async (
  res: Response,
  logId: string,
  doc: RenderDocument,
  onSent?: (bytes: number) => Promise<void>
): Promise<void> => {
  const address = clientAddress(res.req)
  const mine = printsByAddress.get(address) ?? 0
  if (mine >= MAX_PRINTS_PER_ADDRESS) {
    res.setHeader('Retry-After', '30')
    return fail(res, 'Too many prints right now', ERROR_CODE.rateLimited, 429)
  }
  printsByAddress.set(address, mine + 1)

  // A client that hangs up before its turn takes its place in the queue with it.
  const gone = new AbortController()
  const onClose = () => {
    if (!res.writableFinished) gone.abort()
  }
  res.once('close', onClose)

  let pdf: Uint8Array
  try {
    pdf = await renderListPdf(doc, gone.signal)
  } catch (error) {
    if (error instanceof PdfAbortedError) return
    if (error instanceof PdfBusyError) {
      res.setHeader('Retry-After', '30')
      return fail(res, 'Too many prints right now', ERROR_CODE.rateLimited, 503)
    }
    console.error(`[pdf] render of ${logId} failed`, error)
    return fail(res, 'PDF could not be generated', ERROR_CODE.pdfFailed, 500)
  } finally {
    const left = (printsByAddress.get(address) ?? 1) - 1
    if (left > 0) printsByAddress.set(address, left)
    else printsByAddress.delete(address)
  }
  res.off('close', onClose)

  const fileName = pdfFileName(doc.title)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Cache-Control', 'private, no-store')
  // RFC 6266: an ASCII fallback plus the UTF-8 name, which keeps Armenian titles intact.
  res.setHeader('Content-Disposition', `attachment; filename="guests.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`)
  if (onSent) {
    res.once('finish', () => {
      onSent(pdf.byteLength).catch((error: unknown) => console.error(`[pdf] recording the download of ${logId} failed`, error))
    })
  }
  res.end(Buffer.from(pdf))
}
