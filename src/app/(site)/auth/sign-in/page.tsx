import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { isGoogleError, VERIFIED_QUERY } from '@constants/auth'
import { RETURN_TO_QUERY } from '@constants/routes'
import { privateMetadata } from '@helpers/metadata'
import { AuthCard } from '@components/auth/AuthCard'
import { SignInForm } from '@components/auth/SignInForm'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth')
  return privateMetadata(t('metaSignIn'))
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function SignInPage({ searchParams }: Props) {
  const t = await getTranslations('Auth')
  const query = await searchParams
  const returnTo = typeof query[RETURN_TO_QUERY] === 'string' ? query[RETURN_TO_QUERY] : undefined
  return (
    <AuthCard title={t('signInTitle')} subtitle={t('signInSubtitle')}>
      <SignInForm
        returnTo={returnTo}
        googleError={isGoogleError(query.error) ? query.error : undefined}
        verified={query[VERIFIED_QUERY] === '1'}
      />
    </AuthCard>
  )
}
