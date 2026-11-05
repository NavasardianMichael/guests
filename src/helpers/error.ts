import { isAxiosError } from 'axios'
import type { APIResponse, AppError } from '@interfaces/api'
import { ERROR_CODES, type ErrorKind, RETRYABLE_ERROR_KINDS } from '@constants/errors'

/**
 * What to show for a failure. Copy is chosen by **code** when the API sent one we have words
 * for, else by **kind** (from the status). The server's `message` is English and written for
 * developers: it is shown only in development, beside the Armenian copy, never instead of it.
 */
export type ClassifiedError = AppError & {
  kind: ErrorKind
  status?: number
  retryable: boolean
}

const KNOWN_CODES = new Set<number>(Object.values(ERROR_CODES))

const readEnvelope = (data: unknown): AppError | null => {
  const error = (data as Partial<APIResponse<unknown>> | null | undefined)?.error
  if (!error || typeof error !== 'object') return null
  const code = Number(error.code)
  return { code: Number.isFinite(code) ? code : -1, message: typeof error.message === 'string' ? error.message : '' }
}

const kindFromStatus = (status: number): ErrorKind => {
  if (status === 401) return 'unauthorized'
  if (status === 404) return 'notFound'
  if (status === 408) return 'timeout'
  if (status === 409) return 'conflict'
  if (status === 429) return 'rateLimited'
  if (status === 502 || status === 503 || status === 504) return 'unavailable'
  if (status >= 500) return 'server'
  if (status >= 400) return 'validation'
  return 'unknown'
}

/** The envelope's code and message, for branching on a code. */
export const processError = (e: unknown): AppError => {
  if (isAxiosError(e)) {
    const envelope = readEnvelope(e.response?.data)
    if (envelope) return envelope
  }
  return { code: -1, message: e instanceof Error ? e.message : String(e) }
}

export const classifyError = (e: unknown): ClassifiedError => {
  if (isAxiosError(e)) {
    const envelope = readEnvelope(e.response?.data)
    const status = e.response?.status
    let kind: ErrorKind
    if (status) kind = kindFromStatus(status)
    else if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') kind = 'timeout'
    else kind = typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'network'
    return {
      kind,
      status,
      code: envelope?.code ?? -1,
      message: envelope?.message || e.message,
      retryable: RETRYABLE_ERROR_KINDS.has(kind),
    }
  }
  return { kind: 'unknown', code: -1, message: e instanceof Error ? e.message : String(e), retryable: false }
}

/** The `Errors.*` key to translate: `codes.<code>` when known, else `kinds.<kind>`. */
export const errorCopyKey = (error: ClassifiedError): string =>
  KNOWN_CODES.has(error.code) ? `codes.${error.code}` : `kinds.${error.kind}`

export const isDevelopment = (): boolean => process.env.NODE_ENV !== 'production'
