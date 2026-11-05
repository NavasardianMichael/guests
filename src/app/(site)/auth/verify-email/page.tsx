import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { VERIFY_TOKEN_QUERY } from '@constants/auth'
import { RETURN_TO_QUERY } from '@constants/routes'
import { privateMetadata } from '@helpers/metadata'
import { AuthCard } from '@components/auth/AuthCard'
import { VerifyEmailForm } from '@components/auth/VerifyEmailForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth')
  return privateMetadata(t('verifyTitle'))
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function VerifyEmailPage({ searchParams }: Props) {
  const t = await getTranslations('Auth')
  const query = await searchParams
  const token = query[VERIFY_TOKEN_QUERY]
  const returnTo = query[RETURN_TO_QUERY]
  return (
    <AuthCard title={t('verifyTitle')} subtitle={t('verifySubtitle')}>
      <VerifyEmailForm
        token={typeof token === 'string' ? token : undefined}
        returnTo={typeof returnTo === 'string' ? returnTo : undefined}
      />
    </AuthCard>
  )
}
