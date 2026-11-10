'use client'

import { createContext, type FC, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { type ListDocument, SHEET_SHAPES, type SheetShape } from '@store/lists/single/types'
import { useFontEpoch } from '@hooks/useSheetLayout'
import { newListPath } from '@constants/routes'
import type { TemplateId } from '@constants/templates'
import { startingPlanScale } from '@helpers/fitSheet'
import { measureText } from '@helpers/measureText'
import { SheetPreview } from '@components/sheet/SheetPreview'
import { ShapePicker } from './ShapePicker'

type ShapeChoice = { shape: SheetShape; setShape: (shape: SheetShape) => void; pending: boolean }

/** What the picker shows. `pending` while the previews still wear the previous shape. */
const TemplateShapeContext = createContext<ShapeChoice | null>(null)
/** What the previews draw. A frame behind the picker, so the choice can paint before the sheets re-lay out. */
const TemplateShapePreviewContext = createContext<SheetShape | null>(null)

/** The shape last picked in the gallery or on a template's page, for the next page in this tab. */
const STORAGE_KEY = 'guests:template-shape'

const readStored = (): SheetShape | null => {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY)
    return value && (SHEET_SHAPES as readonly string[]).includes(value) ? (value as SheetShape) : null
  } catch {
    return null
  }
}

/**
 * The templates gallery and a template's page: the shape their previews, cards and "use this
 * template" share. Remembered for the tab, so a template opened from the gallery, and the next
 * one after it, keeps the shape. Outside it (the landing page) previews keep their own shape.
 */
export const TemplateShapeProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [shape, setShapeState] = useState<SheetShape>('rectangle')
  // Drawn by the previews. Kept back a frame from `shape` so the picker and the waiting
  // state paint before every sheet is laid out again.
  const [drawn, setDrawn] = useState<SheetShape>('rectangle')
  const [pending, setPending] = useState(false)
  useEffect(() => {
    // The tab's earlier pick lives in sessionStorage, which the server render cannot read.
    // Both copies move together: opening the page should not flash the waiting state.
    const stored = readStored()
    if (!stored) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShapeState(stored)
    setDrawn(stored)
  }, [])
  useEffect(() => {
    if (drawn === shape) {
      // The sheets have committed. Dropping the flag here, not in the render that lays them
      // out, keeps the spinner on screen through that work.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (pending) setPending(false)
      return
    }
    let timer = 0
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => setDrawn(shape), 0)
    })
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [drawn, pending, shape])
  const setShape = useCallback((next: SheetShape) => {
    setPending(true)
    setShapeState(next)
    try {
      sessionStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode: the pick still holds on this page.
    }
  }, [])
  const value = useMemo(() => ({ shape, setShape, pending }), [pending, setShape, shape])
  return (
    <TemplateShapeContext.Provider value={value}>
      <TemplateShapePreviewContext.Provider value={drawn}>{children}</TemplateShapePreviewContext.Provider>
    </TemplateShapeContext.Provider>
  )
}

/** Whether the gallery's previews are still catching up with the shape just picked. */
export const useTemplateShapePending = (): boolean => useContext(TemplateShapeContext)?.pending ?? false

/** The shape picked on this page, when there is a provider. */
export const useTemplateShape = (): SheetShape | undefined => useContext(TemplateShapeContext)?.shape

/** The shape picker of the gallery and of a template's page. */
export const TemplateShapePicker: FC = () => {
  const choice = useContext(TemplateShapeContext)
  if (!choice) return null
  return <ShapePicker value={choice.shape} onChange={choice.setShape} />
}

/**
 * A hall the app arranged, small enough to sit on one page. Skipped on the server (there is no
 * canvas, and the preview draws nothing until the browser measures it) and again once the real
 * faces replace the fallback the first fit was measured in.
 */
const fitPlanPreview = (doc: ListDocument): ListDocument => {
  if (typeof document === 'undefined' || doc.design.kind !== 'plan' || Object.keys(doc.design.plan.positions).length > 0) return doc
  const textScale = startingPlanScale(doc, measureText)
  if (textScale === null || textScale === doc.design.textScale) return doc
  return { ...doc, design: { ...doc.design, textScale } }
}

/** A sheet preview in the page's chosen shape, when there is one (place cards stay rectangles). */
export const ShapedSheetPreview: FC<{ doc: ListDocument; className?: string }> = ({ doc, className }) => {
  const drawn = useContext(TemplateShapePreviewContext)
  const fonts = useFontEpoch()
  const shape = drawn && doc.design.kind !== 'cards' ? drawn : doc.design.shape
  const shaped = useMemo(() => (shape === doc.design.shape ? doc : { ...doc, design: { ...doc.design, shape } }), [doc, shape])
  // `fonts` is how many times a face has loaded. The fit reads those widths through `measureText`,
  // so it has to run again when they arrive — the same reason `useSheetLayout` lists its version.
  const fitted = useMemo(
    () => fitPlanPreview(shaped),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shaped, fonts]
  )
  return <SheetPreview doc={fitted} className={className} />
}

/** "Use this template", starting the list in the chosen shape. */
export const UseTemplateLink: FC<{ templateId: TemplateId; className?: string; children: ReactNode }> = ({ templateId, className, children }) => {
  const choice = useContext(TemplateShapeContext)
  return (
    <Link href={newListPath({ template: templateId, shape: choice?.shape })} className={className}>
      {children}
    </Link>
  )
}
