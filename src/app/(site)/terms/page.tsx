import type { Metadata } from 'next'
import { TERMS } from '@constants/legal'
import { ROUTES } from '@constants/routes'
import { pageMetadata } from '@helpers/metadata'
import { LegalPage } from '@components/legal/LegalPage'

export const metadata: Metadata = pageMetadata({ title: TERMS.title, description: TERMS.description, path: ROUTES.terms })

export default function TermsPage() {
  return <LegalPage document={TERMS} />
}
