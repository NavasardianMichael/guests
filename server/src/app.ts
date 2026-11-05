import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { config, isAiConfigured, isGoogleOAuthConfigured } from './config.js'
import { fail, ok } from './lib/api-response.js'
import { optionalAuth } from './middleware/auth.js'
import { requireSameOrigin } from './middleware/csrf.js'
import { errorHandler } from './middleware/error.js'
import { aiRouter } from './routes/ai.js'
import { contactRouter } from './routes/contact.js'
import { identityRouter } from './routes/identity.js'
import { listsRouter } from './routes/lists.js'
import { pdfRouter } from './routes/pdf.js'
import { billingEnabled } from './services/entitlement.js'
import { LIST_PRICE_AMD } from './services/pricing.js'

export function createApp() {
  const app = express()

  // Exactly one hop (nginx). Never `true`, which would trust a client-supplied
  // X-Forwarded-For and collapse every per-IP rate limit.
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(cors({ origin: config.corsOrigin, credentials: true }))
  app.use(cookieParser())

  // A photo is a bigger body than anything else here: it has its own parser and limit, so it
  // is mounted before the app-wide one would refuse it.
  app.use('/ai', requireSameOrigin, optionalAuth, aiRouter)

  // A list of two thousand guests, with dragged positions, is a few hundred KB of JSON.
  app.use(express.json({ limit: '2mb' }))
  app.use(requireSameOrigin)
  app.use(optionalAuth)

  app.get('/health', (_req, res) => {
    // What the web shows depends on these; one source of truth.
    ok(res, { status: 'ok', google: isGoogleOAuthConfigured(), ai: isAiConfigured(), billing: billingEnabled(), priceAmd: LIST_PRICE_AMD })
  })

  app.use('/identity', identityRouter)
  app.use('/lists', listsRouter)
  app.use('/contact', contactRouter)
  app.use('/pdf', pdfRouter)

  app.use((_req, res) => fail(res, 'Not found', 404, 404))
  app.use(errorHandler)

  return app
}
