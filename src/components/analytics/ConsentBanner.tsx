'use client'

import { type FC, useSyncExternalStore } from 'react'
import { CloseOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ROUTES } from '@constants/routes'
import { isConsentBannerOpen, saveConsent, subscribeConsentBanner } from '@helpers/consent'

/**
 * Asks once whether Google Analytics may set its cookies — only where an opt-in is needed
 * (`helpers/consent.ts`); elsewhere they are on from the start. Until the visitor answers,
 * analytics runs cookieless. Closing it counts as accepting, and the text says so. Comes back
 * from "Cookie settings" in the footer. Not a modal: the page stays usable while it is open.
 *
 * Mounted by the site layout only — not over the editor, whose phone bottom bar sits where the
 * banner would, nor on `/render`. Visitors reach the editor through the site, and until they
 * answer the default (denied) holds everywhere.
 */
export const ConsentBanner: FC = () => {
  const t = useTranslations('Consent')
  const tCommon = useTranslations('Common')
  // Closed in the server render: the answer lives in the browser.
  const open = useSyncExternalStore(subscribeConsentBanner, isConsentBannerOpen, () => false)

  if (!open) return null

  return (
    <section aria-label={t('label')} className='fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]'>
      <div className='relative mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl bg-surface p-4 pe-12 shadow-xl ring-1 ring-line sm:flex-row sm:items-center sm:gap-4'>
        <p className='m-0 text-sm leading-relaxed text-text'>
          {t('text')}{' '}
          <Link href={ROUTES.privacy} className='font-semibold text-ink underline underline-offset-2'>
            {t('privacy')}
          </Link>
        </p>
        <div className='flex shrink-0 gap-2 sm:ml-auto'>
          <Button className='flex-1 sm:flex-none' onClick={() => saveConsent('denied')}>
            {t('decline')}
          </Button>
          <Button type='primary' className='flex-1 sm:flex-none' onClick={() => saveConsent('granted')}>
            {t('accept')}
          </Button>
        </div>
        {/* Last in the tab order; closing counts as accepting, as the text says. */}
        <Button
          type='text'
          size='small'
          className='text-muted'
          style={{ position: 'absolute', insetInlineEnd: 8, top: 8 }}
          icon={<CloseOutlined />}
          aria-label={tCommon('close')}
          onClick={() => saveConsent('granted')}
        />
      </div>
    </section>
  )
}
