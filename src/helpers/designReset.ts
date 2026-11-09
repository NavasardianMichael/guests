import type { Layout, ListDesign } from '@store/lists/single/types'
import { defaultPaper, emptyPlan, templateDesign } from '@helpers/listFactory'
import { applyPaperPatch, defaultTextScale } from '@helpers/paperChange'

/**
 * What a reset button puts back: everything (`all`), one editor tab, one section of a tab, or
 * the sizes "fit to the page" changes (`sizing`, the canvas button beside it).
 * Guests, tables, the texts and the chosen kind and template are never reset — they are the
 * user's content and choices, not settings.
 */
export const RESET_SCOPES = [
  'all',
  'layout',
  'layout.arrangement',
  'layout.grid',
  'layout.cards',
  'layout.content',
  'layout.plan',
  'sizing',
  'design',
  'design.colors',
  'design.tableStyle',
  'design.typography',
  'paper',
  'paper.format',
  'paper.margin',
] as const
export type ResetScope = (typeof RESET_SCOPES)[number]

const pick = <K extends keyof Layout>(from: Layout, keys: readonly K[]): Pick<Layout, K> =>
  Object.fromEntries(keys.map((key) => [key, from[key]])) as Pick<Layout, K>

const GRID_KEYS = ['columns', 'flow', 'balance', 'gapX', 'gapY'] as const
const CARD_KEYS = ['cardWidth', 'cardHeight', 'cardFold', 'cutMarks', 'gapX', 'gapY'] as const
const CONTENT_KEYS = ['sort', 'numbering', 'showTable', 'showNote', 'headerOnEveryPage'] as const

/** In place: `design` is a fresh copy owned by `resetDesign`. */
const resetPart = (design: ListDesign, scope: ResetScope): void => {
  const defaults = templateDesign(design.templateId, design.kind)
  const { layout } = design
  switch (scope) {
    case 'all':
      // Paper first: its reset rescales the letters, which typography then sets outright.
      resetPart(design, 'paper')
      resetPart(design, 'layout')
      resetPart(design, 'design')
      return
    case 'layout':
      design.layout = defaults.layout
      // The hall plan's arrangement is its layout.
      if (design.kind === 'plan') resetPart(design, 'layout.plan')
      return
    case 'layout.plan':
      design.plan = emptyPlan(design.plan.arrangement)
      return
    case 'layout.arrangement':
      Object.assign(layout, { mode: 'grid', positions: {}, sizes: {} })
      return
    case 'layout.grid':
    case 'layout.cards':
      Object.assign(layout, pick(defaults.layout, scope === 'layout.grid' ? GRID_KEYS : CARD_KEYS))
      // A new grid re-flows the sheet; dragged blocks would sit on top of it (as `setLayout`).
      if (layout.mode === 'grid') layout.positions = {}
      return
    case 'layout.content':
      Object.assign(layout, pick(defaults.layout, CONTENT_KEYS))
      return
    case 'sizing':
      // What "fit to the page" sets, and resized tables: the template's columns and letter
      // size for this paper, every block at its own size again.
      design.textScale = defaultTextScale(design.paper)
      layout.columns = defaults.layout.columns
      layout.sizes = {}
      if (layout.mode === 'grid') layout.positions = {}
      // The hall plan's tables too, and the app arranges it again.
      if (design.kind === 'plan') design.plan = emptyPlan(design.plan.arrangement)
      return
    case 'design':
      resetPart(design, 'design.colors')
      resetPart(design, 'design.tableStyle')
      resetPart(design, 'design.typography')
      return
    case 'design.colors':
      design.palette = defaults.palette
      design.decor = true
      return
    case 'design.tableStyle':
      design.tableStyle = defaults.tableStyle
      return
    case 'design.typography':
      design.type = defaults.type
      design.textScale = defaultTextScale(design.paper)
      return
    case 'paper':
      resetPart(design, 'paper.format')
      resetPart(design, 'paper.margin')
      return
    case 'paper.format': {
      const { format, orientation } = defaultPaper(design.kind)
      applyPaperPatch(design, { format, orientation })
      return
    }
    case 'paper.margin':
      design.paper.margin = defaultPaper(design.kind).margin
      return
  }
}

/** `design` with `scope` back at the template's defaults; `design` itself is left alone. */
export const resetDesign = (design: ListDesign, scope: ResetScope): ListDesign => {
  const next = structuredClone(design)
  resetPart(next, scope)
  return next
}

const sameValue = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
}

/** True when resetting `scope` would change nothing: its button has nothing to do. */
export const isAtDefault = (design: ListDesign, scope: ResetScope): boolean => sameValue(resetDesign(design, scope), design)
