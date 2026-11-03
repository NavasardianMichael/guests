'use client'

import { type FC, useState } from 'react'
import { Alert, Button } from 'antd'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { verifyEmailAPI } from '@api/auth/main'
import { VERIFIED_QUERY } from '@constants/auth'
import { RETURN_TO_QUERY, ROUTES } from '@constants/routes'
import { isSafeReturnPath } from '@helpers/url'
import { ErrorAlert } from '@components/ui/ErrorAlert'

/**
 * The emailed link lands here and waits for a click: link scanners in mail clients open every
 * URL in a message, and a single-use token spent on page load would be spent by them.
 * Verifying only activates the account; the user then signs in on the sign-in page, which
 * says the address is confirmed and keeps the `returnTo`.
 */
export const VerifyEmailForm: FC<{ token: string | undefined; returnTo?: string }> = ({ token, returnTo }) => {
  const t = useTranslations('Auth')
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)

  if (!token) {
    return (
      <Alert
        type='warning'
        showIcon
        title={t('verifyMissing')}
        action={<Link href={ROUTES.signIn}>{t('signInTitle')}</Link>}
      />
    )
  }

  const verify = async () => {
    setError(null)
    setPending(true)
    try {
      await verifyEmailAPI({ token })
      const query = new URLSearchParams({ [VERIFIED_QUERY]: '1' })
      if (isSafeReturnPath(returnTo)) query.set(RETURN_TO_QUERY, returnTo)
      router.replace(`${ROUTES.signIn}?${query.toString()}`)
    } catch (failure) {
      setError(failure)
      setPending(false)
    }
  }

  return (
    <div className='flex flex-col gap-4'>
      {Boolean(error) && <ErrorAlert error={error} />}
      <Button type='primary' size='large' block loading={pending} onClick={verify}>
        {t('verifySubmit')}
      </Button>
      {Boolean(error) && (
        <p className='m-0 text-center text-sm'>
          <Link href={ROUTES.signIn} className='font-semibold text-ink'>
            {t('signInTitle')}
          </Link>
        </p>
      )}
    </div>
  )
}
