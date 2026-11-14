import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { config, isAiConfigured, isGoogleOAuthConfigured, isPaymentConfigured } from './config.js'
import { fail, ok } from './lib/api-response.js'
import { prisma } from './lib/prisma.js'
import { optionalAuth } from './middleware/auth.js'
import { requireSameOrigin } from './middleware/csrf.js'
import { asyncHandler, errorHandler } from './middleware/error.js'
import { aiRouter } from './routes/ai.js'
import { contactRouter } from './routes/contact.js'
import { identityRouter } from './routes/identity.js'
import { listsRouter } from './routes/lists.js'
import { paymentsRouter } from './routes/payments.js'
import { pdfRouter } from './routes/pdf.js'
import { purchasesRouter } from './routes/purchases.js'
import { PASS_PRICE_AMD } from './services/pricing.js'

export function createApp() {
  const app = express()

  // Exactly one hop (nginx). Never `true`, which would trust a client-supplied
  // X-Forwarded-For and collapse every per-IP rate limit.
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  // Responses are JSON or a PDF attachment: no browser should sniff them into something else.
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    next()
  })

  // `maxAge`: the web is another origin, so every JSON write is preflighted; without it Chrome
  // forgets a preflight after 5 s and autosave pays an extra round trip on almost every save.
  app.use(cors({ origin: config.corsOrigin, credentials: true, maxAge: 7200 }))
  app.use(cookieParser())

  // A photo is a bigger body than anything else here: it has its own parser and limit, so it
  // is mounted before the app-wide one would refuse it.
  app.use('/ai', requireSameOrigin, optionalAuth, aiRouter)

  // A list of two thousand guests, with dragged positions, is a few hundred KB of JSON.
  app.use(express.json({ limit: '2mb' }))
  app.use(requireSameOrigin)
  app.use(optionalAuth)

  app.get(
    '/health',
    asyncHandler(async (_req, res) => {
      // Down when the database is: the deploy's health wait and the uptime monitor rely on it.
      try {
        await prisma.$queryRaw`SELECT 1`
      } catch {
        return fail(res, 'Database unavailable', 503, 503)
      }
      // What the web shows depends on these; one source of truth.
      ok(res, {
        status: 'ok',
        google: isGoogleOAuthConfigured(),
        ai: isAiConfigured(),
        payments: isPaymentConfigured(),
        priceAmd: PASS_PRICE_AMD,
      })
    })
  )

  app.use('/identity', identityRouter)
  app.use('/lists', listsRouter)
  app.use('/contact', contactRouter)
  app.use('/pdf', pdfRouter)
  app.use('/purchases', purchasesRouter)
  // The bank's return trip and the mock bank's page: top-level GET navigations.
  app.use('/payments', paymentsRouter)

  app.use((_req, res) => fail(res, 'Not found', 404, 404))
  app.use(errorHandler)

  return app
}
