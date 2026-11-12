import type { Request } from 'express'
import { prisma } from '../lib/prisma.js'

/**
 * A PDF sent in full (`PdfDownload`, docs/PAYMENTS.md). Under an access pass (`paymentId`) it
 * is delivery evidence, recorded against the payment it was served under; a saved list's free
 * print (`paymentId` null) is recorded as a use, which keeps the list from the retention sweep
 * (services/retention.ts). Given to `sendPdf` as its `onSent`.
 */
export const recordDownload =
  (req: Request, input: { listId: string | null; templateId: string; paymentId: string | null }) =>
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
