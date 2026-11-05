import type { User } from '@store/auth/types'
import type { APIResponse } from '@interfaces/api'
import { RETURN_TO_QUERY } from '@constants/routes'
import { getApiUrl } from '@helpers/url'
import { ENDPOINTS } from './endpoints'
import { processGetMeResponse, processRegisterResponse, processUserResponse } from './processors'
import type {
  DeleteMeAPI,
  ForgotPasswordAPI,
  GetMeAPI,
  LoginAPI,
  LogoutAPI,
  RegisterAPI,
  RegisterResult,
  ResendVerificationAPI,
  ResetPasswordAPI,
  SendPasswordLinkAPI,
  UpdateMeAPI,
  VerifyEmailAPI,
} from './types'
import { axiosInstance } from '../axiosInstance'

export const getMeAPI: GetMeAPI['api'] = async () => {
  const { data } = await axiosInstance.get<APIResponse<User | null>>(ENDPOINTS.me)
  return processGetMeResponse(data)
}

export const registerAPI: RegisterAPI['api'] = async (payload) => {
  const { data } = await axiosInstance.post<APIResponse<RegisterResult>>(ENDPOINTS.register, payload)
  return processRegisterResponse(data)
}

export const loginAPI: LoginAPI['api'] = async (payload) => {
  const { data } = await axiosInstance.post<APIResponse<User>>(ENDPOINTS.login, payload)
  return processUserResponse(data)
}

export const logoutAPI: LogoutAPI['api'] = async () => {
  await axiosInstance.post(ENDPOINTS.logout)
}

export const updateMeAPI: UpdateMeAPI['api'] = async (payload) => {
  const { data } = await axiosInstance.patch<APIResponse<User>>(ENDPOINTS.updateMe, payload)
  return processUserResponse(data)
}

export const deleteMeAPI: DeleteMeAPI['api'] = async () => {
  await axiosInstance.delete(ENDPOINTS.deleteMe)
}

/** Emails the signed-in account a link to set a new password. */
export const sendPasswordLinkAPI: SendPasswordLinkAPI['api'] = async () => {
  await axiosInstance.post(ENDPOINTS.passwordLink)
}

export const forgotPasswordAPI: ForgotPasswordAPI['api'] = async (payload) => {
  await axiosInstance.post(ENDPOINTS.forgotPassword, payload)
}

export const resetPasswordAPI: ResetPasswordAPI['api'] = async (payload) => {
  const { data } = await axiosInstance.post<APIResponse<User>>(ENDPOINTS.resetPassword, payload)
  return processUserResponse(data)
}

/** Opens the emailed link: activates the account and signs it in. */
export const verifyEmailAPI: VerifyEmailAPI['api'] = async (payload) => {
  await axiosInstance.post(ENDPOINTS.verifyEmail, payload)
}

export const resendVerificationAPI: ResendVerificationAPI['api'] = async (payload) => {
  await axiosInstance.post(ENDPOINTS.resendVerification, payload)
}

/** A top-level navigation, not an XHR: Google's consent screen cannot run in a request. */
export const googleSignInUrl = (returnTo?: string): string => {
  const url = new URL(`${getApiUrl()}${ENDPOINTS.google}`)
  if (returnTo) url.searchParams.set(RETURN_TO_QUERY, returnTo)
  return url.toString()
}
