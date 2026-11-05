'use client'

import type { FC } from 'react'
import { GoogleAnalytics } from '@next/third-parties/google'
import { usePathname } from 'next/navigation'
import { ROUTES } from '@constants/routes'
import { GA_ID } from '@helpers/analytics'

/**
 * The GA4 tag, loaded after the page is interactive. Never on `/render`: only the API's
 * headless Chrome opens it, and every print would count as a visit.
 */
export const Analytics: FC = () => {
  const pathname = usePathname()
  if (!GA_ID || pathname.startsWith(ROUTES.render)) return null
  return <GoogleAnalytics gaId={GA_ID} />
}
