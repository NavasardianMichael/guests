import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { RETURN_TO_QUERY } from '@constants/routes'
import { privateMetadata } from '@helpers/metadata'
import { AuthCard } from '@components/auth/AuthCard'
import { SignUpForm } from '@components/auth/SignUpForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth')
  return privateMetadata(t('metaSignUp'))
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function SignUpPage({ searchParams }: Props) {
  const t = await getTranslations('Auth')
  const query = await searchParams
  const returnTo = typeof query[RETURN_TO_QUERY] === 'string' ? query[RETURN_TO_QUERY] : undefined
  return (
    <AuthCard title={t('signUpTitle')} subtitle={t('signUpSubtitle')}>
      <SignUpForm returnTo={returnTo} />
    </AuthCard>
  )
}
