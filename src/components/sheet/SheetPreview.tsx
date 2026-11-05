'use client'

import { type FC, useEffect, useMemo, useRef, useState } from 'react'
import type { ListDocument } from '@store/lists/single/types'
import { useSheetLayout } from '@hooks/useSheetLayout'
import { cn } from '@helpers/cn'
import { SheetDocument } from './SheetDocument'

export const MM_TO_PX = 96 / 25.4

type Props = {
  doc: ListDocument
  className?: string
}

/**
 * A sheet's first page scaled to its container's width — template cards, dashboard
 * thumbnails, the landing page. `inert`: the scaled copy is a picture, the page around it
 * says what it shows.
 */
export const SheetPreview: FC<Props> = ({ doc, className }) => {
  const frameRef = useRef<HTMLDivElement>(null)
  const [frameWidth, setFrameWidth] = useState(0)
  const layout = useSheetLayout(doc)
  const pageWidthPx = layout.width * MM_TO_PX
  const pageHeightPx = layout.height * MM_TO_PX
  const firstPage = useMemo(() => ({ ...layout, pages: 1 }), [layout])
  // The same element across renders, so measuring the frame never redraws the sheet.
  const sheet = useMemo(() => <SheetDocument design={doc.design} layout={firstPage} />, [doc.design, firstPage])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const observer = new ResizeObserver(() => setFrameWidth(frame.clientWidth))
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  const scale = frameWidth / pageWidthPx

  return (
    <div
      ref={frameRef}
      className={cn('relative w-full overflow-hidden', className)}
      style={{ aspectRatio: `${layout.width} / ${layout.height}` }}
      inert
      aria-hidden='true'
    >
      <div
        className='absolute top-0 left-0 origin-top-left'
        style={{ width: pageWidthPx, height: pageHeightPx, transform: `scale(${scale})` }}
      >
        {/* Drawn once measured in the browser: the layout depends on the real fonts' metrics,
            which a server render can only estimate — the two would never hydrate as one. */}
        {frameWidth > 0 && sheet}
      </div>
    </div>
  )
}
