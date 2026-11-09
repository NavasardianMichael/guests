'use client'

import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import type { SampleTexts } from '@helpers/listFactory'

/** The sample wedding's words in the interface's language (`Samples.*`), for client previews and new lists. */
export const useSampleTexts = (): SampleTexts => {
  const t = useTranslations('Samples')
  return useMemo(
    () => ({
      heading: t('heading'),
      subheading: t('subheading'),
      footer: t('footer'),
      table: (number: number) => t('table', { number }),
      venue: { stage: t('venue.stage'), dancefloor: t('venue.dancefloor'), entrance: t('venue.entrance') },
    }),
    [t]
  )
}
