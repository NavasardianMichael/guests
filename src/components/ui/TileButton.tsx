'use client'

import type { ButtonHTMLAttributes, FC, ReactNode } from 'react'
import { cn } from '@helpers/cn'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  icon?: ReactNode
  /** A second, smaller line under the label (a size, a hint). */
  caption?: ReactNode
  /** Selected: an option among several (`aria-pressed` / `aria-checked` is the caller's). */
  active?: boolean
}

/**
 * A square-ish choice with an icon over its label: import sources, print kinds, paper sizes.
 * Native, not antd's `Button`: antd fixes a button's height and forbids wrapping in unlayered
 * CSS, so a long Armenian label in a narrow column would overflow its own border. This one
 * grows with its text, wraps it, and keeps a 44px touch target.
 */
export const TileButton: FC<Props> = ({ icon, caption, active, className, children, ...rest }) => (
  <button
    type='button'
    {...rest}
    className={cn(
      'flex min-h-11 min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-center',
      'text-xs leading-tight font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      'disabled:cursor-not-allowed disabled:opacity-50',
      active
        ? 'border-ink bg-ink text-white shadow-sm'
        : 'border-line bg-surface text-ink hover:border-ink/40 hover:bg-canvas active:bg-canvas',
      className
    )}
  >
    {icon && (
      <span className='text-base leading-none' aria-hidden='true'>
        {icon}
      </span>
    )}
    <span className='w-full [overflow-wrap:anywhere] hyphens-auto'>{children}</span>
    {caption && (
      <span className={cn('w-full text-[10px] font-normal', active ? 'text-white/70' : 'text-muted')}>{caption}</span>
    )}
  </button>
)
