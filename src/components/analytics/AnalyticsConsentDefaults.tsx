import type { FC } from 'react'
import { GA_ID } from '@helpers/analytics'
import { consentDefaultsScript } from '@helpers/consent'

/**
 * Consent Mode defaults (`helpers/consent.ts`), inline at the top of the body: parsed and run
 * before the GA tag (`Analytics`), which loads only once the page is interactive.
 */
export const AnalyticsConsentDefaults: FC = () =>
  GA_ID ? <script id='ga-consent-defaults' dangerouslySetInnerHTML={{ __html: consentDefaultsScript() }} /> : null
