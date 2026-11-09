'use client'

import { useEffect, useMemo, useState } from 'react'
import { type ListDesign, type ListDocument, TEXT_ROLES, type TextStyle, type Typography } from '@store/lists/single/types'
import { type FontSlug, sheetFontFamily } from '@constants/fonts'
import { measureText, resetMeasureCache } from '@helpers/measureText'
import { layoutSheet, type SheetLayout } from '@helpers/sheetLayout'

/** Armenian, Latin and Cyrillic letters, so every subset of a face is asked for. */
const SAMPLE = 'Աա Aa Аа 1'

/** Bumped whenever a font finishes loading anywhere on the page; every sheet re-measures. */
let fontsVersion = 0
const listeners = new Set<() => void>()
let listening = false

const bump = () => {
  fontsVersion += 1
  resetMeasureCache()
  for (const listener of listeners) listener()
}

const listen = () => {
  if (listening || typeof document === 'undefined' || !document.fonts) return
  listening = true
  document.fonts.addEventListener('loadingdone', bump)
}

const documentFaces = (doc: ListDocument): string[] => {
  const faces = new Set<string>()
  for (const role of TEXT_ROLES) {
    const style = doc.design.type[role]
    faces.add(`${style.italic ? 'italic ' : ''}${style.bold ? 700 : 400} 16px ${sheetFontFamily(style.font)}`)
  }
  const fallbacks: FontSlug[] = ['mardoto', 'free-sans']
  for (const slug of fallbacks) faces.add(`400 16px ${sheetFontFamily(slug)}`)
  return [...faces]
}

/**
 * Asks for every face a document uses and resolves once they are in (or have failed), with
 * whether any of them had to be fetched.
 */
export const loadDocumentFonts = async (doc: ListDocument): Promise<boolean> => {
  if (typeof document === 'undefined' || !document.fonts) return false
  const missing = documentFaces(doc).filter((face) => !document.fonts.check(face, SAMPLE))
  if (!missing.length) return false
  await Promise.all(missing.map((face) => document.fonts.load(face, SAMPLE).catch(() => [])))
  return true
}

/** Everything of a text style the layout measures: all of it but the colour. */
const TEXT_METRICS = {
  font: true,
  size: true,
  bold: true,
  italic: true,
  uppercase: true,
  tracking: true,
  align: true,
} as const satisfies Record<Exclude<keyof TextStyle, 'color'>, true>

/**
 * The parts of the design `layoutSheet` reads. Colours (the palette, each text's colour) and
 * the decor switch are the renderer's alone, so a colour dragged across the picker re-renders
 * the sheet but never re-lays it out. A field added to `ListDesign` fails here until it is
 * sorted into one side or the other.
 */
export const LAYOUT_FIELDS = {
  kind: true,
  templateId: true,
  shape: true,
  paper: true,
  type: true,
  textScale: true,
  tableStyle: true,
  layout: true,
  plan: true,
} as const satisfies Record<Exclude<keyof ListDesign, 'palette' | 'decor'>, true>

/** The typography as the layout sees it: a string that changes only when a measurement may. */
const metricsKey = (type: Typography): string =>
  TEXT_ROLES.map((role) => (Object.keys(TEXT_METRICS) as (keyof typeof TEXT_METRICS)[]).map((key) => type[role][key]).join('|')).join(';')

/**
 * The document's layout, recomputed when something it measures changes and again whenever a
 * font arrives (until then text is measured in a fallback face, and the blocks would be sized
 * for it). A change of colour alone keeps the layout it has (`LAYOUT_FIELDS`).
 */
export const useSheetLayout = (doc: ListDocument): SheetLayout => {
  const [version, setVersion] = useState(fontsVersion)

  useEffect(() => {
    listen()
    const onChange = () => setVersion(fontsVersion)
    listeners.add(onChange)
    let active = true
    void loadDocumentFonts(doc).then((fetched) => {
      // `loadingdone` usually announces it; this covers a load that finished before we listened.
      if (active && fetched) bump()
    })
    return () => {
      active = false
      listeners.delete(onChange)
    }
    // Only the faces matter here, not every keystroke in the document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.design.type])

  const { content, design } = doc
  const metrics = metricsKey(design.type)
  // `version` is the fonts' state, which `measureText` reads from the page. The rest are
  // `content` and `LAYOUT_FIELDS`, the typography by its measurements (`metrics`).
  return useMemo(
    () => layoutSheet(doc, measureText),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [content, design.kind, design.templateId, design.shape, design.paper, metrics, design.textScale, design.tableStyle, design.layout, design.plan, version]
  )
}
