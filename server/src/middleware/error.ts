import type { NextFunction, Request, Response } from 'express'
import { config } from '../config.js'
import { fail } from '../lib/api-response.js'
import { resolveErrorResponse } from '../lib/error-response.js'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = -1
  ) {
    super(message)
  }
}

/**
 * The one 4-arg handler. An `HttpError` is answered as thrown; everything else — Prisma,
 * multer, body-parser, a bug — is mapped by `lib/error-response.ts`, which keeps
 * production generic and adds the original message everywhere else.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  // A route that already answered and then threw cannot be answered again; writing a
  // second response here would throw inside the error handler itself. Express's default
  // handler closes the connection instead.
  if (res.headersSent) return next(err)

  if (err instanceof HttpError) {
    return fail(res, err.message, err.code, err.status)
  }

  const response = resolveErrorResponse(err, config.nodeEnv === 'production')
  if (response.status >= 500) console.error(err)
  return fail(res, response.message, response.code, response.status)
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next)
  }
}
