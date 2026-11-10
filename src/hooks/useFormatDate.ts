'use client'

import { useCallback } from 'react'
import { useLocale } from 'next-intl'
import { type DateOptions, formatDate } from '@helpers/date'

/** `formatDate` in the interface language the reader picked. */
export const useFormatDate = (): ((value: string | number | Date, options?: DateOptions) => string) => {
  const locale = useLocale()
  return useCallback((value, options) => formatDate(value, locale, options), [locale])
}
