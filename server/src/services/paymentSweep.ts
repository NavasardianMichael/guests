import { settleStalePayments } from './payments.js'

/**
 * Hourly: payments still pending after their bank page timed out are settled from the bank's
 * record (`settleStalePayments`). Without it a buyer who paid, lost the redirect and never came
 * back would stay charged with no access. Idempotent (settling is compare-and-set), so a
 * restart or a second instance running it is harmless.
 */
const SWEEP_EVERY_MS = 60 * 60 * 1000
/** Not at boot: a deploy's restart should not also be a burst of bank calls. */
const FIRST_SWEEP_MS = 5 * 60 * 1000

const sweep = async (): Promise<void> => {
  try {
    const { succeeded, failed, unresolved } = await settleStalePayments()
    if (succeeded) console.warn(`[payments] sweep: ${succeeded} payment(s) were paid with no redirect seen — settled now`)
    if (failed) console.info(`[payments] sweep: ${failed} abandoned payment(s) closed as failed`)
    if (unresolved) console.warn(`[payments] sweep: ${unresolved} payment(s) still unresolved — retried next hour`)
  } catch (error) {
    console.error('[payments] sweep failed', error instanceof Error ? error.message : error)
  }
}

let timers: NodeJS.Timeout[] = []

export const schedulePaymentSweep = (): void => {
  const first = setTimeout(() => {
    void sweep()
    timers.push(setInterval(() => void sweep(), SWEEP_EVERY_MS).unref())
  }, FIRST_SWEEP_MS).unref()
  timers.push(first)
}

/** Graceful shutdown: no new sweep starts. */
export const stopPaymentSweep = (): void => {
  for (const timer of timers) clearTimeout(timer)
  timers = []
}
