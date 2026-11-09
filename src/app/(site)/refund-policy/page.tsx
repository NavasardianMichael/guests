import type { Metadata } from 'next'
import { REFUND } from '@constants/legal'
import { ROUTES } from '@constants/routes'
import { pageMetadata } from '@helpers/metadata'
import { LegalPage } from '@components/legal/LegalPage'

export const metadata: Metadata = pageMetadata({ title: REFUND.title, description: REFUND.description, path: ROUTES.refundPolicy })

export default function RefundPolicyPage() {
  return <LegalPage document={REFUND} />
}
