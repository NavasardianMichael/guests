import type { TemplateId } from './templates'

/**
 * One line of a template's frame: `inset` mm in from the sheet's edge (where the CSS border
 * box starts), `width` mm thick, in the accent unless `color` says otherwise.
 */
export type FrameRing = {
  inset: number
  width: number
  line?: 'solid' | 'dashed' | 'dotted' | 'double'
  /** As the CSS mixes the accent with transparency. */
  opacity?: number
  color?: string
}

/**
 * A template's frame on a shaped sheet. `sheet.css` draws frames as rectangles
 * (`.sh-decor::before/::after`); on an arch or an oval those pseudo-elements (`hide`) give way
 * to these rings, drawn along the outline by `SheetDocument` — same insets, widths and line
 * styles. A template without an entry has no frame; its washes and bands are simply clipped.
 *
 * Keep in step with the template's CSS frame.
 */
export type ShapeFrame = { rings: FrameRing[]; hide: ('before' | 'after')[] }

const both: ShapeFrame['hide'] = ['before', 'after']

export const TEMPLATE_FRAMES: Partial<Record<TemplateId, ShapeFrame>> = {
  memorial: { rings: [{ inset: 7, width: 0.3 }, { inset: 8.3, width: 0.12, opacity: 0.6 }], hide: both },
  classic: { rings: [{ inset: 7, width: 0.5 }, { inset: 8.6, width: 0.2 }], hide: both },
  ivory: { rings: [{ inset: 6, width: 0.45 }, { inset: 8, width: 0.2 }], hide: both },
  ornament: { rings: [{ inset: 6, width: 1.6, line: 'double' }, { inset: 10, width: 0.2, opacity: 0.55 }], hide: both },
  pomegranate: { rings: [{ inset: 5, width: 0.3, opacity: 0.6 }], hide: ['before'] },
  botanical: { rings: [{ inset: 8, width: 0.25, opacity: 0.45 }], hide: ['before'] },
  midnight: { rings: [{ inset: 6, width: 0.4 }, { inset: 7.6, width: 0.15 }], hide: both },
  deco: { rings: [{ inset: 5, width: 0.6 }, { inset: 7, width: 0.25 }], hide: both },
  kraft: { rings: [{ inset: 6, width: 0.5, line: 'dashed' }], hide: ['before'] },
  chalk: { rings: [{ inset: 0, width: 4.5, color: '#6b4a2b' }, { inset: 9, width: 0.35, line: 'dashed', opacity: 0.45 }], hide: both },
  vintage: { rings: [{ inset: 6, width: 0.6 }, { inset: 8, width: 0.2 }], hide: both },
  mono: { rings: [{ inset: 6, width: 1.6 }], hide: ['before'] },
  scandi: { rings: [{ inset: 7, width: 0.3, opacity: 0.7 }], hide: ['before'] },
  spring: { rings: [{ inset: 6, width: 0.3, opacity: 0.5 }], hide: ['before'] },
  christening: { rings: [{ inset: 7, width: 0.6, line: 'dotted' }], hide: ['after'] },
  carpet: { rings: [{ inset: 5, width: 6, opacity: 0.22 }, { inset: 12.5, width: 0.3, opacity: 0.55 }], hide: both },
  khachkar: { rings: [{ inset: 5.2, width: 0.25 }, { inset: 6, width: 3.6, line: 'dotted', opacity: 0.85 }], hide: both },
  emerald: { rings: [{ inset: 6, width: 0.5 }, { inset: 8, width: 0.2 }], hide: both },
  blacktie: { rings: [{ inset: 5, width: 2.2 }, { inset: 9, width: 0.2 }], hide: both },
  velvet: { rings: [{ inset: 6, width: 1.4, line: 'double' }], hide: ['after'] },
  jubilee: { rings: [{ inset: 6, width: 1.1 }, { inset: 8.4, width: 0.25 }], hide: both },
  romance: { rings: [{ inset: 7, width: 0.3 }], hide: ['after'] },
  vineyard: { rings: [{ inset: 6, width: 0.4 }, { inset: 7.6, width: 0.15 }], hide: both },
  terracotta: { rings: [{ inset: 6, width: 0.3, opacity: 0.55 }], hide: ['before'] },
  nautical: { rings: [{ inset: 6, width: 1.4, line: 'dashed' }], hide: ['before'] },
  // Linen's twine frame is its first corner element, hidden with every curved corner.
  linen: { rings: [{ inset: 8, width: 0.45, line: 'dashed' }], hide: [] },
  citrus: { rings: [{ inset: 7, width: 0.3, opacity: 0.45 }], hide: ['after'] },
  winter: { rings: [{ inset: 7, width: 0.25, opacity: 0.6 }], hide: ['after'] },
  neon: { rings: [{ inset: 7, width: 0.6 }, { inset: 9.5, width: 0.35, color: '#8ff7ff' }], hide: both },
}
