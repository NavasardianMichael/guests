'use client'

import type { FC, ReactNode } from 'react'
import Link, { useLinkStatus } from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@helpers/cn'

type Props = { href: string; className?: string; children: ReactNode }

/**
 * A template card's link. Prefetched on intent (hover, touch), not on sight: a grid of cards
 * prefetching in the viewport fetches ~1MB of template pages while the page is hydrating,
 * and a click made then waits behind them.
 */
export const TemplateCardLink: FC<Props> = ({ href, className, children }) => {
  const router = useRouter()
  const prefetch = (): void => router.prefetch(href)
  return (
    <Link href={href} prefetch={false} onMouseEnter={prefetch} onTouchStart={prefetch} className={className}>
      {children}
    </Link>
  )
}

/**
 * Covers the card's preview while its page is on the way. Fades in late, so a prefetched page
 * that opens at once never flashes it. Must sit inside a `TemplateCardLink`.
 */
export const TemplateCardPending: FC = () => {
  const { pending } = useLinkStatus()
  const t = useTranslations('Common')
  if (!pending) return null
  return (
    <div
      role='status'
      className={cn(
        'animate-fade-in-late absolute inset-0 z-10 grid place-content-center justify-items-center gap-3',
        'bg-surface/70 text-sm font-semibold text-ink backdrop-blur-[2px]',
      )}
    >
      <span className='size-9 animate-spin rounded-full border-[3px] border-line border-t-ink' aria-hidden='true' />
      {t('loading')}
    </div>
  )
}
