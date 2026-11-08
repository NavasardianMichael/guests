'use client'

import { type FC, useTransition } from 'react'
import { GlobalOutlined } from '@ant-design/icons'
import { Select } from 'antd'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_NAMES, LOCALES } from '@constants/app'
import { cn } from '@helpers/cn'

/** A year: the choice outlives the session, like any language preference. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

type Props = {
  /** On the wrapper, not the Select: antd's unlayered `display` would beat `hidden`/`lg:block`. */
  className?: string
  size?: 'small' | 'middle'
}

/** Sets the interface language (`src/i18n/request.ts` reads the cookie) and re-renders the page in it. */
export const LanguageSwitcher: FC<Props> = ({ className, size = 'middle' }) => {
  const locale = useLocale()
  const router = useRouter()
  const t = useTranslations('Nav')
  const [pending, startTransition] = useTransition()

  return (
    <span className={cn('flex', className)}>
      <Select
        className='min-w-28'
        size={size}
        value={isLocale(locale) ? locale : DEFAULT_LOCALE}
        loading={pending}
        aria-label={t('language')}
        prefix={<GlobalOutlined className='text-muted' />}
        variant='borderless'
        popupMatchSelectWidth={false}
        options={LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] }))}
        onChange={(next) => {
          document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`
          startTransition(() => router.refresh())
        }}
      />
    </span>
  )
}
