import type { Response } from 'express'
import { fail } from './api-response.js'
import { ERROR_CODE } from './error-codes.js'
import { PdfBusyError, pdfFileName, type RenderDocument,renderListPdf } from '../services/pdf.js'

/**
 * Prints the document and answers it as an attachment: every PDF route ends here. Rate
 * limiting stays with the caller, which knows whose budget the print spends.
 */
export const sendPdf = async (res: Response, logId: string, doc: RenderDocument): Promise<void> => {
  let pdf: Uint8Array
  try {
    pdf = await renderListPdf(doc)
  } catch (error) {
    if (error instanceof PdfBusyError) {
      res.setHeader('Retry-After', '30')
      return fail(res, 'Too many prints right now', ERROR_CODE.rateLimited, 503)
    }
    console.error(`[pdf] render of ${logId} failed`, error)
    return fail(res, 'PDF could not be generated', ERROR_CODE.pdfFailed, 500)
  }

  const fileName = pdfFileName(doc.title)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Cache-Control', 'private, no-store')
  // RFC 6266: an ASCII fallback plus the UTF-8 name, which keeps Armenian titles intact.
  res.setHeader('Content-Disposition', `attachment; filename="guests.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`)
  res.end(Buffer.from(pdf))
}
