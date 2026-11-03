import passport from 'passport'
import { type Profile, Strategy as GoogleStrategy } from 'passport-google-oauth20'
import type { StateStore } from 'passport-oauth2'
import { oauthStateStore } from './oauth-state.js'
import { isEmail, MAX_EMAIL_LENGTH } from './request.js'
import { config, isGoogleOAuthConfigured } from '../config.js'

/**
 * Google sign-in, server side: the authorization-code flow with PKCE, exchanged with the
 * client secret by this process. No Google script ever loads in the page, so there is no
 * ID token to verify: the profile comes straight from Google over TLS.
 *
 * `config.google.clientSecret` is read here and nowhere else, and never logged.
 */
export type GoogleIdentity = {
  googleId: string
  email: string
  fullName: string
  avatarUrl?: string
}

export const GOOGLE_STRATEGY = 'google'

/** `?error=` values the web sign-in page explains (`src/constants/auth.ts`). */
export const GOOGLE_ERROR = {
  unavailable: 'google_unavailable',
  denied: 'google_denied',
  failed: 'google_failed',
  emailUnverified: 'google_email_unverified',
} as const

const isVerifiedFlag = (value: unknown): boolean => value === true || value === 'true'

/** Google's `displayName`, else given + family, else the mailbox name. */
export const fullNameOf = (profile: Pick<Profile, 'displayName' | 'name'>, email: string): string => {
  const display = profile.displayName?.trim().replace(/\s+/g, ' ')
  if (display) return display.slice(0, 100)
  const parts = [profile.name?.givenName?.trim(), profile.name?.familyName?.trim()].filter(Boolean)
  if (parts.length) return parts.join(' ').slice(0, 100)
  return email.split('@')[0] || 'Օգտատեր'
}

/** Only a Google-verified address may sign in: it is what lets us link an existing account. */
export const readGoogleProfile = (profile: Profile): GoogleIdentity | null => {
  const googleId = profile.id?.trim()
  if (!googleId) return null

  const primary = profile.emails?.[0]
  const email = primary?.value?.trim().toLowerCase()
  if (!email || email.length > MAX_EMAIL_LENGTH || !isEmail(email)) return null
  if (!isVerifiedFlag(primary?.verified) && !isVerifiedFlag(profile._json?.email_verified)) return null

  const avatarUrl = profile.photos?.[0]?.value?.trim()
  return { googleId, email, fullName: fullNameOf(profile, email), avatarUrl: avatarUrl || undefined }
}

let registered = false

/** Registers the strategy on first use; false when Google is not configured. */
export const ensureGoogleStrategy = (): boolean => {
  if (!isGoogleOAuthConfigured()) return false
  if (registered) return true

  passport.use(
    GOOGLE_STRATEGY,
    new GoogleStrategy(
      {
        clientID: config.google.clientId,
        clientSecret: config.google.clientSecret,
        callbackURL: config.google.redirectUri,
        scope: ['profile', 'email'],
        store: oauthStateStore as unknown as StateStore,
        pkce: true,
      },
      (_accessToken, _refreshToken, profile, done) => {
        const identity = readGoogleProfile(profile)
        if (!identity) return done(null, false, { message: GOOGLE_ERROR.emailUnverified })
        return done(null, identity)
      }
    )
  )

  registered = true
  return true
}

export { default as passport } from 'passport'
