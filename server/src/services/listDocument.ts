import { randomBytes } from 'node:crypto'
import {
  DEFAULT_TEMPLATE_ID,
  FONT_SLUGS,
  type FontSlug,
  PAPER_FORMATS,
  PAPER_LIMITS,
  PAPER_SIZES,
  PRINT_KINDS,
  TABLE_STYLES,
  TEMPLATE_IDS,
  type TemplateId,
  TEXT_ROLES,
} from '../lib/catalogue.js'

/**
 * The document's shape, as the web writes it (`src/store/lists/single/types.ts` — the twin).
 *
 * The API **coerces, it does not reject**: autosave runs on every pause, and a field the web
 * got wrong must not cost the user their work. Every value is clamped, defaulted or dropped
 * into a valid document; colours must be `#rrggbb` (they reach `style`), fonts and templates
 * must be in the catalogue, ids must be short tokens. Import-free of Prisma and config, so the
 * rules are pinned by tests.
 */

export const DEFAULT_LIST_TITLE = 'Հյուրերի ցուցակ'

/** Twin: `MAX_GUESTS` / `MAX_TABLES` in the web's editor store. */
export const LIST_LIMITS = {
  guests: 2000,
  tables: 300,
  title: 120,
  name: 120,
  note: 120,
  tableName: 60,
  text: 200,
  positions: 2500,
  pages: 200,
  /** The smallest a block can be resized to, mm. Twin: `MIN_BLOCK_SIZE` in the web's editor store. */
  minBlockW: 10,
  minBlockH: 4,
} as const

type Align = 'left' | 'center' | 'right'
type TextStyle = {
  font: FontSlug
  size: number
  color: string
  bold: boolean
  italic: boolean
  uppercase: boolean
  tracking: number
  align: Align
}
type TextRole = (typeof TEXT_ROLES)[number]
type Position = { page: number; x: number; y: number }
type Size = { w: number; h: number }

export type ListContent = {
  heading: string
  subheading: string
  footer: string
  guests: { id: string; name: string; tableId: string; note: string }[]
  tables: { id: string; name: string }[]
}

export type ListDesign = {
  kind: (typeof PRINT_KINDS)[number]
  templateId: TemplateId
  paper: { format: (typeof PAPER_FORMATS)[number]; width: number; height: number; orientation: 'portrait' | 'landscape'; margin: number }
  palette: { background: string; accent: string; panel: string }
  type: Record<TextRole, TextStyle>
  textScale: number
  tableStyle: (typeof TABLE_STYLES)[number]
  decor: boolean
  layout: {
    mode: 'grid' | 'free'
    columns: number
    flow: 'rows' | 'columns'
    balance: boolean
    gapX: number
    gapY: number
    sort: 'manual' | 'az' | 'za'
    numbering: boolean
    showTable: boolean
    showNote: boolean
    headerOnEveryPage: boolean
    cardWidth: number
    cardHeight: number
    cardFold: boolean
    cutMarks: boolean
    positions: Record<string, Position>
    sizes: Record<string, Size>
  }
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback

const text = (value: unknown, max: number, fallback = ''): string =>
  typeof value === 'string' ? value.replace(/\p{Cc}/gu, ' ').slice(0, max) : fallback

const num = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback

const int = (value: unknown, min: number, max: number, fallback: number): number => Math.round(num(value, min, max, fallback))

const bool = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)

const color = (value: unknown, fallback: string): string => (typeof value === 'string' && COLOR_PATTERN.test(value) ? value.toLowerCase() : fallback)

const newId = (): string => randomBytes(8).toString('hex').slice(0, 10)

export const coerceTitle = (value: unknown, fallback: string): string => {
  const title = text(value, LIST_LIMITS.title).trim()
  return title || fallback
}

export const coerceContent = (value: unknown): ListContent => {
  const source = isObject(value) ? value : {}
  const seen = new Set<string>()
  const uniqueId = (candidate: unknown): string => {
    let id = typeof candidate === 'string' && ID_PATTERN.test(candidate) && !seen.has(candidate) ? candidate : newId()
    while (seen.has(id)) id = newId()
    seen.add(id)
    return id
  }

  const tables = (Array.isArray(source.tables) ? source.tables : [])
    .filter(isObject)
    .slice(0, LIST_LIMITS.tables)
    .map((table) => ({ id: uniqueId(table.id), name: text(table.name, LIST_LIMITS.tableName) }))
  const tableIds = new Set(tables.map((table) => table.id))

  const guests = (Array.isArray(source.guests) ? source.guests : [])
    .filter(isObject)
    .slice(0, LIST_LIMITS.guests)
    .map((guest) => ({
      id: uniqueId(guest.id),
      name: text(guest.name, LIST_LIMITS.name),
      tableId: typeof guest.tableId === 'string' && tableIds.has(guest.tableId) ? guest.tableId : '',
      note: text(guest.note, LIST_LIMITS.note),
    }))

  return {
    heading: text(source.heading, LIST_LIMITS.text),
    subheading: text(source.subheading, LIST_LIMITS.text),
    footer: text(source.footer, LIST_LIMITS.text),
    guests,
    tables,
  }
}

const DEFAULT_STYLE: TextStyle = {
  font: 'ghea-grapalat',
  size: 11,
  color: '#222222',
  bold: false,
  italic: false,
  uppercase: false,
  tracking: 0,
  align: 'center',
}

const DEFAULT_SIZES: Record<TextRole, number> = { heading: 28, subheading: 13, group: 13, name: 11, footer: 10 }

const coerceStyle = (value: unknown, role: TextRole): TextStyle => {
  const source = isObject(value) ? value : {}
  return {
    font: oneOf(source.font, FONT_SLUGS, DEFAULT_STYLE.font),
    size: num(source.size, 5, 120, DEFAULT_SIZES[role]),
    color: color(source.color, DEFAULT_STYLE.color),
    bold: bool(source.bold, role === 'heading' || role === 'group'),
    italic: bool(source.italic, false),
    uppercase: bool(source.uppercase, false),
    tracking: num(source.tracking, -5, 40, 0),
    align: oneOf<Align>(source.align, ['left', 'center', 'right'], 'center'),
  }
}

const coercePositions = (value: unknown): Record<string, Position> => {
  if (!isObject(value)) return {}
  const positions: Record<string, Position> = {}
  for (const [id, raw] of Object.entries(value).slice(0, LIST_LIMITS.positions)) {
    if (!ID_PATTERN.test(id) || !isObject(raw)) continue
    positions[id] = {
      page: int(raw.page, 0, LIST_LIMITS.pages, 0),
      x: num(raw.x, 0, PAPER_LIMITS.maxSide, 0),
      y: num(raw.y, 0, PAPER_LIMITS.maxSide, 0),
    }
  }
  return positions
}

const coerceSizes = (value: unknown): Record<string, Size> => {
  if (!isObject(value)) return {}
  const sizes: Record<string, Size> = {}
  for (const [id, raw] of Object.entries(value).slice(0, LIST_LIMITS.positions)) {
    if (!ID_PATTERN.test(id) || !isObject(raw)) continue
    sizes[id] = {
      w: num(raw.w, LIST_LIMITS.minBlockW, PAPER_LIMITS.maxSide, LIST_LIMITS.minBlockW),
      h: num(raw.h, LIST_LIMITS.minBlockH, PAPER_LIMITS.maxSide, LIST_LIMITS.minBlockH),
    }
  }
  return sizes
}

export const coerceDesign = (value: unknown): ListDesign => {
  const source = isObject(value) ? value : {}
  const paperSource = isObject(source.paper) ? source.paper : {}
  // Legal was dropped from the formats: a list saved on it keeps its size as a custom one.
  const format = paperSource.format === 'legal' ? 'custom' : oneOf(paperSource.format, PAPER_FORMATS, 'A4')
  const named = format === 'custom' ? null : PAPER_SIZES[format]
  const paletteSource = isObject(source.palette) ? source.palette : {}
  const typeSource = isObject(source.type) ? source.type : {}
  const layoutSource = isObject(source.layout) ? source.layout : {}

  return {
    kind: oneOf(source.kind, PRINT_KINDS, 'seating'),
    templateId: oneOf(source.templateId, TEMPLATE_IDS, DEFAULT_TEMPLATE_ID),
    paper: {
      format,
      width: named ? named.width : num(paperSource.width, PAPER_LIMITS.minSide, PAPER_LIMITS.maxSide, 210),
      height: named ? named.height : num(paperSource.height, PAPER_LIMITS.minSide, PAPER_LIMITS.maxSide, 297),
      orientation: oneOf(paperSource.orientation, ['portrait', 'landscape'] as const, 'portrait'),
      margin: num(paperSource.margin, PAPER_LIMITS.minMargin, PAPER_LIMITS.maxMargin, 15),
    },
    palette: {
      background: color(paletteSource.background, '#ffffff'),
      accent: color(paletteSource.accent, '#222222'),
      panel: color(paletteSource.panel, '#f4f4f4'),
    },
    type: Object.fromEntries(TEXT_ROLES.map((role) => [role, coerceStyle(typeSource[role], role)])) as Record<TextRole, TextStyle>,
    textScale: num(source.textScale, 0.4, 4, 1),
    tableStyle: oneOf(source.tableStyle, TABLE_STYLES, 'plain'),
    decor: bool(source.decor, true),
    layout: {
      mode: oneOf(layoutSource.mode, ['grid', 'free'] as const, 'grid'),
      columns: int(layoutSource.columns, 1, 12, 3),
      flow: oneOf(layoutSource.flow, ['rows', 'columns'] as const, 'rows'),
      balance: bool(layoutSource.balance, true),
      gapX: num(layoutSource.gapX, 0, 60, 8),
      gapY: num(layoutSource.gapY, 0, 60, 8),
      sort: oneOf(layoutSource.sort, ['manual', 'az', 'za'] as const, 'manual'),
      numbering: bool(layoutSource.numbering, false),
      showTable: bool(layoutSource.showTable, true),
      showNote: bool(layoutSource.showNote, false),
      headerOnEveryPage: bool(layoutSource.headerOnEveryPage, false),
      cardWidth: num(layoutSource.cardWidth, 30, 300, 90),
      cardHeight: num(layoutSource.cardHeight, 20, 300, 50),
      cardFold: bool(layoutSource.cardFold, false),
      cutMarks: bool(layoutSource.cutMarks, true),
      positions: coercePositions(layoutSource.positions),
      sizes: coerceSizes(layoutSource.sizes),
    },
  }
}
