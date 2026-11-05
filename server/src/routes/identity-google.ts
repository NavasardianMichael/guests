import { type NextFunction, type Request, type Response, Router } from 'express'
import { issueSession } from './identity.js'
import { config } from '../config.js'
import { ensureGoogleStrategy, GOOGLE_ERROR, GOOGLE_STRATEGY, type GoogleIdentity, passport } from '../lib/google-oauth.js'
import { prisma } from '../lib/prisma.js'
import { buildWebUrl, DASHBOARD_PATH, isSafeReturnPath, RETURN_TO_QUERY, SIGN_IN_PATH } from '../lib/return-path.js'
import { claimGuestLists } from '../services/guestLists.js'

/**
 * Google sign-in. Every branch ends in a top-level redirect back to the web app, so these
 * routes speak in redirects rather than the JSON envelope.
 *
 * `issueSession` comes from `identity.ts`, which mounts this router: a contained import
 * cycle, safe because it is only referenced inside handlers, never at module scope.
 */
export const googleRouter = Router()

googleRouter.use(passport.initialize())

const toSignIn = (res: Response, error: string): void =>
  res.redirect(buildWebUrl(config.corsOrigin, SIGN_IN_PATH, { error }))

googleRouter.get('/', (req: Request, res: Response, next: NextFunction) => {
  if (!ensureGoogleStrategy()) return toSignIn(res, GOOGLE_ERROR.unavailable)
  const returnTo = req.query[RETURN_TO_QUERY]
  const returnPath = isSafeReturnPath(returnTo) ? returnTo : null
  passport.authenticate(GOOGLE_STRATEGY, { session: false, state: { returnPath } } as object)(req, res, next)
})

/**
 * Find or create the account for a Google-verified address.
 *
 * Linking to an existing password account by email is safe only because Google verified the
 * address. If that account's own email was never verified, whoever registered it may not
 * own the inbox — they could have pre-registered the victim's address and be waiting for
 * them to sign in with Google. So the Google sign-in **claims** it: the unverified password
 * is cleared and `tokenVersion` bumped, which signs out any session the squatter holds.
 */
const upsertGoogleUser = async (identity: GoogleIdentity) => {
  const byGoogle = await prisma.user.findUnique({ where: { googleId: identity.googleId } })
  if (byGoogle) return byGoogle

  const byEmail = await prisma.user.findUnique({ where: { email: identity.email } })
  if (byEmail) {
    const claim = !byEmail.emailVerifiedAt
    return prisma.user.update({
      where: { id: byEmail.id },
      data: {
        googleId: identity.googleId,
        emailVerifiedAt: new Date(),
        avatarUrl: byEmail.avatarUrl ?? identity.avatarUrl,
        ...(claim ? { passwordHash: null, tokenVersion: { increment: 1 } } : {}),
      },
    })
  }

  return prisma.user.create({
    data: {
      email: identity.email,
      fullName: identity.fullName,
      googleId: identity.googleId,
      avatarUrl: identity.avatarUrl,
      emailVerifiedAt: new Date(),
    },
  })
}

googleRouter.get('/callback', (req: Request, res: Response, next: NextFunction) => {
  if (!ensureGoogleStrategy()) return toSignIn(res, GOOGLE_ERROR.unavailable)

  passport.authenticate(
    GOOGLE_STRATEGY,
    { session: false },
    (error: unknown, identity: GoogleIdentity | false, info?: { message?: string }) => {
      if (error) {
        console.error('[google] callback failed', error instanceof Error ? error.message : error)
        return toSignIn(res, GOOGLE_ERROR.failed)
      }
      if (!identity) {
        const denied = typeof req.query.error === 'string'
        return toSignIn(res, denied ? GOOGLE_ERROR.denied : (info?.message ?? GOOGLE_ERROR.failed))
      }

      upsertGoogleUser(identity)
        .then(async (user) => {
          issueSession(res, user)
          await claimGuestLists(req, res, user.id)
          const returnPath = req.oauthFlow?.returnPath
          res.redirect(buildWebUrl(config.corsOrigin, isSafeReturnPath(returnPath) ? returnPath : DASHBOARD_PATH))
        })
        .catch((upsertError: unknown) => {
          console.error('[google] account upsert failed', upsertError)
          toSignIn(res, GOOGLE_ERROR.failed)
        })
    }
  )(req, res, next)
})
