'use client'

import type { FC } from 'react'
import { useTranslations } from 'next-intl'
import { GA_ID } from '@helpers/analytics'
import { openConsentBanner } from '@helpers/consent'

/** The footer's way back to the analytics banner, to change the answer. Nothing without a GA tag. */
export const ConsentSettingsLink: FC<{ className?: string }> = ({ className }) => {
  const t = useTranslations('Consent')
  if (!GA_ID) return null
  return (
    <button type='button' className={className} onClick={openConsentBanner}>
      {t('settings')}
    </button>
  )
}
