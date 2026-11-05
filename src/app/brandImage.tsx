import type { ReactElement } from 'react'
import { BrandMark } from '@components/layout/BrandMark'
import { APRICOT, INK, MARK_GUEST } from '@styles/tokens'

/**
 * The brand mark for `next/og` (satori), which has no CSS variables or Tailwind: the same SVG
 * as the app's, given hex colours. Shared by the favicon, the Apple icon and the social card.
 */
export const brandMark = (size: number): ReactElement => (
  <BrandMark size={size} colors={{ tile: INK[900], sheet: '#ffffff', accent: APRICOT[500], rose: MARK_GUEST.rose, sage: MARK_GUEST.sage }} />
)
