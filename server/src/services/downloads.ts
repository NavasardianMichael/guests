import type { Request } from 'express'
import { prisma } from '../lib/prisma.js'

/**
 * Delivery evidence (`PdfDownload`, docs/PAYMENTS.md): a PDF printed under an access pass,
 * sent in full, recorded against the payment it was served under. Given to `sendPdf` as its `onSent`.
 */
export const recordDownload =
  (req: Request, input: { listId: string | null; templateId: string; paymentId: string }) =>
  async (bytes: number): Promise<void> => {
    await prisma.pdfDownload.create({
      data: {
        ...input,
        bytes,
        ip: req.ip ?? null,
        userAgent: req.get('user-agent')?.slice(0, 500) ?? null,
      },
    })
  }
