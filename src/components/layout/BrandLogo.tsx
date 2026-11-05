import type { FC } from 'react'
import Link from 'next/link'
import { APP_NAME } from '@constants/app'
import { ROUTES } from '@constants/routes'
import { cn } from '@helpers/cn'

/** A folded sheet with an apricot corner, beside the wordmark. */
export const BrandMark: FC<{ className?: string }> = ({ className }) => (
  <svg viewBox='0 0 32 32' className={cn('size-8', className)} aria-hidden='true'>
    <rect x='5' y='3' width='22' height='26' rx='4' className='fill-ink' />
    <path d='M19 3h4a4 4 0 0 1 4 4v4z' className='fill-accent' />
    <rect x='9' y='10' width='9' height='2.4' rx='1.2' className='fill-accent' />
    <rect x='9' y='15' width='14' height='1.8' rx='0.9' fill='white' opacity='0.85' />
    <rect x='9' y='19' width='12' height='1.8' rx='0.9' fill='white' opacity='0.6' />
    <rect x='9' y='23' width='13' height='1.8' rx='0.9' fill='white' opacity='0.6' />
  </svg>
)

export const BrandLogo: FC<{ className?: string }> = ({ className }) => (
  <Link href={ROUTES.home} className={cn('flex min-w-0 items-center gap-2 no-underline', className)} aria-label={APP_NAME}>
    <BrandMark className='shrink-0' />
    <span className='truncate font-display text-lg font-extrabold tracking-tight text-ink sm:text-xl'>{APP_NAME}</span>
  </Link>
)
