'use client'

import type { FC } from 'react'
import { Tooltip, type TooltipProps } from 'antd'
import { HOVER_QUERY, useMediaQuery } from '@hooks/useMediaQuery'

/**
 * A tooltip for mouse users only. On a touch screen a tap counts as a hover, so an antd
 * Tooltip opens on every tap of its button and stays over the page until the next tap
 * elsewhere. Buttons that carry one still need their own `aria-label`.
 */
export const HintTooltip: FC<TooltipProps> = (props) => {
  const canHover = useMediaQuery(HOVER_QUERY, true)
  return <Tooltip {...props} open={canHover ? props.open : false} />
}
