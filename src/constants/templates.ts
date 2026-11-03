import type { FontSlug } from './fonts'

/**
 * The print designs. A template is a starting point, never a lock: it sets the palette, the
 * typography and the table style, and its decor (borders, ornaments, washes) is drawn by
 * `src/components/sheet/sheet.css` under `.sht-<id>`. Every value it sets stays editable.
 *
 * `free`: printable without paying once billing is switched on (`docs/BILLING.md`).
 *
 * Twin: `TEMPLATE_IDS` in `server/src/lib/catalogue.ts` (pinned by `twins.spec.ts`).
 */
export const TEMPLATE_IDS = [
  'classic',
  'minimal',
  'ivory',
  'ornament',
  'pomegranate',
  'botanical',
  'blush',
  'midnight',
  'deco',
  'bold',
  'kraft',
  'watercolor',
  'chalk',
  'pastel',
  'confetti',
  'vintage',
] as const

export type TemplateId = (typeof TEMPLATE_IDS)[number]

/** How a table's block is drawn on a seating board. Twin: `TABLE_STYLES` on the server. */
export const TABLE_STYLES = ['plain', 'underline', 'boxed', 'filled', 'ribbon', 'badge'] as const

export type TableStyle = (typeof TABLE_STYLES)[number]

export type TemplateCategory = 'classic' | 'elegant' | 'modern' | 'playful'

export type TemplatePalette = {
  /** The sheet. */
  background: string
  /** Decor, rules, table borders and badges. */
  accent: string
  /** A table block's fill (`filled`, `badge`). */
  panel: string
}

/** One text role's look in a template; sizes in points, as printed on A4. */
type RoleSpec = { font: FontSlug; size: number; color: string; bold?: boolean; italic?: boolean; uppercase?: boolean; tracking?: number }

export type TemplateMeta = {
  id: TemplateId
  category: TemplateCategory
  free: boolean
  palette: TemplatePalette
  heading: RoleSpec
  subheading: RoleSpec
  group: RoleSpec
  name: RoleSpec
  footer: RoleSpec
  tableStyle: TableStyle
}

const t = (meta: TemplateMeta): TemplateMeta => meta

export const TEMPLATES: Record<TemplateId, TemplateMeta> = {
  classic: t({
    id: 'classic',
    category: 'classic',
    free: true,
    palette: { background: '#ffffff', accent: '#1f1f1f', panel: '#f4f4f4' },
    heading: { font: 'ghea-grapalat', size: 28, color: '#111111', bold: true },
    subheading: { font: 'ghea-grapalat', size: 13, color: '#444444', italic: true },
    group: { font: 'ghea-grapalat', size: 13, color: '#111111', bold: true },
    name: { font: 'ghea-grapalat', size: 11, color: '#222222' },
    footer: { font: 'ghea-grapalat', size: 10, color: '#555555', italic: true },
    tableStyle: 'underline',
  }),
  minimal: t({
    id: 'minimal',
    category: 'modern',
    free: true,
    palette: { background: '#ffffff', accent: '#a3a3a3', panel: '#f5f5f5' },
    heading: { font: 'montserrat-armenian', size: 24, color: '#1d1d1d', uppercase: true, tracking: 18 },
    subheading: { font: 'mardoto', size: 11, color: '#6b6b6b', uppercase: true, tracking: 12 },
    group: { font: 'montserrat-armenian', size: 11, color: '#1d1d1d', bold: true, uppercase: true, tracking: 10 },
    name: { font: 'mardoto', size: 11, color: '#2b2b2b' },
    footer: { font: 'mardoto', size: 9, color: '#8a8a8a', uppercase: true, tracking: 12 },
    tableStyle: 'plain',
  }),
  ivory: t({
    id: 'ivory',
    category: 'elegant',
    free: false,
    palette: { background: '#fbf6ec', accent: '#b08d57', panel: '#f5ecdb' },
    heading: { font: 'emin-script', size: 40, color: '#8a6a3a' },
    subheading: { font: 'ghea-mariam', size: 13, color: '#6b5a45', italic: true },
    group: { font: 'ghea-mariam', size: 12, color: '#8a6a3a', bold: true, uppercase: true, tracking: 10 },
    name: { font: 'ghea-mariam', size: 11.5, color: '#3b3128' },
    footer: { font: 'ghea-mariam', size: 10, color: '#8a6a3a', italic: true },
    tableStyle: 'boxed',
  }),
  ornament: t({
    id: 'ornament',
    category: 'classic',
    free: false,
    palette: { background: '#fdf8f0', accent: '#8c1c2c', panel: '#f7e9e2' },
    heading: { font: 'vrdznagir', size: 36, color: '#8c1c2c' },
    subheading: { font: 'arian-amu', size: 13, color: '#5a3a2e', italic: true },
    group: { font: 'arian-amu', size: 12, color: '#ffffff', bold: true },
    name: { font: 'arian-amu', size: 11, color: '#2d1a12' },
    footer: { font: 'arian-amu', size: 10, color: '#8c1c2c', italic: true },
    tableStyle: 'ribbon',
  }),
  pomegranate: t({
    id: 'pomegranate',
    category: 'elegant',
    free: false,
    palette: { background: '#fffaf6', accent: '#a8233a', panel: '#fbe9e6' },
    heading: { font: 'tumanian-dzeragir', size: 36, color: '#9e1f32' },
    subheading: { font: 'noto-sans-armenian', size: 12, color: '#6a4a45' },
    group: { font: 'noto-sans-armenian', size: 12, color: '#9e1f32', bold: true },
    name: { font: 'noto-sans-armenian', size: 11, color: '#3a2422' },
    footer: { font: 'tumanian-dzeragir', size: 13, color: '#9e1f32' },
    tableStyle: 'filled',
  }),
  botanical: t({
    id: 'botanical',
    category: 'elegant',
    free: false,
    palette: { background: '#f7f9f4', accent: '#6f8f6a', panel: '#eaf0e6' },
    heading: { font: 'arm-hmks-script', size: 38, color: '#4e6b4a' },
    subheading: { font: 'ghea-grapalat', size: 12, color: '#5d6b58', italic: true },
    group: { font: 'ghea-grapalat', size: 12, color: '#4e6b4a', bold: true, uppercase: true, tracking: 8 },
    name: { font: 'ghea-grapalat', size: 11, color: '#2f3a2d' },
    footer: { font: 'arm-hmks-script', size: 16, color: '#4e6b4a' },
    tableStyle: 'plain',
  }),
  blush: t({
    id: 'blush',
    category: 'elegant',
    free: false,
    palette: { background: '#fff6f3', accent: '#d48a8f', panel: '#ffe9e5' },
    heading: { font: 'emin-script', size: 40, color: '#b5656b' },
    subheading: { font: 'shk-aida', size: 12, color: '#8a5a5c' },
    group: { font: 'shk-aida', size: 12, color: '#b5656b', bold: true },
    name: { font: 'shk-aida', size: 11, color: '#4a3436' },
    footer: { font: 'emin-script', size: 16, color: '#b5656b' },
    tableStyle: 'filled',
  }),
  midnight: t({
    id: 'midnight',
    category: 'elegant',
    free: false,
    palette: { background: '#14213d', accent: '#d4af37', panel: '#1c2c4f' },
    heading: { font: 'ghea-mariam', size: 30, color: '#e9cf7a', uppercase: true, tracking: 14 },
    subheading: { font: 'ghea-mariam', size: 12, color: '#cdbf9b', italic: true },
    group: { font: 'ghea-mariam', size: 12, color: '#d4af37', bold: true, uppercase: true, tracking: 10 },
    name: { font: 'ghea-mariam', size: 11, color: '#f3ead6' },
    footer: { font: 'ghea-mariam', size: 10, color: '#d4af37', italic: true },
    tableStyle: 'boxed',
  }),
  deco: t({
    id: 'deco',
    category: 'elegant',
    free: false,
    palette: { background: '#111111', accent: '#c9a54c', panel: '#1b1b1b' },
    heading: { font: 'arm-hmks-bebas-neue', size: 42, color: '#e2c675', tracking: 16 },
    subheading: { font: 'montserrat-armenian', size: 11, color: '#bfae7e', uppercase: true, tracking: 16 },
    group: { font: 'arm-hmks-bebas-neue', size: 16, color: '#111111', tracking: 6 },
    name: { font: 'montserrat-armenian', size: 10.5, color: '#f1f1f1' },
    footer: { font: 'montserrat-armenian', size: 9, color: '#c9a54c', uppercase: true, tracking: 16 },
    tableStyle: 'badge',
  }),
  bold: t({
    id: 'bold',
    category: 'modern',
    free: false,
    palette: { background: '#ffffff', accent: '#ff5a36', panel: '#fff0eb' },
    heading: { font: 'arm-hmks-bebas-neue', size: 52, color: '#111111', tracking: 4 },
    subheading: { font: 'montserrat-armenian', size: 12, color: '#ff5a36', bold: true, uppercase: true, tracking: 10 },
    group: { font: 'arm-hmks-bebas-neue', size: 20, color: '#ff5a36', tracking: 4 },
    name: { font: 'montserrat-armenian', size: 11, color: '#222222' },
    footer: { font: 'montserrat-armenian', size: 9, color: '#111111', bold: true, uppercase: true, tracking: 12 },
    tableStyle: 'underline',
  }),
  kraft: t({
    id: 'kraft',
    category: 'playful',
    free: false,
    palette: { background: '#d8b88e', accent: '#5b3a1e', panel: '#e6cda9' },
    heading: { font: 'tumanian-dzeragir', size: 38, color: '#3d2412' },
    subheading: { font: 'free-serif', size: 12, color: '#4b3020', italic: true },
    group: { font: 'free-serif', size: 13, color: '#3d2412', bold: true },
    name: { font: 'free-serif', size: 11.5, color: '#3d2412' },
    footer: { font: 'tumanian-dzeragir', size: 14, color: '#3d2412' },
    tableStyle: 'boxed',
  }),
  watercolor: t({
    id: 'watercolor',
    category: 'elegant',
    free: false,
    palette: { background: '#fbfdff', accent: '#6c9bc4', panel: '#eaf2fa' },
    heading: { font: 'emin-script', size: 40, color: '#3c6c96' },
    subheading: { font: 'gaa-gayane', size: 12, color: '#56708a' },
    group: { font: 'gaa-gayane', size: 12, color: '#3c6c96', bold: true },
    name: { font: 'gaa-gayane', size: 11, color: '#2c3e50' },
    footer: { font: 'emin-script', size: 16, color: '#3c6c96' },
    tableStyle: 'filled',
  }),
  chalk: t({
    id: 'chalk',
    category: 'playful',
    free: false,
    palette: { background: '#2b3133', accent: '#e8e4d8', panel: '#343b3e' },
    heading: { font: 'poqrik-dzeragir', size: 38, color: '#f5f2ea' },
    subheading: { font: 'tumanian-dzeragir', size: 14, color: '#d9d4c5' },
    group: { font: 'tumanian-dzeragir', size: 15, color: '#f5f2ea', bold: true },
    name: { font: 'tumanian-dzeragir', size: 13, color: '#ece8dc' },
    footer: { font: 'tumanian-dzeragir', size: 13, color: '#d9d4c5' },
    tableStyle: 'underline',
  }),
  pastel: t({
    id: 'pastel',
    category: 'playful',
    free: false,
    palette: { background: '#f4fbf8', accent: '#7cc4b2', panel: '#ffffff' },
    heading: { font: 'gaa-gayane', size: 30, color: '#3f8a78', bold: true },
    subheading: { font: 'gaa-gayane', size: 12, color: '#e08f6d' },
    group: { font: 'gaa-gayane', size: 12, color: '#3f8a78', bold: true },
    name: { font: 'gaa-gayane', size: 11, color: '#3b4a47' },
    footer: { font: 'gaa-gayane', size: 10, color: '#e08f6d' },
    tableStyle: 'filled',
  }),
  confetti: t({
    id: 'confetti',
    category: 'playful',
    free: false,
    palette: { background: '#ffffff', accent: '#7b5cff', panel: '#f3efff' },
    heading: { font: 'arm-hmks-bebas-neue', size: 46, color: '#2b2b2b', tracking: 6 },
    subheading: { font: 'montserrat-armenian', size: 12, color: '#7b5cff', bold: true },
    group: { font: 'arm-hmks-bebas-neue', size: 16, color: '#ffffff', tracking: 4 },
    name: { font: 'montserrat-armenian', size: 11, color: '#2b2b2b' },
    footer: { font: 'montserrat-armenian', size: 10, color: '#7b5cff', bold: true },
    tableStyle: 'badge',
  }),
  vintage: t({
    id: 'vintage',
    category: 'classic',
    free: false,
    palette: { background: '#f3ead8', accent: '#7a5c3a', panel: '#eadcc2' },
    heading: { font: 'ghea-mariam', size: 30, color: '#5a4128', italic: true },
    subheading: { font: 'ghea-mariam', size: 12, color: '#6e5638' },
    group: { font: 'ghea-mariam', size: 12.5, color: '#5a4128', bold: true },
    name: { font: 'ghea-mariam', size: 11, color: '#3e2d1c' },
    footer: { font: 'ghea-mariam', size: 10, color: '#6e5638', italic: true },
    tableStyle: 'underline',
  }),
}

export const TEMPLATE_LIST: TemplateMeta[] = TEMPLATE_IDS.map((id) => TEMPLATES[id])

export const DEFAULT_TEMPLATE_ID: TemplateId = 'ivory'

/** The design a free print uses when billing is on and the chosen template is not free. */
export const FREE_TEMPLATE_ID: TemplateId = 'classic'

export const isTemplateId = (value: unknown): value is TemplateId =>
  typeof value === 'string' && (TEMPLATE_IDS as readonly string[]).includes(value)

export const isTableStyle = (value: unknown): value is TableStyle =>
  typeof value === 'string' && (TABLE_STYLES as readonly string[]).includes(value)
