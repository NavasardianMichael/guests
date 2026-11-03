export const ENDPOINTS = {
  me: '/identity/me',
  register: '/identity/register',
  login: '/identity/login',
  logout: '/identity/logout',
  updateMe: '/identity/me',
  deleteMe: '/identity/me',
  passwordLink: '/identity/password/link',
  forgotPassword: '/identity/password/forgot',
  resetPassword: '/identity/password/reset',
  verifyEmail: '/identity/email/verify',
  resendVerification: '/identity/email/resend',
  google: '/identity/google',
} as const
