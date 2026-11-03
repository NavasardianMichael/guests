'use client'

import type { FC } from 'react'
import { ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useTranslations } from 'next-intl'
import { stepZoom } from '@helpers/canvasZoom'

type Props = {
  zoom: number | null
  fitZoom: number
  onZoomChange: (zoom: number | null) => void
}

/** Phones and tablets: zoom buttons floating over the canvas (the desktop has them in the top bar). */
export const CanvasZoomControl: FC<Props> = ({ zoom, fitZoom, onZoomChange }) => {
  const t = useTranslations('Editor')
  const current = zoom ?? fitZoom
  return (
    <div className='pointer-events-none absolute right-3 bottom-3 z-10 lg:hidden'>
      <div className='pointer-events-auto flex items-center gap-0.5 rounded-full bg-surface p-1 shadow-lg ring-1 ring-black/5'>
        <Button type='text' shape='circle' icon={<ZoomOutOutlined />} onClick={() => onZoomChange(stepZoom(current, -1))} aria-label={t('zoomOut')} />
        <button
          type='button'
          className='h-8 w-12 cursor-pointer rounded-full border-0 bg-transparent text-xs font-medium tabular-nums'
          aria-label={t('fit')}
          onClick={() => onZoomChange(null)}
        >
          {Math.round(current * 100)}%
        </button>
        <Button type='text' shape='circle' icon={<ZoomInOutlined />} onClick={() => onZoomChange(stepZoom(current, 1))} aria-label={t('zoomIn')} />
      </div>
    </div>
  )
}
