import type { StateCommonProps } from '@interfaces/store'
import type { FontSlug } from '@constants/fonts'
import type { Orientation, PaperFormat } from '@constants/paper'
import type { TableStyle, TemplateId } from '@constants/templates'
import type { ResetScope } from '@helpers/designReset'

/**
 * A guest list and how it prints. Twin of `server/src/services/listDocument.ts`, which
 * coerces every write into exactly this shape — change both together.
 */

/**
 * What the sheet is:
 * - `list`: names, for the entrance or check-in desk;
 * - `seating`: a seating board, guests grouped under their tables;
 * - `cards`: place cards to cut out, one per guest.
 */
export const PRINT_KINDS = ['seating', 'list', 'cards'] as const
export type PrintKind = (typeof PRINT_KINDS)[number]

/**
 * The sheet's outline (`helpers/sheetShape.ts` draws each): the paper stays rectangular, the
 * design is printed inside the shape and a cut line marks its edge. Place cards ignore it —
 * they are always rectangles.
 */
export const SHEET_SHAPES = ['rectangle', 'rounded', 'ticket', 'arch', 'pointed', 'oval', 'circle', 'hexagon', 'octagon', 'wavy', 'scalloped'] as const
export type SheetShape = (typeof SHEET_SHAPES)[number]

export type Guest = {
  id: string
  name: string
  /** A `GuestTable.id`, or '' when the guest has no table yet. */
  tableId: string
  /** Free text: "+1", "vegetarian", a phone. Shown on cards when `layout.showNote`. */
  note: string
}

export type GuestTable = {
  id: string
  name: string
}

export type ListContent = {
  /** The sheet's title: "Welcome", the couple's names. */
  heading: string
  /** A line under it: the date, the venue. */
  subheading: string
  /** A closing line at the foot of the sheet. */
  footer: string
  guests: Guest[]
  /** In the order they print. */
  tables: GuestTable[]
}

/** The texts a sheet has, each styled on its own. */
export const TEXT_ROLES = ['heading', 'subheading', 'group', 'name', 'footer'] as const
export type TextRole = (typeof TEXT_ROLES)[number]

export type Align = 'left' | 'center' | 'right'

export type TextStyle = {
  font: FontSlug
  /** Points, before `design.textScale`. */
  size: number
  /** `#rrggbb`. */
  color: string
  bold: boolean
  italic: boolean
  uppercase: boolean
  /** Letter spacing in hundredths of an em. */
  tracking: number
  align: Align
}

export type Typography = Record<TextRole, TextStyle>

export type Palette = {
  background: string
  accent: string
  panel: string
}

export type Paper = {
  format: PaperFormat
  /** Millimetres. For a named format they mirror `PAPER_SIZES`; `custom` uses them as typed. */
  width: number
  height: number
  orientation: Orientation
  /** The printable area's inset on every side, mm. */
  margin: number
}

/**
 * - `grid`: the app places everything in columns and rows, page after page;
 * - `free`: every block sits where the user dragged it (`positions`); a block never dragged
 *   keeps its grid place.
 */
export type LayoutMode = 'grid' | 'free'

/** Grid fill order: across then down (`rows`), or down a column then the next (`columns`). */
export type Flow = 'rows' | 'columns'

/** `manual` prints in the list's own order; the others sort only the printout. */
export type SortOrder = 'manual' | 'az' | 'za'

/** A block's top-left corner on a page, mm from the sheet's edge. */
export type Position = { page: number; x: number; y: number }

export type Layout = {
  mode: LayoutMode
  columns: number
  flow: Flow
  /** `columns` flow: even out the columns' heights instead of filling each to the bottom. */
  balance: boolean
  /** Between columns and between rows, mm. */
  gapX: number
  gapY: number
  sort: SortOrder
  /** "1. Name" on a plain list. */
  numbering: boolean
  /** The table beside each name on a plain list, and on each place card. */
  showTable: boolean
  /** The guest's note on a place card. */
  showNote: boolean
  headerOnEveryPage: boolean
  /** Place cards, mm: one card's face. */
  cardWidth: number
  cardHeight: number
  /** Tent cards: the face is printed twice, mirrored, over a fold line. */
  cardFold: boolean
  /** Dashed cutting lines around cards. */
  cutMarks: boolean
  /** `free` mode. Keyed by block id: a guest, a table, or `HEADER_ID` / `FOOTER_ID`. */
  positions: Record<string, Position>
  /**
   * Blocks resized by hand, in any mode, keyed like `positions` (place cards share one size,
   * `cardWidth` × `cardHeight`, instead). See `Size`.
   */
  sizes: Record<string, Size>
}

/**
 * A resized block, mm. `w` is its width (its text re-wraps to it; a grid keeps it within its
 * column). `h` is a least height: a block is never shorter than its text needs.
 */
export type Size = { w: number; h: number }

export type ListDesign = {
  kind: PrintKind
  templateId: TemplateId
  /** Kept when the template changes: the user picks a shape and every template takes it. */
  shape: SheetShape
  paper: Paper
  palette: Palette
  type: Typography
  /** Multiplies every text size: an A2 poster wants bigger letters than an A4 sheet. */
  textScale: number
  tableStyle: TableStyle
  /** The template's ornaments and frames. */
  decor: boolean
  layout: Layout
}

export type ListDocument = {
  title: string
  content: ListContent
  design: ListDesign
}

export type GuestList = ListDocument & {
  id: string
  /** Set once billing is live and this list is paid for (`docs/BILLING.md`). */
  paidAt: string | null
  createdAt: string
  updatedAt: string
}

/** The id of a guest's local draft (`helpers/localDraft.ts`): it is not a server list. */
export const DRAFT_ID = 'draft'

/** Block ids of the sheet's header and footer in `layout.positions`. */
export const HEADER_ID = 'header'
export const FOOTER_ID = 'footer'

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error'

/** A row arriving from an import or a paste: the table by name, created when new. */
export type IncomingGuest = { name: string; table?: string; note?: string }

export type ImportMode = 'append' | 'replace'

/** A guest's cell changed in the spreadsheet: an existing guest (`id`) renamed, or a new one at a table. */
export type GuestEdit = { id: string; name: string } | { name: string; tableId: string }

/** A block pasted into the spreadsheet. */
export type SheetEdit = {
  guests: GuestEdit[]
  /** Renamed tables. */
  tables?: { id: string; name: string }[]
  /** Guests whose cell was emptied. */
  remove?: string[]
}

/** What the spreadsheet edits: the guests and the tables. */
export type SheetContent = Pick<ListContent, 'guests' | 'tables'>

export type ListEditorState = {
  listId: string | null
  doc: ListDocument | null
  paidAt: string | null
  saveStatus: SaveStatus
  past: ListDocument[]
  future: ListDocument[]
  lastEditKey: string | null
  lastEditAt: number
  /** Canvas blocks selected (guest, table, header, footer ids). */
  selection: string[]
} & StateCommonProps

export type ListEditorActions = {
  loadDocument: (args: { listId: string; doc: ListDocument; paidAt: string | null }) => void
  reset: () => void
  setSaveStatus: (status: SaveStatus) => void
  setPaidAt: (paidAt: string | null) => void
  setListId: (listId: string) => void
  undo: () => void
  redo: () => void

  setTitle: (title: string) => void
  setHeaderText: (field: 'heading' | 'subheading' | 'footer', value: string) => void

  addGuest: (name?: string, tableId?: string) => string
  addGuests: (rows: IncomingGuest[], mode: ImportMode) => void
  updateGuest: (guestId: string, patch: Partial<Omit<Guest, 'id'>>) => void
  removeGuests: (guestIds: string[]) => void
  /** Manual order: `guestId` goes before `beforeId` (or last when null). */
  moveGuest: (guestId: string, beforeId: string | null) => void
  /** A name dropped on a table (or on a name at one): its table and its place, one undo step. */
  seatGuest: (guestId: string, tableId: string, beforeId: string | null) => void
  /** Writes an order into the list itself. */
  sortGuests: (order: 'az' | 'za') => void
  /** Removes repeated names (same letters, case and spacing ignored); answers how many. */
  dedupeGuests: () => number
  clearGuests: () => void
  /** The spreadsheet's edits: guests changed, added and removed, tables renamed — one undo step. */
  /** The spreadsheet saved: its guests and tables replace the list's, in one undo step. */
  applySheet: (content: SheetContent) => void

  addTable: (name?: string) => string
  renameTable: (tableId: string, name: string) => void
  /** Its guests stay on the list, without a table. */
  removeTable: (tableId: string) => void
  moveTable: (tableId: string, beforeId: string | null) => void
  /** Guests without a table fill tables of `seats`, the existing ones first, new ones after. */
  autoSeat: (seats: number, tableName: (number: number) => string) => void

  setDesign: (patch: Partial<Pick<ListDesign, 'kind' | 'shape' | 'textScale' | 'tableStyle' | 'decor'>>) => void
  setPaper: (patch: Partial<Paper>) => void
  setPalette: (patch: Partial<Palette>) => void
  setTextStyle: (role: TextRole, patch: Partial<TextStyle>) => void
  setLayout: (patch: Partial<Omit<Layout, 'positions' | 'sizes'>>) => void
  /** The sheet fitted to its paper (`helpers/fitSheet`): columns and text size, back on the grid — one undo step. */
  fitToPage: (fit: { columns: number; textScale: number }) => void
  /** The template's look replaces the current one; the guests, tables and layout stay. */
  applyTemplate: (templateId: TemplateId) => void
  /** Puts `scope`'s settings back at the template's defaults, one undo step (`helpers/designReset`). */
  resetDesign: (scope: ResetScope) => void

  /** Free mode: blocks placed where they were dropped. One undo step per drag. */
  setPositions: (positions: Record<string, Position>) => void
  /** Every block back to its grid place. */
  resetPositions: (blockIds?: string[]) => void
  /** A block resized from its corner; one undo step per resize. */
  setSize: (blockId: string, size: Size) => void
  /** Blocks back to the size their column and text give them (all of them when no ids). */
  resetSizes: (blockIds?: string[]) => void

  select: (blockIds: string[]) => void
  toggleSelect: (blockId: string) => void
}
