'use client'

import { type FC, useEffect, useRef, useState } from 'react'
import { Modal } from 'antd'
import { useTranslations } from 'next-intl'
import type { ListDocument } from '@store/lists/single/types'
import { useSheetLayout } from '@hooks/useSheetLayout'
import { SheetDocument } from '@components/sheet/SheetDocument'
import { MM_TO_PX } from '@components/sheet/SheetPreview'
import { PAGE_GAP_MM } from './canvas/useCanvasInteraction'
import { PdfActions } from './PdfActions'

/** The space beside the pages, both sides together: less on a phone, where width is scarce. */
const gutterFor = (width: number): number => (width < 576 ? 24 : 64)

/** Every page as it prints, stacked, fitted to the width (never above true size). */
const PreviewPages: FC<{ doc: ListDocument }> = ({ doc }) => {
  const layout = useSheetLayout(doc)
  const frameRef = useRef<HTMLDivElement>(null)
  const [frameWidth, setFrameWidth] = useState(0)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const observer = new ResizeObserver(() => setFrameWidth(frame.clientWidth))
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  const pageWidthPx = layout.width * MM_TO_PX
  const stackHeightMm = layout.pages * layout.height + (layout.pages - 1) * PAGE_GAP_MM
  const scale = frameWidth ? Math.min(1, Math.max(0.15, (frameWidth - gutterFor(frameWidth)) / pageWidthPx)) : 0

  return (
    <div ref={frameRef} className='py-6 sm:py-10'>
      {scale > 0 && (
        <div className='mx-auto' style={{ width: pageWidthPx * scale, height: stackHeightMm * MM_TO_PX * scale }}>
          <div className='origin-top-left' style={{ width: pageWidthPx, transform: `scale(${scale})` }}>
            <SheetDocument design={doc.design} layout={layout} className='sh-stacked' />
          </div>
        </div>
      )}
    </div>
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
        body: {
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          scrollbarWidth: 'thin',
          overscrollBehavior: 'contain',
          background: 'color-mix(in srgb, var(--brand-desk-dark) 85%, transparent)',
          backdropFilter: 'blur(6px)',
        },
      }}
    >
      <PreviewPages doc={doc} />
    </Modal>
  )
}
