'use client'

import { type FC, type ReactNode, useState } from 'react'
import { Alert, Button } from 'antd'
import { useTranslations } from 'next-intl'
import { resendVerificationAPI } from '@api/auth/main'
import { ErrorAlert } from '@components/ui/ErrorAlert'

type Props = {
  email: string
  returnTo?: string
  /** `sent` right after sign-up; `unverified` when a sign-in is refused for it. */
  variant: 'sent' | 'unverified'
}

/** An account waiting for its emailed link, with a way to have the link sent again. */
export const VerificationNotice: FC<Props> = ({ email, returnTo, variant }) => {
  const t = useTranslations('Auth')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<unknown>(null)

  const resend = async () => {
    setError(null)
    setState('sending')
    try {
      await resendVerificationAPI({ email, returnTo })
      setState('sent')
    } catch (failure) {
      setError(failure)
      setState('idle')
    }
  }

  const bold = (chunks: ReactNode) => <strong className='break-all'>{chunks}</strong>

  return (
    <div className='flex flex-col gap-4'>
      <Alert
        type={variant === 'sent' ? 'success' : 'warning'}
        showIcon
        title={t(variant === 'sent' ? 'checkInboxTitle' : 'unverifiedTitle')}
        description={t.rich(variant === 'sent' ? 'checkInboxBody' : 'unverifiedBody', { email, b: bold })}
      />
      <p className='m-0 text-sm text-muted'>{t('checkInboxSpam')}</p>
      {state === 'sent' && <Alert type='info' showIcon title={t('resendSent')} />}
      {Boolean(error) && <ErrorAlert error={error} />}
      <Button size='large' block loading={state === 'sending'} onClick={resend}>
        {t('resendVerification')}
      </Button>
    </div>
  )
}
