import type { FC } from 'react'
import Link from 'next/link'
import { APP_NAME } from '@constants/app'
import { ROUTES } from '@constants/routes'
import { cn } from '@helpers/cn'
import { BrandMark } from './BrandMark'

/** The mark beside the wordmark. */
export const BrandLogo: FC<{ className?: string }> = ({ className }) => (
  <Link href={ROUTES.home} className={cn('flex min-w-0 items-center gap-2 no-underline', className)} aria-label={APP_NAME}>
    <BrandMark className='size-8 shrink-0' />
    <span className='truncate font-display text-lg font-extrabold tracking-tight text-ink sm:text-xl'>{APP_NAME}</span>
  </Link>
)
