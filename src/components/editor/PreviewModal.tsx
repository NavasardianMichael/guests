'use client'

import { type CSSProperties, type FC, useEffect, useMemo, useRef } from 'react'
import { CompressOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons'
import { Button, Modal, Tooltip } from 'antd'
import { useTranslations } from 'next-intl'
import type { ListDocument } from '@store/lists/single/types'
import { useSheetLayout } from '@hooks/useSheetLayout'
import { useElementSize, useZoomPan } from '@hooks/useZoomPan'
import { cn } from '@helpers/cn'
import { bestColumns, gridSize, type Pad } from '@helpers/previewView'
import { SheetDocument } from '@components/sheet/SheetDocument'
import { MM_TO_PX } from '@components/sheet/SheetPreview'
import { PAGE_GAP_MM } from './canvas/useCanvasInteraction'
import { PdfActions } from './PdfActions'

/**
 * Clear around the pages, px: less on a phone, where room is scarce, and below them the zoom
 * buttons' height (40) and their 12px offset with a gap, so at the fit the buttons cover nothing.
 */
const PAD_PHONE: Pad = { x: 12, top: 12, bottom: 64 }
const PAD_WIDE: Pad = { x: 32, top: 32, bottom: 72 }

/** A key typed into a field is text, never a zoom. */
const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/**
 * Every page as it prints, the whole document fitted to the screen with nothing to scroll:
 * the pages sit in the grid that shows them largest. The wheel, a drag, a pinch, the buttons
 * and + / - / 0 zoom and pan it (`useZoomPan`).
 */
const PreviewPages: FC<{ doc: ListDocument }> = ({ doc }) => {
  const t = useTranslations('Editor')
  const layout = useSheetLayout(doc)
  const frameRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const frame = useElementSize(frameRef)
  const pad = frame.width < 576 ? PAD_PHONE : PAD_WIDE
  const gap = PAGE_GAP_MM * MM_TO_PX
  const page = useMemo(
    () => ({ width: layout.width * MM_TO_PX, height: layout.height * MM_TO_PX }),
    [layout.width, layout.height]
  )
  const columns = frame.width ? bestColumns(layout.pages, page, gap, frame, pad) : 1
  const content = useMemo(() => gridSize(layout.pages, columns, page, gap), [layout.pages, columns, page, gap])

  const { canZoomIn, canZoomOut, fitted, canPan, zoomIn, zoomOut, fit } = useZoomPan({
    frameRef,
    contentRef,
    frame,
    content,
    pad,
  })

  // + / - / 0 as the buttons; never with a modifier, so the browser's own Ctrl +/- still work.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return
      if (event.key === '+' || event.key === '=') zoomIn()
      else if (event.key === '-' || event.key === '_') zoomOut()
      else if (event.key === '0') fit()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fit, zoomIn, zoomOut])

  return (
    <>
      <div
        ref={frameRef}
        className={cn('absolute inset-0 touch-none overflow-hidden select-none', canPan && 'cursor-grab')}
      >
        {frame.width > 0 && (
          // Placed and scaled only by `useZoomPan` (a transform, top-left origin).
          <div
            ref={contentRef}
            className='absolute top-0 left-0 origin-top-left'
            style={{ width: content.width, '--sh-grid-columns': columns } as CSSProperties}
          >
            <SheetDocument design={doc.design} layout={layout} className='sh-grid' />
          </div>
        )}
      </div>
      {/* Bottom centre, as document viewers have it: clear of the corners (and of Next's dev badge). */}
      <div className='pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2'>
        <div className='pointer-events-auto flex items-center gap-0.5 rounded-full bg-surface p-1 shadow-lg ring-1 ring-black/5'>
          <Tooltip title={t('zoomOut')}>
            <Button
              type='text'
              shape='circle'
              icon={<ZoomOutOutlined />}
              onClick={zoomOut}
              disabled={!canZoomOut}
              aria-label={t('zoomOut')}
            />
          </Tooltip>
          <Tooltip title={t('previewFit')}>
            <Button
              type='text'
              shape='circle'
              icon={<CompressOutlined />}
              onClick={fit}
              disabled={fitted}
              aria-label={t('previewFit')}
            />
          </Tooltip>
          <Tooltip title={t('zoomIn')}>
            <Button
              type='text'
              shape='circle'
              icon={<ZoomInOutlined />}
              onClick={zoomIn}
              disabled={!canZoomIn}
              aria-label={t('zoomIn')}
            />
          </Tooltip>
        </div>
      </div>
    </>
  )
}

type Props = {
  open: boolean
  onClose: () => void
  doc: ListDocument
}

/**
 * The sheet exactly as it prints, over nearly the whole screen: nothing selectable, nothing of the
 * editor's, except the PDF download in its header. Closed with its × or Escape; the editor underneath stays as it was.
 */
export const PreviewModal: FC<Props> = ({ open, onClose, doc }) => {
  const t = useTranslations('Editor')
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      centered
      width='98vw'
      title={
        // The download beside the title, as in the editor's top bar: what is seen is what downloads.
        <span className='flex items-center gap-3'>
          <span className='flex min-w-0 flex-1 flex-col'>
            <span>{t('preview')}</span>
            <span className='text-xs font-normal text-muted'>{t('previewHint')}</span>
          </span>
          <PdfActions />
        </span>
      }
      // A rim of the editor shows around it (1% a side); antd's bottom padding would push it off-centre.
      style={{ maxWidth: '98vw', paddingBottom: 0 }}
      styles={{
        // Transparent, so the editor shows (blurred) through the desk around the pages.
        container: {
          display: 'flex',
          flexDirection: 'column',
          height: '98dvh',
          padding: 0,
          overflow: 'hidden',
          background: 'transparent',
        },
        header: {
          margin: 0,
          padding: '12px 56px 12px 16px',
          borderBottom: '1px solid var(--color-line)',
          background: 'var(--brand-surface)',
        },
        // Nothing scrolls: the pages are fitted, and zoomed or panned by gesture.
        body: {
          position: 'relative',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          background: 'color-mix(in srgb, var(--brand-desk-dark) 85%, transparent)',
          backdropFilter: 'blur(6px)',
        },
      }}
    >
      <PreviewPages doc={doc} />
    </Modal>
  )
}
