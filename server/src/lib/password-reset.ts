import { escapeHtml, type MailResult, sendAccountMail } from './mail.js'
import { prisma } from './prisma.js'
import { buildWebUrl, FORGOT_PASSWORD_PATH, PASSWORD_RESET_PATH, PASSWORD_RESET_QUERY } from './return-path.js'
import { hashUrlToken, mintUrlToken } from './token.js'
import { config } from '../config.js'

export const issuePasswordResetToken = async (userId: string): Promise<string> => {
  const token = mintUrlToken()
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordResetTokenHash: hashUrlToken(token),
      passwordResetExpiresAt: new Date(Date.now() + config.passwordResetTtlMs),
    },
  })
  return token
}

export const buildPasswordResetUrl = (token: string): string =>
  buildWebUrl(config.corsOrigin, PASSWORD_RESET_PATH, { [PASSWORD_RESET_QUERY]: token })

const SUBJECT = 'Գաղտնաբառի վերականգնում — Իմ հյուրերը'

const text = (url: string): string =>
  `Ինչ-որ մեկը խնդրել է վերականգնել Ձեր «Իմ հյուրերը» հաշվի գաղտնաբառը։\n\n${url}\n\n` +
  'Հղումը գործում է մեկ ժամ և կարող է օգտագործվել մեկ անգամ։ Եթե դա Դուք չեք եղել, ' +
  'անտեսեք այս նամակը․ Ձեր գաղտնաբառը չի փոխվել։'

const html = (url: string): string =>
  '<p>Ինչ-որ մեկը խնդրել է վերականգնել Ձեր «Իմ հյուրերը» հաշվի գաղտնաբառը։</p>' +
  `<p><a href="${escapeHtml(url)}">Ընտրել նոր գաղտնաբառ</a></p>` +
  '<p>Հղումը գործում է մեկ ժամ և կարող է օգտագործվել մեկ անգամ։ Եթե դա Դուք չեք եղել, ' +
  'անտեսեք այս նամակը․ Ձեր գաղտնաբառը չի փոխվել։</p>'

export const sendPasswordResetEmail = (to: string, url: string): Promise<MailResult> =>
  sendAccountMail('Password reset', { to, subject: SUBJECT, text: text(url), html: html(url) })

const CHANGED_SUBJECT = 'Գաղտնաբառը փոխվել է — Իմ հյուրերը'

/**
 * The notice after a password is set or changed, so a takeover through a stolen inbox
 * session or reset link does not go unseen. Its link starts a fresh reset.
 */
export const sendPasswordChangedEmail = (to: string): Promise<MailResult> => {
  const url = buildWebUrl(config.corsOrigin, FORGOT_PASSWORD_PATH)
  const lead =
    'Ձեր «Իմ հյուրերը» հաշվի գաղտնաբառը հենց նոր փոխվել է, և մյուս բոլոր սարքերից ' +
    'հաշվից դուրս եք եկել։'
  const warning = 'Եթե դա Դուք չեք եղել, անմիջապես վերականգնեք գաղտնաբառը՝'
  return sendAccountMail('Password changed notice', {
    to,
    subject: CHANGED_SUBJECT,
    text: `${lead}\n\n${warning}\n\n${url}`,
    html: `<p>${lead}</p><p>${warning} <a href="${escapeHtml(url)}">վերականգնել գաղտնաբառը</a></p>`,
  })
}
