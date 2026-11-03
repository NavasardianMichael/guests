import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { RESET_TOKEN_QUERY } from '@constants/auth'
import { privateMetadata } from '@helpers/metadata'
import { AuthCard } from '@components/auth/AuthCard'
import { ResetPasswordForm } from '@components/auth/ResetPasswordForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth')
  return privateMetadata(t('resetTitle'))
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function ResetPasswordPage({ searchParams }: Props) {
  const t = await getTranslations('Auth')
  const token = (await searchParams)[RESET_TOKEN_QUERY]
  return (
    <AuthCard title={t('resetTitle')}>
      <ResetPasswordForm token={typeof token === 'string' ? token : undefined} />
    </AuthCard>
  )
}
