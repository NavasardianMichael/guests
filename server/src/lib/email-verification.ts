import { escapeHtml, type MailResult, sendAccountMail } from './mail.js'
import { prisma } from './prisma.js'
import { buildWebUrl, EMAIL_VERIFY_PATH, EMAIL_VERIFY_QUERY, isSafeReturnPath, RETURN_TO_QUERY } from './return-path.js'
import { hashUrlToken, mintUrlToken } from './token.js'
import { config } from '../config.js'

/** A new link replaces the previous one: only the latest email in the inbox works. */
export const issueEmailVerifyToken = async (userId: string): Promise<string> => {
  const token = mintUrlToken()
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerifyTokenHash: hashUrlToken(token),
      emailVerifyExpiresAt: new Date(Date.now() + config.emailVerifyTtlMs),
    },
  })
  return token
}

/** `returnTo` rides along, so a sign-up started from the editor lands back there once verified. */
export const buildEmailVerifyUrl = (token: string, returnTo?: unknown): string =>
  buildWebUrl(config.corsOrigin, EMAIL_VERIFY_PATH, {
    [EMAIL_VERIFY_QUERY]: token,
    ...(isSafeReturnPath(returnTo) ? { [RETURN_TO_QUERY]: returnTo } : {}),
  })

const SUBJECT = 'Հաստատեք Ձեր էլ. փոստը — Իմ հյուրերը'

const HOURS = Math.round(config.emailVerifyTtlMs / (60 * 60 * 1000))

const LEAD = 'Բարի գալուստ «Իմ հյուրերը»։ Հաշիվն ակտիվացնելու համար հաստատեք Ձեր էլ. փոստը՝'

const FOOTER =
  `Հղումը գործում է ${HOURS} ժամ։ Եթե Դուք այս հասցեով հաշիվ չեք ստեղծել, անտեսեք այս ` +
  'նամակը․ առանց հաստատման հաշիվն ակտիվ չի դառնա։'

export const sendEmailVerifyEmail = (to: string, url: string): Promise<MailResult> =>
  sendAccountMail('Email verification', {
    to,
    subject: SUBJECT,
    text: `${LEAD}\n\n${url}\n\n${FOOTER}`,
    html: `<p>${LEAD}</p><p><a href="${escapeHtml(url)}">Հաստատել էլ. փոստը</a></p><p>${FOOTER}</p>`,
  })

/** Issue a fresh link and mail it. */
export const sendVerificationLink = async (
  user: { id: string; email: string },
  returnTo?: unknown
): Promise<MailResult> => {
  const token = await issueEmailVerifyToken(user.id)
  return sendEmailVerifyEmail(user.email, buildEmailVerifyUrl(token, returnTo))
}
