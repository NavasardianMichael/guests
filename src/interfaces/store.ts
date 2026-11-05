import { AppError } from './api'

export type StateCommonProps = {
  isPending: boolean
  error: AppError | null
}
