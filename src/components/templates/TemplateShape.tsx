'use client'

import { createContext, type FC, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { type ListDocument, SHEET_SHAPES, type SheetShape } from '@store/lists/single/types'
import { newListPath } from '@constants/routes'
import type { TemplateId } from '@constants/templates'
import { SheetPreview } from '@components/sheet/SheetPreview'
import { ShapePicker } from './ShapePicker'

type ShapeChoice = { shape: SheetShape; setShape: (shape: SheetShape) => void }

const TemplateShapeContext = createContext<ShapeChoice | null>(null)

/** The shape last picked on a template's page, for the next one opened in this tab. */
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
 * A template's page: the shape its previews, the cards of other templates and "use this
 * template" share. Remembered for the tab, so the next template opens in the same shape.
 * Outside it (the gallery, the landing page) previews keep their own shape.
 */
export const TemplateShapeProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [shape, setShapeState] = useState<SheetShape>('rectangle')
  useEffect(() => {
    // The tab's earlier pick lives in sessionStorage, which the server render cannot read.
    const stored = readStored()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setShapeState(stored)
  }, [])
  const setShape = useCallback((next: SheetShape) => {
    setShapeState(next)
    try {
      sessionStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode: the pick still holds on this page.
    }
  }, [])
  const value = useMemo(() => ({ shape, setShape }), [shape, setShape])
  return <TemplateShapeContext.Provider value={value}>{children}</TemplateShapeContext.Provider>
}

/** The template page's shape picker. */
export const TemplateShapePicker: FC = () => {
  const choice = useContext(TemplateShapeContext)
  if (!choice) return null
  return <ShapePicker value={choice.shape} onChange={choice.setShape} />
}

/** A sheet preview in the page's chosen shape, when there is one (place cards stay rectangles). */
export const ShapedSheetPreview: FC<{ doc: ListDocument; className?: string }> = ({ doc, className }) => {
  const choice = useContext(TemplateShapeContext)
  const shape = choice && doc.design.kind !== 'cards' ? choice.shape : doc.design.shape
  const shaped = useMemo(() => (shape === doc.design.shape ? doc : { ...doc, design: { ...doc.design, shape } }), [doc, shape])
  return <SheetPreview doc={shaped} className={className} />
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
