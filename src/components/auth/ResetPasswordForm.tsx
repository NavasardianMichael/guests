'use client'

import { type FC, useState } from 'react'
import { Alert, Button, Form, Input } from 'antd'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { resetPasswordAPI } from '@api/auth/main'
import { useAuthStore } from '@store/auth/store'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@constants/auth'
import { ROUTES } from '@constants/routes'
import { ErrorAlert } from '@components/ui/ErrorAlert'
import { confirmPasswordRules, passwordRules } from './passwordRules'

type Values = { password: string; confirmPassword: string }

/** A reset link signs the user in (the API sets a fresh session and signs out every other one). */
export const ResetPasswordForm: FC<{ token: string | undefined }> = ({ token }) => {
  const t = useTranslations('Auth')
  const router = useRouter()
  const setUser = useAuthStore.use.setUser()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)

  if (!token) {
    return (
      <Alert
        type='warning'
        showIcon
        title={t('resetMissing')}
        action={<Link href={ROUTES.forgotPassword}>{t('forgotSubmit')}</Link>}
      />
    )
  }

  const onFinish = async ({ password }: Values) => {
    setError(null)
    setPending(true)
    try {
      setUser(await resetPasswordAPI({ token, password }))
      router.replace(ROUTES.dashboard)
    } catch (failure) {
      setError(failure)
      setPending(false)
    }
  }

  return (
    <Form<Values> layout='vertical' requiredMark={false} onFinish={onFinish} disabled={pending}>
      <Form.Item
        name='password'
        label={t('newPassword')}
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
      <Button type='primary' htmlType='submit' size='large' block loading={pending} className='mt-2'>
        {t('resetSubmit')}
      </Button>
    </Form>
  )
}
