import type {
  Align,
  Guest,
  GuestTable,
  Layout,
  ListContent,
  ListDesign,
  ListDocument,
  Paper,
  Plan,
  PlanArrangement,
  PrintKind,
  SheetShape,
  TableShape,
  TextRole,
  TextStyle,
  Typography,
  VenueItem,
  VenueKind,
} from '@store/lists/single/types'
import { PAPER_SIZES } from '@constants/paper'
import { type TemplateId, TEMPLATES } from '@constants/templates'

/** A list without a name. Twin: `DEFAULT_LIST_TITLE` in `server/src/services/listDocument.ts`. */
export const DEFAULT_LIST_TITLE = 'Հյուրերի ցուցակ'

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** Ten random characters: unique within a list, short enough to keep the document small. */
export const newId = (): string => {
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('')
}

export const newGuest = (name = '', tableId = '', note = ''): Guest => ({ id: newId(), name, tableId, note })

export const newTable = (name: string, shape: TableShape = 'round', seats = 0): GuestTable => ({ id: newId(), name, shape, seats })

export const newVenueItem = (kind: VenueKind, label: string): VenueItem => ({ id: newId(), kind, label })

/** How each kind lays out by default; switching kind applies these. */
export const KIND_LAYOUT: Record<PrintKind, Pick<Layout, 'columns' | 'flow' | 'gapX' | 'gapY' | 'balance'>> = {
  seating: { columns: 3, flow: 'rows', gapX: 8, gapY: 8, balance: true },
  list: { columns: 3, flow: 'columns', gapX: 8, gapY: 1.5, balance: true },
  cards: { columns: 2, flow: 'rows', gapX: 0, gapY: 0, balance: false },
  // The hall plan places its tables itself (`layoutSheet`); its gaps space them apart.
  plan: { columns: 3, flow: 'rows', gapX: 10, gapY: 10, balance: false },
}

/** Text alignment per kind: a seating board centres its names, a plain list starts them left. */
export const KIND_ALIGN: Record<PrintKind, Record<TextRole, Align>> = {
  seating: { heading: 'center', subheading: 'center', group: 'center', name: 'center', footer: 'center' },
  list: { heading: 'center', subheading: 'center', group: 'left', name: 'left', footer: 'center' },
  cards: { heading: 'center', subheading: 'center', group: 'center', name: 'center', footer: 'center' },
  plan: { heading: 'center', subheading: 'center', group: 'center', name: 'center', footer: 'center' },
}

export const defaultLayout = (kind: PrintKind): Layout => ({
  mode: 'grid',
  ...KIND_LAYOUT[kind],
  sort: 'manual',
  numbering: false,
  showTable: true,
  showNote: false,
  headerOnEveryPage: false,
  cardWidth: 90,
  cardHeight: 50,
  cardFold: false,
  cutMarks: true,
  positions: {},
  sizes: {},
})

export const defaultPaper = (kind?: PrintKind): Paper => ({
  format: 'A4',
  ...PAPER_SIZES.A4,
  // A hall is wider than it is deep.
  orientation: kind === 'plan' ? 'landscape' : 'portrait',
  margin: 15,
})

/** A template's typography, aligned for `kind`. */
export const templateTypography = (templateId: TemplateId, kind: PrintKind): Typography => {
  const template = TEMPLATES[templateId]
  const role = (name: TextRole): TextStyle => {
    const spec = template[name]
    return {
      font: spec.font,
      size: spec.size,
      color: spec.color,
      bold: Boolean(spec.bold),
      italic: Boolean(spec.italic),
      uppercase: Boolean(spec.uppercase),
      tracking: spec.tracking ?? 0,
      align: KIND_ALIGN[kind][name],
    }
  }
  return {
    heading: role('heading'),
    subheading: role('subheading'),
    group: role('group'),
    name: role('name'),
    footer: role('footer'),
  }
}

/**
 * `design` restyled in another template: its colours, fonts, table style and decor, keeping the
 * kind, shape, layout, paper and each text's alignment. What the editor's template choice does
 * (`applyTemplate`), and what the checkout previews for the free template.
 */
export const designInTemplate = (design: ListDesign, templateId: TemplateId): ListDesign => {
  const type = templateTypography(templateId, design.kind)
  for (const role of Object.keys(type) as TextRole[]) type[role].align = design.type[role].align
  return {
    ...design,
    templateId,
    palette: { ...TEMPLATES[templateId].palette },
    type,
    tableStyle: TEMPLATES[templateId].tableStyle,
    decor: true,
  }
}

/** A hall plan nobody has arranged: set out in rows, nothing placed or sized by hand. */
export const emptyPlan = (arrangement: PlanArrangement = 'rows'): Plan => ({ arrangement, positions: {}, sizes: {} })

/** The table shape a preset calls for: round round the dance floor, long in banquet rows; the others keep each table's own. */
export const ARRANGEMENT_SHAPE: Partial<Record<PlanArrangement, TableShape>> = { around: 'round', banquet: 'rect' }

/** In place (an immer draft, or a copy): the hall set out by `arrangement`, nothing placed by hand, the tables in its shape. */
export const arrange = (doc: ListDocument, arrangement: PlanArrangement): void => {
  doc.design.plan.arrangement = arrangement
  doc.design.plan.positions = {}
  const shape = ARRANGEMENT_SHAPE[arrangement]
  if (shape) for (const table of doc.content.tables) table.shape = shape
}

/** `doc` as `arrange` would leave it; `doc` itself is left alone. */
export const withArrangement = (doc: ListDocument, arrangement: PlanArrangement): ListDocument => {
  const next = structuredClone(doc)
  arrange(next, arrangement)
  return next
}

export const templateDesign = (templateId: TemplateId, kind: PrintKind = 'seating', shape: SheetShape = 'rectangle'): ListDesign => ({
  kind,
  templateId,
  shape,
  paper: defaultPaper(kind),
  palette: { ...TEMPLATES[templateId].palette },
  type: templateTypography(templateId, kind),
  textScale: 1,
  tableStyle: TEMPLATES[templateId].tableStyle,
  decor: true,
  layout: defaultLayout(kind),
  plan: emptyPlan(),
})

/** The words a sample list is written in; the caller translates them (`Samples.*`). */
export type SampleTexts = {
  heading: string
  subheading: string
  footer: string
  /** "Table {number}" with the number already in. */
  table: (number: number) => string
  /** The hall plan's items, named: "Stage", "Dance floor", "Entrance". */
  venue: Record<VenueKind, string>
}

/** Armenian names for every locale: the product is for Armenian events, and they show off the fonts. */
const SAMPLE_GUESTS: string[][] = [
  ['Արամ Պետրոսյան', 'Անի Պետրոսյան', 'Գագիկ Սարգսյան', 'Լիլիթ Սարգսյան', 'Վահե Հակոբյան', 'Մարիամ Հակոբյան'],
  ['Տիգրան Մանուկյան', 'Նարե Մանուկյան', 'Սուրեն Գրիգորյան', 'Աննա Գրիգորյան', 'Դավիթ Ավետիսյան', 'Սոնա Ավետիսյան', 'Հայկ Վարդանյան'],
  ['Կարեն Մկրտչյան', 'Գոհար Մկրտչյան', 'Արմեն Խաչատրյան', 'Էլեն Խաչատրյան', 'Նարեկ Հովհաննիսյան', 'Մանե Հովհաննիսյան'],
  ['Ռուբեն Ղազարյան', 'Թամարա Ղազարյան', 'Սամվել Առաքելյան', 'Ռուզաննա Առաքելյան', 'Էդգար Մելքոնյան', 'Լուսինե Մելքոնյան', 'Արթուր Բաղդասարյան'],
  ['Գևորգ Սիմոնյան', 'Զարուհի Սիմոնյան', 'Վարդան Ներսիսյան', 'Հասմիկ Ներսիսյան', 'Արսեն Թորոսյան', 'Կարինե Թորոսյան'],
  ['Միքայել Զաքարյան', 'Սյուզաննա Զաքարյան', 'Հրանտ Եղիազարյան', 'Արփի Եղիազարյան', 'Լևոն Դանիելյան', 'Մարինե Դանիելյան'],
]

/**
 * A wedding's guests at six tables, in a hall with a stage, a dance floor and an entrance:
 * what previews show and what a new list starts with (only the hall plan shows the hall).
 */
export const sampleContent = (texts: SampleTexts, tableCount = SAMPLE_GUESTS.length): ListContent => {
  const tables: GuestTable[] = []
  const guests: Guest[] = []
  SAMPLE_GUESTS.slice(0, tableCount).forEach((names, index) => {
    const table = newTable(texts.table(index + 1))
    tables.push(table)
    for (const name of names) guests.push(newGuest(name, table.id))
  })
  const venue = (['stage', 'dancefloor', 'entrance'] as const).map((kind) => newVenueItem(kind, texts.venue[kind]))
  return { heading: texts.heading, subheading: texts.subheading, footer: texts.footer, guests, tables, venue }
}

/**
 * A document saved before the hall plan (a draft in this browser; the API fills the same
 * fields itself): tables get a shape and chairs, the list a hall and a plan.
 */
export const withPlanFields = (doc: ListDocument): ListDocument => {
  const content: Partial<Pick<ListContent, 'venue'>> = doc.content
  const design: Partial<Pick<ListDesign, 'plan'>> = doc.design
  const tables: Partial<GuestTable>[] = doc.content.tables
  if (content.venue && design.plan?.arrangement && tables.every((table) => table.shape && typeof table.seats === 'number')) return doc
  return {
    ...doc,
    content: {
      ...doc.content,
      tables: doc.content.tables.map((table) => ({ ...table, shape: table.shape ?? 'round', seats: table.seats ?? 0 })),
      venue: content.venue ?? [],
    },
    design: { ...doc.design, plan: { ...emptyPlan(), ...design.plan } },
  }
}

/**
 * A new list starts with the sample wedding as its own guests and tables — real data, so every
 * step shows the look on names and the user edits, removes or replaces them in place. Place
 * cards get two tables: a card per guest would otherwise run to several pages.
 */
export const newListDocument = (
  templateId: TemplateId,
  kind: PrintKind,
  options: { title: string; texts: SampleTexts; shape?: SheetShape }
): ListDocument => ({
  title: options.title.trim() || DEFAULT_LIST_TITLE,
  content: sampleContent(options.texts, kind === 'cards' ? 2 : undefined),
  design: templateDesign(templateId, kind, options.shape),
})
