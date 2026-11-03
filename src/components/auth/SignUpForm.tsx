'use client'

import { type FC, useState } from 'react'
import { Button, Divider, Form, Input } from 'antd'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@store/auth/store'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@constants/auth'
import { RETURN_TO_QUERY, ROUTES } from '@constants/routes'
import { ErrorAlert } from '@components/ui/ErrorAlert'
import { GoogleButton } from './GoogleButton'
import { confirmPasswordRules, passwordRules } from './passwordRules'
import { useAuthRedirect } from './useAuthRedirect'
import { VerificationNotice } from './VerificationNotice'

type Values = { fullName: string; email: string; password: string; confirmPassword: string }

export const SignUpForm: FC<{ returnTo?: string }> = ({ returnTo }) => {
  const t = useTranslations('Auth')
  const tCommon = useTranslations('Common')
  const register = useAuthStore.use.register()
  const isPending = useAuthStore.use.isPending()
  const [error, setError] = useState<unknown>(null)
  /** Where the verification link went; set once the account exists. */
  const [sentTo, setSentTo] = useState<string | null>(null)
  useAuthRedirect(returnTo)
  const query = returnTo ? `?${RETURN_TO_QUERY}=${encodeURIComponent(returnTo)}` : ''

  const onFinish = async ({ fullName, email, password }: Values) => {
    setError(null)
    try {
      const { email: address } = await register({ fullName: fullName.trim(), email, password, returnTo })
      setSentTo(address)
    } catch (failure) {
      setError(failure)
    }
  }

  if (sentTo) {
    return (
      <div className='flex flex-col gap-5'>
        <VerificationNotice variant='sent' email={sentTo} returnTo={returnTo} />
        <p className='m-0 text-center text-sm text-muted'>
          {t('haveAccount')}{' '}
          <Link href={`${ROUTES.signIn}${query}`} className='font-semibold text-ink'>
            {t('signInTitle')}
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      <GoogleButton returnTo={returnTo} />
      <Divider plain className='my-1 text-xs text-muted'>
        {tCommon('or')}
      </Divider>
      <Form<Values> layout='vertical' requiredMark={false} onFinish={onFinish} disabled={isPending}>
        <Form.Item name='fullName' label={t('fullName')} rules={[{ required: true, whitespace: true, message: t('required') }]}>
          <Input size='large' autoComplete='name' maxLength={100} />
        </Form.Item>
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
        <Form.Item
          name='password'
          label={t('password')}
          extra={t('passwordHint', { min: PASSWORD_MIN_LENGTH })}
          rules={passwordRules(t('required'), t('weakPassword', { min: PASSWORD_MIN_LENGTH }))}
        >
          <Input.Password size='large' autoComplete='new-password' maxLength={PASSWORD_MAX_LENGTH} />
        </Form.Item>
        <Form.Item
          name='confirmPassword'
          label={t('confirmPassword')}
          dependencies={['password']}
          rules={confirmPasswordRules('password', t('required'), t('passwordMismatch'))}
        >
          <Input.Password size='large' autoComplete='new-password' maxLength={PASSWORD_MAX_LENGTH} />
        </Form.Item>
        {Boolean(error) && <ErrorAlert error={error} className='mb-4' />}
        <Button type='primary' htmlType='submit' size='large' block loading={isPending}>
          {t('submitSignUp')}
        </Button>
      </Form>
      <p className='m-0 text-center text-xs leading-relaxed text-muted'>
        {t.rich('terms', {
          terms: (chunks) => (
            <Link href={ROUTES.terms} className='underline'>
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link href={ROUTES.privacy} className='underline'>
              {chunks}
            </Link>
          ),
        })}
      </p>
      <p className='m-0 text-center text-sm text-muted'>
        {t('haveAccount')}{' '}
        <Link href={`${ROUTES.signIn}${query}`} className='font-semibold text-ink'>
          {t('signInTitle')}
        </Link>
      </p>
    </div>
  )
}
