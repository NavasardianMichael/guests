/**
 * What the API answers for a failure no route raised on purpose — anything that reaches
 * `errorHandler` other than an `HttpError`.
 *
 * Import-free on purpose, like `lib/rateLimit.ts`: this is the part of the error path a
 * unit test can reach (`tests/unit/server/errorResponse.spec.ts`). So library errors are
 * recognised by their `name` rather than by `instanceof`, which would pull Prisma and
 * multer in.
 *
 * Production messages stay generic — they are English, and the client shows translated
 * copy chosen by the status instead. Outside production each generic message carries the
 * original error's message, which is what "show the original error in development" means
 * for a failure the client could otherwise only report as "Internal server error".
 */
export type ErrorResponse = { status: number; code: number; message: string }

type ErrorLike = {
  name?: unknown
  code?: unknown
  type?: unknown
  status?: unknown
  statusCode?: unknown
  expose?: unknown
  message?: unknown
}

/** body-parser's `type`s for the failures a client causes. */
const BODY_PARSER_MESSAGES: Record<string, string> = {
  'entity.parse.failed': 'Malformed JSON body',
  'entity.too.large': 'Request body too large',
  'encoding.unsupported': 'Unsupported request encoding',
  'charset.unsupported': 'Unsupported request charset',
}

/** multer's codes for a part that is too big, as opposed to one that is malformed. */
const MULTER_TOO_LARGE = new Set(['LIMIT_FILE_SIZE', 'LIMIT_FIELD_VALUE'])

const clientErrorStatus = (error: ErrorLike): number | undefined => {
  const status = typeof error.status === 'number' ? error.status : error.statusCode
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined
}

export const resolveErrorResponse = (err: unknown, production: boolean): ErrorResponse => {
  const error = (err ?? {}) as ErrorLike
  const original = typeof error.message === 'string' ? error.message : String(err)
  const withDetail = (message: string): string => (production ? message : `${message}: ${original}`)

  // Too many gallery files, an unexpected field, a file over the size limit.
  if (error.name === 'MulterError') {
    const status = typeof error.code === 'string' && MULTER_TOO_LARGE.has(error.code) ? 413 : 400
    return { status, code: status, message: original }
  }

  if (error.name === 'PrismaClientKnownRequestError') {
    if (error.code === 'P2025') return { status: 404, code: 404, message: withDetail('Not found') }
    if (error.code === 'P2002') return { status: 409, code: 409, message: withDetail('Conflict') }
    // A foreign key the request named does not exist, or the row is still referenced.
    if (error.code === 'P2003') return { status: 409, code: 409, message: withDetail('Conflict') }
  }

  // An unvalidated body field reached Prisma as the wrong type. The request was wrong,
  // not the server.
  if (error.name === 'PrismaClientValidationError') {
    return { status: 400, code: 400, message: withDetail('Invalid request') }
  }

  // body-parser and every other `http-errors` producer: malformed JSON, a body over the
  // limit. These used to fall through to a 500, so a client error read as an outage.
  const clientStatus = clientErrorStatus(error)
  if (clientStatus) {
    const known = typeof error.type === 'string' ? BODY_PARSER_MESSAGES[error.type] : undefined
    return { status: clientStatus, code: clientStatus, message: known ?? withDetail('Bad request') }
  }

  return { status: 500, code: -1, message: withDetail('Internal server error') }
}
