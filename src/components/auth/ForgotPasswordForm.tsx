'use client'

import { type FC, useState } from 'react'
import { Alert, Button, Form, Input } from 'antd'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { forgotPasswordAPI } from '@api/auth/main'
import { ROUTES } from '@constants/routes'
import { ErrorAlert } from '@components/ui/ErrorAlert'

export const ForgotPasswordForm: FC = () => {
  const t = useTranslations('Auth')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<unknown>(null)

  const onFinish = async ({ email }: { email: string }) => {
    setError(null)
    setState('sending')
    try {
      await forgotPasswordAPI({ email })
      setState('sent')
    } catch (failure) {
      setError(failure)
      setState('idle')
    }
  }

  if (state === 'sent') return <Alert type='success' showIcon title={t('forgotSent')} />

  return (
    <Form<{ email: string }> layout='vertical' requiredMark={false} onFinish={onFinish} disabled={state === 'sending'}>
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
      {Boolean(error) && <ErrorAlert error={error} className='mb-4' />}
      <Button type='primary' htmlType='submit' size='large' block loading={state === 'sending'}>
        {t('forgotSubmit')}
      </Button>
      <p className='mt-5 mb-0 text-center text-sm'>
        <Link href={ROUTES.signIn} className='text-muted'>
          {t('signInTitle')}
        </Link>
      </p>
    </Form>
  )
}
