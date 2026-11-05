import type { Metadata } from 'next'
import { PRIVACY } from '@constants/legal'
import { ROUTES } from '@constants/routes'
import { pageMetadata } from '@helpers/metadata'
import { LegalPage } from '@components/legal/LegalPage'

export const metadata: Metadata = pageMetadata({ title: PRIVACY.title, description: PRIVACY.description, path: ROUTES.privacy })

export default function PrivacyPage() {
  return <LegalPage document={PRIVACY} />
}
