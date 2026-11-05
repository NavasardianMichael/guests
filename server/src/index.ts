import { createApp } from './app.js'
import { config, isAiConfigured } from './config.js'

import './load-env.js'

// The API process: one Express app, listening on the configured host and port.
const app = createApp()

app.listen(config.port, config.host, () => {
  console.log(`Guests API listening on http://${config.host}:${config.port}`)
  if (!isAiConfigured()) console.warn('[ai] GEMINI_API_KEY is empty — photo import answers 503')
})
