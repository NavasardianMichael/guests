import type { Response } from 'express'

export type AppError = {
  code: number
  message: string
}

export type ApiEnvelope<T> = {
  value: T | null
  error: AppError | null
}

export function ok<T>(res: Response, value: T, status = 200): void {
  const body: ApiEnvelope<T> = { value, error: null }
  res.status(status).json(body)
}

export function fail(res: Response, message: string, code = -1, status = 400): void {
  const body: ApiEnvelope<null> = { value: null, error: { code, message } }
  res.status(status).json(body)
}
