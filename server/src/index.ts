import { createApp } from './app.js'
import { config, isAiConfigured, isPaymentConfigured } from './config.js'
import { scheduleRetention } from './services/retentionSweep.js'

import './load-env.js'

// The API process: one Express app, listening on the configured host and port.
const app = createApp()

app.listen(config.port, config.host, () => {
  console.log(`Guests API listening on http://${config.host}:${config.port}`)
  if (!isAiConfigured()) console.warn('[ai] GEMINI_API_KEY is empty — photo import answers 503')
  if (!isPaymentConfigured()) console.warn(`[payments] ${config.payments.gateway} is not configured — checkout answers 503`)
})

// Accounts and guest lists unused for a year are removed (services/retentionSweep.ts).
scheduleRetention()
