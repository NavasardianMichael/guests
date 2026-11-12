/**
 * Codes the API sends for failures with their own copy (`Errors.codes.<code>` in messages).
 * Twin: `server/src/lib/error-codes.ts`, pinned by `twins.spec.ts`.
 */
export const ERROR_CODES = {
  emailTaken: 4001,
  invalidCredentials: 4002,
  weakPassword: 4003,
  resetTokenInvalid: 4004,
  googleOnlyAccount: 4005,
  emailNotVerified: 4006,
  verifyTokenInvalid: 4007,
  listLimitReached: 4010,
  /** Starting a checkout: an earlier payment turned out to have gone through — access is running. */
  earlierPaymentSucceeded: 4020,
  listNotPaid: 4021,
  paymentsUnavailable: 4022,
  paymentInitFailed: 4023,
  pdfFailed: 4030,
  contactFailed: 4040,
  aiUnavailable: 4050,
  aiFailed: 4051,
  imageInvalid: 4052,
  /** Reading a photo needs a running access pass. */
  photoNeedsAccess: 4053,
  /** Every photo read of the running access (`PHOTO_READS_PER_PASS` per pass) is used. */
  photoLimitReached: 4054,
  rateLimited: 4290,
} as const

/** Every other failure is shown by kind (`Errors.kinds.<kind>`). */
export type ErrorKind =
  | 'network'
  | 'offline'
  | 'timeout'
  | 'unauthorized'
  | 'notFound'
  | 'conflict'
  | 'rateLimited'
  | 'unavailable'
  | 'server'
  | 'validation'
  | 'unknown'

export const RETRYABLE_ERROR_KINDS: ReadonlySet<ErrorKind> = new Set(['network', 'offline', 'timeout', 'unavailable', 'server'])
