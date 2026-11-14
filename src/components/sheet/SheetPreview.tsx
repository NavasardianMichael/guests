'use client'

import { type FC, memo, useEffect, useMemo, useRef, useState } from 'react'
import type { ListDocument } from '@store/lists/single/types'
import { useFontEpoch, useSheetLayout } from '@hooks/useSheetLayout'
import { cn } from '@helpers/cn'
import { pageSize } from '@helpers/sheetLayout'
import { SheetDocument } from './SheetDocument'

export const MM_TO_PX = 96 / 25.4

/** How far outside the screen (or a scrolling panel) a preview starts laying out, so it is drawn by the time it shows. */
const AHEAD = '300px'

type Props = {
  doc: ListDocument
  className?: string
  /**
   * Adjusts the document just before it is laid out, and again whenever a face arrives (it may
   * measure text) — `ShapedSheetPreview` fits a hall's text to one page. Stable, or memoised.
   */
  fit?: (doc: ListDocument) => ListDocument
}

/**
 * The laid-out first page. Mounted only once the preview comes near the screen; a memo, so
 * measuring the frame never redraws the sheet.
 */
const PreviewPage = memo<{ doc: ListDocument; fit?: Props['fit'] }>(function PreviewPage({ doc, fit }) {
  const fonts = useFontEpoch()
  // `fonts` is how many times a face has loaded: a fit reads those widths through `measureText`.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fitted = useMemo(() => (fit ? fit(doc) : doc), [doc, fit, fonts])
  const layout = useSheetLayout(fitted)
  const firstPage = useMemo(() => ({ ...layout, pages: 1 }), [layout])
  return <SheetDocument design={fitted.design} layout={firstPage} />
})

/**
 * A sheet's first page scaled to its container's width — template cards, dashboard
 * thumbnails, the landing page. `inert`: the scaled copy is a picture, the page around it
 * says what it shows.
 *
 * The box keeps the paper's proportions from the start; the sheet is laid out (and its fonts
 * fetched) only once the box comes within `AHEAD` of the screen, and stays drawn after that.
 * A page of 46 previews thus fetches the faces of the ones shown, not of all of them.
 */
export const SheetPreview: FC<Props> = ({ doc, className, fit }) => {
  const frameRef = useRef<HTMLDivElement>(null)
  const [frameWidth, setFrameWidth] = useState(0)
  const [seen, setSeen] = useState(false)
  const { width, height } = pageSize(doc.design.paper)
  const pageWidthPx = width * MM_TO_PX
  const pageHeightPx = height * MM_TO_PX

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const observer = new ResizeObserver(() => setFrameWidth(frame.clientWidth))
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame || seen) return
    if (typeof IntersectionObserver === 'undefined') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSeen(true)
      return
    }
    // `scrollMargin` stretches the margin into scrolling panels too (the editor's Template step).
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && setSeen(true), {
      rootMargin: AHEAD,
      scrollMargin: AHEAD,
    })
    observer.observe(frame)
    return () => observer.disconnect()
  }, [seen])

  const scale = frameWidth / pageWidthPx

  return (
    <div
      ref={frameRef}
      className={cn('relative w-full overflow-hidden', className)}
      style={{ aspectRatio: `${width} / ${height}` }}
      inert
      aria-hidden='true'
    >
      <div
        className='absolute top-0 left-0 origin-top-left'
        style={{ width: pageWidthPx, height: pageHeightPx, transform: `scale(${scale})` }}
      >
        {/* Drawn once measured in the browser: the layout depends on the real fonts' metrics,
            which a server render can only estimate — the two would never hydrate as one. */}
        {seen && frameWidth > 0 && <PreviewPage doc={doc} fit={fit} />}
      </div>
    </div>
  )
}
