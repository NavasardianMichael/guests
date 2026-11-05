/**
 * What a list may name: templates, table styles, fonts, paper. Import-free, so
 * `tests/unit/server/twins.spec.ts` can pin each list against the web's own
 * (`src/constants/templates.ts`, `fonts.ts`, `paper.ts`, `src/store/lists/single/types.ts`).
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

/** Printable without paying once billing is on (`docs/BILLING.md`). Twin: `free` in the web's templates. */
export const FREE_TEMPLATE_IDS: readonly TemplateId[] = ['classic', 'minimal']

export const DEFAULT_TEMPLATE_ID: TemplateId = 'ivory'

export const TABLE_STYLES = ['plain', 'underline', 'boxed', 'filled', 'ribbon', 'badge'] as const

export const PRINT_KINDS = ['seating', 'list', 'cards'] as const

export const TEXT_ROLES = ['heading', 'subheading', 'group', 'name', 'footer'] as const

export const PAPER_FORMATS = ['A5', 'A4', 'A3', 'A2', 'letter', 'legal', 'custom'] as const

export const PAPER_SIZES: Record<Exclude<(typeof PAPER_FORMATS)[number], 'custom'>, { width: number; height: number }> = {
  A5: { width: 148, height: 210 },
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  letter: { width: 215.9, height: 279.4 },
  legal: { width: 215.9, height: 355.6 },
}

export const PAPER_LIMITS = {
  minSide: 50,
  maxSide: 1189,
  minMargin: 0,
  maxMargin: 60,
} as const

export const FONT_SLUGS = [
  'ghea-grapalat',
  'vrdznagir',
  'arm-hmks-bebas-neue',
  'montserrat-armenian',
  'tumanian-dzeragir',
  'braind-amanor',
  'artsakh',
  'davel-aghvor',
  'free-sans',
  'poqrik-dzeragir',
  'mardoto',
  'arian-amu',
  'free-serif',
  'nasa-font',
  'arti',
  '90',
  'reactive',
  'gaa-gayane',
  'braind-yerevan',
  'amar',
  'braind-republic',
  'shk-aida',
  'kotayk',
  'calama-condensed',
  'cosiarm',
  'ghea-mariam',
  'braind-doctor',
  'berd',
  'arian-grqi',
  'atyan-dsegh',
  'bainsley',
  'braind-zbans',
  'noto-sans-armenian',
  'nortar-body',
  'arm-hmks-script',
  'emin-script',
  'kamavor-na',
  'bokonique',
  'braind-gyumri',
  'noyemi',
] as const


export type FontSlug = (typeof FONT_SLUGS)[number]
