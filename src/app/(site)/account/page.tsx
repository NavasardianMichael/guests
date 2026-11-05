import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { privateMetadata } from '@helpers/metadata'
import { AccountClient } from '@components/account/AccountClient'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Account')
  return privateMetadata(t('metaTitle'))
}

export default function AccountPage() {
  return <AccountClient />
}
