import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { privateMetadata } from '@helpers/metadata'
import { AuthCard } from '@components/auth/AuthCard'
import { ForgotPasswordForm } from '@components/auth/ForgotPasswordForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth')
  return privateMetadata(t('forgotTitle'))
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations('Auth')
  return (
    <AuthCard title={t('forgotTitle')} subtitle={t('forgotSubtitle')}>
      <ForgotPasswordForm />
    </AuthCard>
  )
}
