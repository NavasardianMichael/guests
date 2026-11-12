'use client'

import { type FC, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  CameraOutlined,
  ExpandOutlined,
  FileExcelOutlined,
  ReloadOutlined,
  SnippetsOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { App, Button, Tooltip } from 'antd'
import { useTranslations } from 'next-intl'
import { useEditorUiStore } from '@store/editorUi/store'
import { DEFAULT_SEATS_PER_TABLE, useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import type { ListDocument } from '@store/lists/single/types'
import { useSheetLayout } from '@hooks/useSheetLayout'
import { clampZoom } from '@helpers/canvasZoom'
import { isAtDefault } from '@helpers/designReset'
import { fitSheet } from '@helpers/fitSheet'
import { measureText } from '@helpers/measureText'
import { SheetDocument } from '@components/sheet/SheetDocument'
import { SheetInteractionProvider } from '@components/sheet/SheetInteraction'
import { MM_TO_PX } from '@components/sheet/SheetPreview'
import { SelectionBar } from './SelectionBar'
import { PAGE_GAP_MM, useCanvasInteraction } from './useCanvasInteraction'
import { useCanvasShortcuts } from './useCanvasShortcuts'
import { PhotoLock } from '../import/PhotoLock'
import { PlanToolbar } from '../plan/PlanAdd'

type Props = {
  doc: ListDocument
  /** null = fit to the available width. */
  zoom: number | null
  /** A pinch on a touch screen sets it. */
  onZoomChange: (zoom: number) => void
  onFitZoomChange: (zoom: number) => void
  onPagesChange: (pages: number) => void
  /** The preview is open over the canvas: its shortcuts are off and any open text closes. */
  previewing: boolean
}

/** The space beside the sheet, both sides together: less on a phone, where width is scarce. */
const gutterFor = (width: number): number => (width < 576 ? 24 : 64)

type TouchPoints = { readonly length: number; readonly [index: number]: { clientX: number; clientY: number } }

const distanceOf = (touches: TouchPoints): number =>
  Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)

/**
 * The editable sheet: every page at true size, stacked, scaled to the zoom. What is drawn is
 * `SheetDocument` itself — the PDF's renderer — with the editor's handlers given to it through
 * `SheetInteractionProvider`; the editor's own marks (page labels, snap guides, the selection
 * rectangle) are passed in per page and never reach a print.
 *
 * Touch screens pinch to zoom the sheet, not the page (as in cv-builder's editor).
 *
 * Memoised: the shell re-renders on every edit, and hands this a deferred copy of the document
 * (`useDeferredValue`), so the sheet re-renders only when that copy moves on.
 */
export const EditorCanvas: FC<Props> = memo(function EditorCanvas({ doc, zoom, onZoomChange, onFitZoomChange, onPagesChange, previewing }) {
  const t = useTranslations('Editor.canvas')
  const tSamples = useTranslations('Samples')
  const autoSeat = useListEditorStore.use.autoSeat()
  const fitToPage = useListEditorStore.use.fitToPage()
  const resetDesign = useListEditorStore.use.resetDesign()
  const { message } = App.useApp()
  // Nothing to put back while columns, letter size and block sizes are the template's own.
  const sizingAtDefault = useMemo(() => isAtDefault(doc.design, 'sizing'), [doc.design])
  // Something to fit: tables on a seating board, names on a list (cards are sized by the card).
  const canFit = useListEditorStoreBase((state) => {
    const current = state.doc
    // Cards are sized by the card.
    if (!current || current.design.kind === 'cards') return false
    const { content, design } = current
    if (design.kind === 'plan') return content.tables.length + content.venue.length > 0
    return (design.kind === 'seating' ? content.tables.length : content.guests.length) > 0
  })
  const layout = useSheetLayout(doc)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [fitZoom, setFitZoom] = useState(1)
  const scale = zoom ?? fitZoom
  const openImport = useEditorUiStore.use.openImport()
  const openTab = useEditorUiStore.use.openTab()
  // The spreadsheet edits a draft of the guests: Delete or Ctrl+Z must not change the list behind it.
  const spreadsheetOpen = useEditorUiStore.use.spreadsheetOpen()
  const { interaction, guides, marquee, setEditing, onBackgroundPointerDown } = useCanvasInteraction({
    layout,
    scale,
    sheetRef,
  })
  const pageWidthPx = layout.width * MM_TO_PX
  const stackHeightMm = layout.pages * layout.height + (layout.pages - 1) * PAGE_GAP_MM

  useCanvasShortcuts({ layout, enabled: !previewing && !spreadsheetOpen })

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const observer = new ResizeObserver(() => {
      const width = scroller.clientWidth
      // Fit the width, but never larger than true size: a whole A4 page stays readable at 100%.
      const next = Math.min(1, Math.max(0.15, (width - gutterFor(width)) / pageWidthPx))
      setFitZoom(next)
      onFitZoomChange(next)
    })
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [onFitZoomChange, pageWidthPx])

  useEffect(() => onPagesChange(layout.pages), [layout.pages, onPagesChange])

  // Opening the preview closes any open text.
  useEffect(() => {
    if (previewing) setEditing(null)
  }, [previewing, setEditing])

  // The pinch reads the zoom it starts from and reports through refs, so its listeners are
  // attached once rather than on every frame of the gesture.
  const scaleRef = useRef(scale)
  const onZoomChangeRef = useRef(onZoomChange)
  const anchorRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    scaleRef.current = scale
    onZoomChangeRef.current = onZoomChange
  })

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    let start: { distance: number; zoom: number } | null = null
    const onTouchStart = (event: TouchEvent) => {
      start = event.touches.length === 2 ? { distance: distanceOf(event.touches), zoom: scaleRef.current } : null
    }
    const onTouchMove = (event: TouchEvent) => {
      if (!start || event.touches.length !== 2) return
      event.preventDefault()
      const rect = scroller.getBoundingClientRect()
      const left = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left
      const top = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top
      anchorRef.current = {
        x: (scroller.scrollLeft + left) / scroller.scrollWidth,
        y: (scroller.scrollTop + top) / scroller.scrollHeight,
        left,
        top,
      }
      onZoomChangeRef.current(clampZoom((start.zoom * distanceOf(event.touches)) / start.distance))
    }
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) start = null
    }
    scroller.addEventListener('touchstart', onTouchStart, { passive: true })
    // Not passive: a pinch must not also zoom the page (iOS ignores `touch-action` for that).
    scroller.addEventListener('touchmove', onTouchMove, { passive: false })
    scroller.addEventListener('touchend', onTouchEnd)
    scroller.addEventListener('touchcancel', onTouchEnd)
    return () => {
      scroller.removeEventListener('touchstart', onTouchStart)
      scroller.removeEventListener('touchmove', onTouchMove)
      scroller.removeEventListener('touchend', onTouchEnd)
      scroller.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    const anchor = anchorRef.current
    if (!scroller || !anchor) return
    anchorRef.current = null
    scroller.scrollLeft = anchor.x * scroller.scrollWidth - anchor.left
    scroller.scrollTop = anchor.y * scroller.scrollHeight - anchor.top
  }, [scale])

  /** Columns and text size fitted to the paper, nobody moved (`helpers/fitSheet`), measured as the canvas measures. */
  const fit = () => {
    const current = useListEditorStoreBase.getState().doc
    const result = current ? fitSheet(current, measureText) : null
    if (!result) return
    fitToPage(result)
    const summary = [
      // The hall plan has no columns (`columns: 0`).
      result.columns ? t('fitColumns', { count: result.columns }) : '',
      result.rows ? t('fitRows', { count: result.rows }) : '',
      t('fitText', { percent: Math.round(result.textScale * 100) }),
      result.pages > 1 ? t('fitPages', { count: result.pages }) : '',
    ]
      .filter(Boolean)
      .join(' · ')
    void message.success(t('fitted', { summary }))
  }

  /** Back to the template's columns, letter size and block sizes — what "fit" changes. One undo step. */
  const resetSizing = () => {
    if (sizingAtDefault) return
    resetDesign('sizing')
    void message.success(t('resetSizingDone'))
  }

  /** Sized in screen pixels over the zoom, as the resize handles are: the same button at any zoom. */
  const onScreen = (px: number): string => `calc(${px}px / var(--canvas-zoom, 1))`

  const roundButton =
    'absolute z-30 grid place-items-center rounded-full border-solid border-line bg-surface p-0 text-ink shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent'
  const roundButtonStyle = (right: number) => ({
    top: onScreen(-34),
    right: onScreen(right),
    width: onScreen(28),
    height: onScreen(28),
    borderWidth: onScreen(1),
    fontSize: onScreen(14),
  })

  const pageExtras = (page: number) => (
    <>
      {page === 0 && canFit && (
        <>
          <Tooltip title={t('resetSizingHint')} placement='left'>
            {/* `aria-disabled`, not `disabled`: a disabled button never shows its tooltip. */}
            <button
              type='button'
              data-canvas-ui
              aria-label={t('resetSizing')}
              aria-disabled={sizingAtDefault}
              onClick={resetSizing}
              className={`${roundButton} ${
                sizingAtDefault ? 'cursor-default opacity-40' : 'cursor-pointer hover:border-accent hover:text-accent-strong'
              }`}
              style={roundButtonStyle(34)}
            >
              <ReloadOutlined />
            </button>
          </Tooltip>
          <Tooltip title={t('fitHint')} placement='left'>
            <button
              type='button'
              data-canvas-ui
              aria-label={t('fit')}
              onClick={fit}
              className={`${roundButton} cursor-pointer hover:border-accent hover:text-accent-strong`}
              style={roundButtonStyle(0)}
            >
              <ExpandOutlined />
            </button>
          </Tooltip>
        </>
      )}
      <span
        className='pointer-events-none absolute -top-[7mm] left-0 text-[3.2mm] font-medium text-muted'
        style={{ fontFamily: 'var(--font-ui), system-ui, sans-serif' }}
        aria-hidden='true'
      >
        {t('page', { number: page + 1, count: layout.pages })}
      </span>
      {guides
        .filter((guide) => guide.page === page)
        .map((guide, index) => (
          <span
            key={index}
            className='pointer-events-none absolute z-30 bg-accent'
            style={
              guide.axis === 'x'
                ? { left: `${guide.at - 0.15}mm`, top: `${guide.from}mm`, height: `${guide.to - guide.from}mm`, width: '0.3mm' }
                : { top: `${guide.at - 0.15}mm`, left: `${guide.from}mm`, width: `${guide.to - guide.from}mm`, height: '0.3mm' }
            }
            aria-hidden='true'
          />
        ))}
      {marquee?.page === page && (
        <span
          className='pointer-events-none absolute z-30 border border-dashed border-accent bg-accent/10'
          style={{
            left: `${Math.min(marquee.x0, marquee.x1)}mm`,
            top: `${Math.min(marquee.y0, marquee.y1)}mm`,
            width: `${Math.abs(marquee.x1 - marquee.x0)}mm`,
            height: `${Math.abs(marquee.y1 - marquee.y0)}mm`,
          }}
          aria-hidden='true'
        />
      )}
    </>
  )

  const empty = doc.content.guests.length === 0
  const unseated = doc.design.kind === 'seating' || doc.design.kind === 'plan' ? layout.unseated : 0

  return (
    <div className='relative flex min-w-0 flex-1 flex-col'>
      <div className='pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center'>
        <SelectionBar layout={layout} onEdit={setEditing} />
      </div>
      <div
        ref={scrollerRef}
        className='min-h-0 flex-1 touch-pan-x touch-pan-y scrollbar-thin overflow-auto overscroll-contain bg-[color-mix(in_srgb,var(--brand-ink)_7%,var(--brand-canvas))]'
      >
        <div
          className='min-h-full w-max min-w-full px-3 pt-8 pb-24 sm:px-8 sm:pt-12'
          onPointerDown={onBackgroundPointerDown}
        >
          {(empty || unseated > 0) && (
            <div data-canvas-ui className='mx-auto mb-5 max-w-xl'>
              {empty ? (
                <div className='rounded-2xl bg-surface p-4 text-center shadow-sm ring-1 ring-black/5 sm:p-5'>
                  <p className='m-0 font-semibold text-ink'>{t('emptyTitle')}</p>
                  <p className='m-0 mt-1 text-sm text-muted'>{t('emptyText')}</p>
                  <div className='mt-3 flex flex-wrap justify-center gap-2'>
                    <Button icon={<SnippetsOutlined />} onClick={() => openImport('paste')}>
                      {t('emptyPaste')}
                    </Button>
                    <Button icon={<FileExcelOutlined />} onClick={() => openImport('file')}>
                      {t('emptyFile')}
                    </Button>
                    <Button type='primary' icon={<CameraOutlined />} onClick={() => openImport('photo')}>
                      {t('emptyPhoto')}
                      <PhotoLock />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className='flex items-center gap-3 rounded-xl bg-[color-mix(in_srgb,var(--brand-accent)_14%,white)] px-4 py-2.5 text-sm'>
                  <WarningOutlined className='text-accent-strong' />
                  <span className='flex-1'>{t('unseated', { count: unseated })}</span>
                  <Button
                    size='small'
                    onClick={() => {
                      // Seat them for real (new tables as needed; undo reverts it), then show
                      // the result in the Guests panel, where the seating can be adjusted.
                      autoSeat(DEFAULT_SEATS_PER_TABLE, (number) => tSamples('table', { number }))
                      openTab('guests')
                    }}
                  >
                    {t('unseatedAction')}
                  </Button>
                </div>
              )}
            </div>
          )}
          {doc.design.kind === 'plan' && (
            <div className='mx-auto mb-5 flex max-w-4xl justify-center'>
              <PlanToolbar />
            </div>
          )}
          <div className='mx-auto' style={{ width: pageWidthPx * scale, height: stackHeightMm * MM_TO_PX * scale }}>
            <div
              ref={sheetRef}
              className='origin-top-left'
              // `--canvas-zoom` keeps the editor's handles the same size on screen at any zoom.
              style={{ width: pageWidthPx, transform: `scale(${scale})`, ['--canvas-zoom' as string]: scale }}
            >
              <SheetInteractionProvider value={interaction}>
                <SheetDocument
                  design={doc.design}
                  layout={layout}
                  className='sh-stacked'
                  renderPageExtras={pageExtras}
                />
              </SheetInteractionProvider>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
