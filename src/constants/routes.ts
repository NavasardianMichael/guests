import type { PrintKind, SheetShape } from '@store/lists/single/types'
import type { TemplateId } from './templates'

/**
 * Every path in the app. Server-built links (email verification, password reset, Google
 * errors, the payment result) are twins in `server/src/lib/return-path.ts`, pinned by `twins.spec.ts`.
 */
export const ROUTES = {
  home: '/',
  templates: '/templates',
  pricing: '/pricing',
  signIn: '/auth/sign-in',
  signUp: '/auth/sign-up',
  forgotPassword: '/auth/forgot-password',
  resetPassword: '/auth/reset-password',
  verifyEmail: '/auth/verify-email',
  dashboard: '/dashboard',
  account: '/account',
  editor: '/editor',
  editorNew: '/editor/new',
  render: '/render',
  terms: '/terms',
  privacy: '/privacy',
  refundPolicy: '/refund-policy',
  contact: '/contact',
  /** Where the bank's return trip lands. Twin: `PAYMENT_RESULT_PATH` on the server. */
  paymentResult: '/payment/result',
} as const

export const templatePath = (id: TemplateId): string => `${ROUTES.templates}/${id}`

export const editorPath = (listId: string): string => `${ROUTES.editor}/${listId}`

export const newListPath = (options: { template?: TemplateId; kind?: PrintKind; shape?: SheetShape } = {}): string => {
  const query = new URLSearchParams()
  if (options.template) query.set(TEMPLATE_QUERY, options.template)
  if (options.kind) query.set(KIND_QUERY, options.kind)
  if (options.shape && options.shape !== 'rectangle') query.set(SHAPE_QUERY, options.shape)
  const search = query.toString()
  return search ? `${ROUTES.editorNew}?${search}` : ROUTES.editorNew
}

/** Signed-in areas; `src/proxy.ts` sends a visitor without a session cookie to sign-in. */
export const PROTECTED_PREFIXES = [ROUTES.dashboard, ROUTES.account]

/** Query names shared across pages. */
export const RETURN_TO_QUERY = 'returnTo'
export const TEMPLATE_QUERY = 'template'
export const KIND_QUERY = 'kind'
export const SHAPE_QUERY = 'shape'
/** On the editor's URL: open the checkout at once (back from signing in to buy). */
export const CHECKOUT_QUERY = 'checkout'
