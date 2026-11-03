import type { LoginPayload, RegisterPayload, RegisterResult } from '@api/auth/types'
import type { StateCommonProps } from '@interfaces/store'

export type User = {
  id: string
  email: string
  fullName: string
  avatarUrl: string | null
  hasPassword: boolean
  hasGoogle: boolean
}

export type AuthState = {
  user: User | null
  /** False until the first `/identity/me` answers, so the UI does not flash "signed out". */
  isResolved: boolean
} & StateCommonProps

export type AuthActions = {
  setUser: (user: User | null) => void
  /** Never rejects: `null` for signed out. A network failure lands in `error`. */
  getMe: () => Promise<User | null>
  login: (payload: LoginPayload) => Promise<User>
  /** Does not sign in: the account is inactive until its emailed link is opened. */
  register: (payload: RegisterPayload) => Promise<RegisterResult>
  logout: () => Promise<void>
}
