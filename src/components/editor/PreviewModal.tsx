'use client'

import { type FC, useEffect, useRef, useState } from 'react'
import { Modal } from 'antd'
import { useTranslations } from 'next-intl'
import type { ListDocument } from '@store/lists/single/types'
import { useSheetLayout } from '@hooks/useSheetLayout'
import { SheetDocument } from '@components/sheet/SheetDocument'
import { MM_TO_PX } from '@components/sheet/SheetPreview'
import { PAGE_GAP_MM } from './canvas/useCanvasInteraction'

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
 * The sheet exactly as it prints, over the whole screen: nothing selectable, nothing of the
 * editor's. Closed with its × or Escape; the editor underneath stays as it was.
 */
export const PreviewModal: FC<Props> = ({ open, onClose, doc }) => {
  const t = useTranslations('Editor')
  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width='100vw'
      title={
        <span className='flex flex-col'>
          <span>{t('preview')}</span>
          <span className='text-xs font-normal text-muted'>{t('previewHint')}</span>
        </span>
      }
      style={{ maxWidth: '100vw', margin: 0 }}
      styles={{
        container: { display: 'flex', flexDirection: 'column', height: '100dvh', padding: 0, borderRadius: 0 },
        header: { margin: 0, padding: '12px 56px 12px 16px', borderBottom: '1px solid var(--color-line)' },
        body: {
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          scrollbarWidth: 'thin',
          overscrollBehavior: 'contain',
          background: 'color-mix(in srgb, var(--brand-ink) 7%, var(--brand-canvas))',
        },
      }}
    >
      <PreviewPages doc={doc} />
    </Modal>
  )
}
