import type { User } from '@store/auth/types'
import type { Endpoint } from '@interfaces/api'

export type GetMeAPI = Endpoint<{ payload: void; response: User | null; processed: User | null }>

/** `returnTo` is carried through the verification link. */
export type RegisterPayload = { fullName: string; email: string; password: string; returnTo?: string }
/** No session yet: the account waits for its emailed link. `email` is where that link went. */
export type RegisterResult = { email: string }
export type RegisterAPI = Endpoint<{ payload: RegisterPayload; response: RegisterResult; processed: RegisterResult }>

export type LoginPayload = { email: string; password: string }
export type LoginAPI = Endpoint<{ payload: LoginPayload; response: User; processed: User }>

export type LogoutAPI = Endpoint<{ payload: void; response: null; processed: void }>

export type UpdateMePayload = { fullName: string }
export type UpdateMeAPI = Endpoint<{ payload: UpdateMePayload; response: User; processed: User }>

export type DeleteMeAPI = Endpoint<{ payload: void; response: null; processed: void }>

export type SendPasswordLinkAPI = Endpoint<{ payload: void; response: null; processed: void }>

export type ForgotPasswordPayload = { email: string }
export type ForgotPasswordAPI = Endpoint<{ payload: ForgotPasswordPayload; response: null; processed: void }>

export type ResetPasswordPayload = { token: string; password: string }
export type ResetPasswordAPI = Endpoint<{ payload: ResetPasswordPayload; response: User; processed: User }>

export type VerifyEmailPayload = { token: string }
export type VerifyEmailAPI = Endpoint<{ payload: VerifyEmailPayload; response: null; processed: void }>

export type ResendVerificationPayload = { email: string; returnTo?: string }
export type ResendVerificationAPI = Endpoint<{ payload: ResendVerificationPayload; response: null; processed: void }>
