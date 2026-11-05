import type { FC, ReactElement } from 'react'
import { MARK_GUEST } from '@styles/tokens'

export type BrandMarkColors = { tile: string; sheet: string; accent: string; rose: string; sage: string }

/** In the app the mark follows the theme's variables; `next/og` images pass hex values. */
const THEME_COLORS: BrandMarkColors = {
  tile: 'var(--brand-ink)',
  sheet: 'white',
  accent: 'var(--brand-accent)',
  rose: MARK_GUEST.rose,
  sage: MARK_GUEST.sage,
}

/**
 * A guest from the shoulders up: a head over a half-disc, standing on `base`. A function, not
 * a component, so satori gets plain SVG elements.
 */
const guest = (cx: number, base: number, r: number, fill: string): ReactElement => {
  const shoulder = Math.round(r * 1.9 * 100) / 100
  return (
    <g fill={fill}>
      <circle cx={cx} cy={Math.round((base - r * 2.9) * 100) / 100} r={r} />
      <path d={`M${Math.round((cx - shoulder) * 100) / 100} ${base}a${shoulder} ${shoulder} 0 0 1 ${shoulder * 2} 0z`} />
    </g>
  )
}

type Props = { className?: string; size?: number; colors?: BrandMarkColors }

/**
 * Three guests, each painted a different colour, in front of a tilted sheet with an apricot
 * title stroke — the guests and the printed, decorated sheet the app makes of them.
 * Plain SVG attributes only (no classes), so `next/og` draws the very same mark for the
 * favicon, the Apple icon and the social card (`src/app/brandImage.tsx`).
 */
export const BrandMark: FC<Props> = ({ className, size, colors = THEME_COLORS }) => (
  <svg viewBox='0 0 32 32' width={size} height={size} className={className} aria-hidden='true'>
    <rect x='1.5' y='1.5' width='29' height='29' rx='8' fill={colors.tile} />
    <g transform='rotate(-8 16 13)'>
      <rect x='8' y='4.5' width='16' height='17' rx='2.2' fill={colors.sheet} />
      <path d='M10.6 9.2h9.6' stroke={colors.accent} strokeWidth='1.8' strokeLinecap='round' />
    </g>
    {guest(9.4, 27.5, 2.3, colors.rose)}
    {guest(22.6, 27.5, 2.3, colors.sage)}
    {guest(16, 28.5, 2.9, colors.accent)}
  </svg>
)
