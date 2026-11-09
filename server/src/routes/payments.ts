import { type Request, type Response, Router } from 'express'
import { config } from '../config.js'
import { escapeHtml } from '../lib/mail.js'
import { prisma } from '../lib/prisma.js'
import { buildWebUrl, PAYMENT_RESULT_PATH } from '../lib/return-path.js'
import { asyncHandler } from '../middleware/error.js'
import { isGatewayId } from '../services/gateways/index.js'
import { decideMockPayment, readMockPayment } from '../services/gateways/mock.js'
import { settlePayment } from '../services/payments.js'

/**
 * The buyer's return trip from a gateway, and the mock gateway's page. Top-level browser
 * navigations, so they answer with redirects and HTML rather than the JSON envelope, and
 * need no session: the payment is identified by the gateway's id and settled only from the
 * gateway's own record (`settlePayment`), never from the query string.
 */
export const paymentsRouter = Router()

const toResult = (res: Response, query: Record<string, string>): void =>
  res.redirect(buildWebUrl(config.corsOrigin, PAYMENT_RESULT_PATH, query))

/** A query value by name, whatever its case: the bank's spelling of its own names varies (`resposneCode`). */
const queryParam = (req: Request, name: string): string => {
  const key = Object.keys(req.query).find((candidate) => candidate.toLowerCase() === name.toLowerCase())
  const value = key ? req.query[key] : undefined
  return typeof value === 'string' ? value : ''
}

/**
 * Ameria sends `paymentID` and echoes `opaque` (our `Payment.id`); the mock sends both too.
 * The ID is matched case-insensitively (InitPayment answers it in upper case), and `opaque`
 * finds the row when it does not match. Either only picks the row: it is settled from the
 * gateway's record of the ID we stored. A return we cannot place shows "pending" — not
 * "failed", which tells the buyer nothing was charged — and is logged for diagnosis.
 */
paymentsRouter.get(
  '/return/:gateway',
  asyncHandler(async (req, res) => {
    const gateway = req.params.gateway
    if (!isGatewayId(gateway)) return toResult(res, { status: 'failed' })
    const paymentId = queryParam(req, 'paymentID')
    const opaque = queryParam(req, 'opaque')

    const payment =
      (paymentId
        ? await prisma.payment.findFirst({ where: { gateway, gatewayPaymentId: { equals: paymentId, mode: 'insensitive' } } })
        : null) ?? (opaque ? await prisma.payment.findFirst({ where: { gateway, id: opaque } }) : null)
    if (!payment) {
      console.warn(`[payments] unmatched ${gateway} return: ${JSON.stringify(req.query)}`)
      return toResult(res, { status: 'pending' })
    }

    let status: string = payment.status
    try {
      status = await settlePayment(payment)
    } catch (error) {
      console.error(`[payments] settle on return failed for ${payment.id}`, error instanceof Error ? error.message : error)
    }
    toResult(res, { status, payment: payment.id, ...(payment.listId ? { list: payment.listId } : {}) })
  })
)

const mockAvailable = (): boolean => config.payments.gateway === 'mock' && config.nodeEnv !== 'production'

const mockPage = (id: string, amount: number): string => `<!doctype html>
<html lang="hy"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Փորձնական վճարում</title>
<style>
body{font-family:system-ui,sans-serif;background:#f4f1ec;display:grid;place-items:center;min-height:100vh;margin:0}
main{background:#fff;padding:32px;border-radius:16px;box-shadow:0 10px 40px #0002;max-width:380px;text-align:center}
a{display:block;margin-top:12px;padding:12px;border-radius:10px;text-decoration:none;font-weight:600}
.pay{background:#1d2340;color:#fff}.decline{background:#eee;color:#333}
small{color:#888}
</style></head><body><main>
<h1>Փորձնական բանկ</h1>
<p>Սա մշակման ռեժիմի կեղծ վճարման էջ է։ Իրական գումար չի գանձվում։</p>
<p><strong>${amount.toLocaleString('hy-AM')} դրամ</strong></p>
<a class="pay" href="/payments/mock/${escapeHtml(id)}/approve">Վճարել</a>
<a class="decline" href="/payments/mock/${escapeHtml(id)}/decline">Մերժել</a>
<p><small>PAYMENT_GATEWAY=mock</small></p>
</main></body></html>`

paymentsRouter.get('/mock/:id', (req: Request, res: Response) => {
  const payment = mockAvailable() ? readMockPayment(String(req.params.id)) : undefined
  if (!payment) return res.status(404).send('Not found')
  res.type('html').send(mockPage(String(req.params.id), payment.amount))
})

paymentsRouter.get('/mock/:id/:decision', (req: Request, res: Response) => {
  const decision = req.params.decision
  if (!mockAvailable() || (decision !== 'approve' && decision !== 'decline')) return res.status(404).send('Not found')
  const backUrl = decideMockPayment(String(req.params.id), decision === 'approve')
  if (!backUrl) return res.status(404).send('Not found')
  res.redirect(backUrl)
})
