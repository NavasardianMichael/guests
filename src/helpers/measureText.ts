import type { TextStyle } from '@store/lists/single/types'
import { sheetFontStack } from '@constants/fonts'
import type { Measure } from './sheetLayout'

/**
 * The browser's `Measure` for `layoutSheet`: a canvas measures each text once at a reference
 * size, and every other size is a multiple of it. Letter spacing is added the way CSS adds it,
 * after every character.
 *
 * Widths depend on the font being loaded; until it is, the canvas measures a fallback face.
 * `useSheetLayout` calls `resetMeasureCache` and lays out again once the fonts arrive.
 */
const REFERENCE_PX = 100
const PX_TO_MM = 25.4 / 96
const PT_TO_PX = 96 / 72

let context: CanvasRenderingContext2D | null = null
const cache = new Map<string, number>()

const getContext = (): CanvasRenderingContext2D | null => {
  if (context) return context
  if (typeof document === 'undefined') return null
  context = document.createElement('canvas').getContext('2d')
  return context
}

export const resetMeasureCache = (): void => cache.clear()

/** A rough width when there is no canvas (a server render): half an em per character. */
const estimate = (text: string, px: number): number => Array.from(text).length * px * 0.5

export const measureText: Measure = (text, style: TextStyle, scale) => {
  const px = style.size * scale * PT_TO_PX
  const shown = style.uppercase ? text.toUpperCase() : text
  const key = `${style.font}|${style.bold ? 1 : 0}|${style.italic ? 1 : 0}|${shown}`
  let reference = cache.get(key)
  if (reference === undefined) {
    const ctx = getContext()
    if (ctx) {
      ctx.font = `${style.italic ? 'italic ' : ''}${style.bold ? 700 : 400} ${REFERENCE_PX}px ${sheetFontStack(style.font)}`
      reference = ctx.measureText(shown).width
    } else reference = estimate(shown, REFERENCE_PX)
    cache.set(key, reference)
  }
  const tracking = (style.tracking / 100) * px * Array.from(shown).length
  return (reference * (px / REFERENCE_PX) + tracking) * PX_TO_MM
}
