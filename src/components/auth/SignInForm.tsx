'use client'

import { type FC, useState } from 'react'
import { Alert, Button, Divider, Form, Input } from 'antd'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@store/auth/store'
import { type GoogleErrorCode } from '@constants/auth'
import { ERROR_CODES } from '@constants/errors'
import { RETURN_TO_QUERY, ROUTES } from '@constants/routes'
import { processError } from '@helpers/error'
import { ErrorAlert } from '@components/ui/ErrorAlert'
import { GoogleButton } from './GoogleButton'
import { useAuthRedirect } from './useAuthRedirect'
import { VerificationNotice } from './VerificationNotice'

type Values = { email: string; password: string }

type Props = {
  returnTo?: string
  googleError?: GoogleErrorCode
  /** Arrived from a successful email verification, which signs nobody in. */
  verified?: boolean
}

export const SignInForm: FC<Props> = ({ returnTo, googleError, verified }) => {
  const t = useTranslations('Auth')
  const tCommon = useTranslations('Common')
  const login = useAuthStore.use.login()
  const isPending = useAuthStore.use.isPending()
  const [error, setError] = useState<unknown>(null)
  /** The address of an account that exists but has not opened its verification link. */
  const [unverified, setUnverified] = useState<string | null>(null)
  useAuthRedirect(returnTo)
  const query = returnTo ? `?${RETURN_TO_QUERY}=${encodeURIComponent(returnTo)}` : ''

  const onFinish = async (values: Values) => {
    setError(null)
    setUnverified(null)
    try {
      await login(values)
    } catch (failure) {
      if (processError(failure).code === ERROR_CODES.emailNotVerified) setUnverified(values.email)
      else setError(failure)
    }
  }

  return (
    <div className='flex flex-col gap-4'>
      {verified && <Alert type='success' showIcon title={t('verifiedNotice')} />}
      {googleError && <Alert type='warning' showIcon title={t(`googleErrors.${googleError}`)} />}
      <GoogleButton returnTo={returnTo} />
      <Divider plain className='my-1 text-xs text-muted'>
        {tCommon('or')}
      </Divider>
      <Form<Values> layout='vertical' requiredMark={false} onFinish={onFinish} disabled={isPending}>
        <Form.Item
          name='email'
          label={t('email')}
          rules={[
            { required: true, message: t('required') },
            { type: 'email', message: t('invalidEmail') },
          ]}
        >
          <Input size='large' type='email' autoComplete='email' />
        </Form.Item>
        <Form.Item name='password' label={t('password')} rules={[{ required: true, message: t('required') }]}>
          <Input.Password size='large' autoComplete='current-password' />
        </Form.Item>
        <div className='-mt-2 mb-5 text-right'>
          <Link href={ROUTES.forgotPassword} className='text-sm text-muted'>
            {t('forgot')}
          </Link>
        </div>
        {Boolean(error) && <ErrorAlert error={error} className='mb-4' />}
        {unverified && (
          <div className='mb-4'>
            <VerificationNotice variant='unverified' email={unverified} returnTo={returnTo} />
          </div>
        )}
        <Button type='primary' htmlType='submit' size='large' block loading={isPending}>
          {t('submitSignIn')}
        </Button>
      </Form>
      <p className='m-0 text-center text-sm text-muted'>
        {t('noAccount')}{' '}
        <Link href={`${ROUTES.signUp}${query}`} className='font-semibold text-ink'>
          {t('signUpTitle')}
        </Link>
      </p>
    </div>
  )
}
