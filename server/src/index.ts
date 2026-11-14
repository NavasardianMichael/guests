import { createApp } from './app.js'
import { config, isAiConfigured, isPaymentConfigured } from './config.js'
import { prisma } from './lib/prisma.js'
import { schedulePaymentSweep, stopPaymentSweep } from './services/paymentSweep.js'
import { scheduleRetention, stopRetention } from './services/retentionSweep.js'

import './load-env.js'

/**
 * systemd's TimeoutStopSec is 30 s (deployment/guests-seating-board-api.service); whatever is
 * still running after this is cut. A print waiting in the queue can take this long.
 */
const SHUTDOWN_GRACE_MS = 25_000

// The API process: one Express app, listening on the configured host and port.
const app = createApp()

const server = app.listen(config.port, config.host, () => {
  console.log(`Guests API listening on http://${config.host}:${config.port}`)
  if (!isAiConfigured()) console.warn('[ai] GEMINI_API_KEY is empty — photo import answers 503')
  if (!isPaymentConfigured()) console.warn(`[payments] ${config.payments.gateway} is not configured — checkout answers 503`)
  const { gateway, ameria } = config.payments
  if (config.nodeEnv === 'production' && gateway === 'ameria' && ameria.testMode) {
    // Anyone with the bank's published test cards gets real passes while this is on.
    console.warn(`[payments] Ameria TEST terminal in production${ameria.amountOverride ? `, charging ${ameria.amountOverride} AMD` : ''} — set AMERIA_TEST_MODE="false" once the bank signs off`)
  }
})

// Accounts and guest lists unused for a year are removed (services/retentionSweep.ts).
scheduleRetention()
// Payments left pending after their bank page timed out are settled (services/paymentSweep.ts).
schedulePaymentSweep()

/**
 * A deploy restarts the service: stop taking connections, let the requests in flight finish —
 * a PDF being printed, an autosave, a bank return settling a payment — then let go of the
 * database.
 */
let shuttingDown = false
const shutdown = (signal: NodeJS.Signals): void => {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[api] ${signal}: finishing in-flight requests`)
  setTimeout(() => {
    console.warn(`[api] still busy after ${SHUTDOWN_GRACE_MS / 1000} s, exiting`)
    process.exit(1)
  }, SHUTDOWN_GRACE_MS).unref()

  stopRetention()
  stopPaymentSweep()
  server.close(() => {
    prisma
      .$disconnect()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        console.error('[api] shutdown', error)
        process.exit(1)
      })
  })
  server.closeIdleConnections()
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
