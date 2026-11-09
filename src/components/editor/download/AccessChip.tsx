'use client'

import type { FC } from 'react'
import { ClockCircleOutlined } from '@ant-design/icons'
import { useFormatter, useTranslations } from 'next-intl'
import { useEditorUiStore } from '@store/editorUi/store'
import { useAccessUntil, useNow } from '@hooks/useAccess'
import { accessDaysLeft, isAccessActive, PASS_DAYS } from '@constants/pricing'
import { cn } from '@helpers/cn'
import { HintTooltip } from '@components/ui/HintTooltip'

/** From this many days left the chip turns to a warning, so the end of the pass is no surprise. */
const ENDING_DAYS = 3

/**
 * The editor's reminder of a running access pass (docs/PAYMENTS.md): the days left, and on hover
 * until when and what stays after. A click opens the checkout to add days on top, which says
 * the same in full. Nothing while no pass runs — Download opens the checkout then. Hidden on
 * phones, where the top bar has no room; the Template step says it there.
 */
export const AccessChip: FC = () => {
  const t = useTranslations('Editor.access')
  const format = useFormatter()
  const until = useAccessUntil()
  const now = useNow()
  const setCheckoutOpen = useEditorUiStore.use.setCheckoutOpen()
  if (until === undefined || !isAccessActive(until, now)) return null

  const days = accessDaysLeft(until, now)
  const ending = days <= ENDING_DAYS
  const date = format.dateTime(new Date(until!), { dateStyle: 'long' })

  return (
    <span className='hidden md:flex'>
      <HintTooltip title={t('tooltip', { date, passDays: PASS_DAYS })}>
        <button
          type='button'
          onClick={() => setCheckoutOpen(true)}
          aria-label={`${t('label')}: ${t('left', { days })}`}
          className={cn(
            'flex cursor-pointer items-center gap-1.5 rounded-full border-0 px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition',
            ending ? 'bg-accent-soft text-accent-strong hover:bg-accent/25' : 'bg-success/10 text-success hover:bg-success/20'
          )}
        >
          <ClockCircleOutlined aria-hidden='true' />
          {t('left', { days })}
        </button>
      </HintTooltip>
    </span>
  )
}
