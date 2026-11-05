/**
 * The forty Armenian fonts a sheet can use, self-hosted from `public/fonts/` (woff2, subset to
 * Latin, Cyrillic and Armenian by `scripts/fonts/build_fonts.py`). Source: fonter.am's most
 * popular list, keeping only fonts whose own page there says "free for commercial or personal
 * use" — see `public/fonts/LICENSES.md`.
 *
 * Twin: `FONT_SLUGS` in `server/src/lib/catalogue.ts` (pinned by `twins.spec.ts`).
 */
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

export type FontCategory = 'sans' | 'serif' | 'display' | 'script'

export type FontMeta = {
  slug: FontSlug
  name: string
  author: string
  category: FontCategory
  /** Weights shipped. A heading asks for 700; the browser synthesises bold where absent. */
  weights: number[]
  italic: boolean
  /** Has its own Latin letters (emails, URLs). Others fall back per glyph to Mardoto. */
  latin: boolean
}

export const FONTS: Record<FontSlug, FontMeta> = {
  'ghea-grapalat': { slug: 'ghea-grapalat', name: 'GHEA Grapalat', author: 'Էդիկ Ղաբուզյան', category: 'serif', weights: [400, 700], italic: true, latin: true },
  vrdznagir: { slug: 'vrdznagir', name: 'Vrdznagir', author: 'Levon Chkolyan', category: 'script', weights: [400], italic: false, latin: false },
  'arm-hmks-bebas-neue': { slug: 'arm-hmks-bebas-neue', name: "Arm Hmk's Bebas Neue", author: 'Hamik Mayilyan, Ryoichi Tsunekawa', category: 'display', weights: [400], italic: false, latin: true },
  'montserrat-armenian': { slug: 'montserrat-armenian', name: 'Montserrat Armenian', author: 'Vahan Hovhannisyan', category: 'sans', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: false, latin: true },
  'tumanian-dzeragir': { slug: 'tumanian-dzeragir', name: "Tumanian's Handwriting", author: 'Ruben Tarumian', category: 'script', weights: [400], italic: false, latin: true },
  'braind-amanor': { slug: 'braind-amanor', name: 'Braind Amanor', author: 'Էդուարդ Քանքանյան', category: 'display', weights: [400], italic: false, latin: false },
  artsakh: { slug: 'artsakh', name: 'Artsakh', author: 'Sargis Qalajyan, Narek Tsarukyan', category: 'display', weights: [400], italic: false, latin: false },
  'davel-aghvor': { slug: 'davel-aghvor', name: 'Davel Aghvor', author: 'Levon Chkolyan', category: 'display', weights: [400], italic: false, latin: false },
  'free-sans': { slug: 'free-sans', name: 'Free Sans', author: 'GNU FreeFont', category: 'sans', weights: [400, 700], italic: true, latin: true },
  'poqrik-dzeragir': { slug: 'poqrik-dzeragir', name: 'Poqrik dzeragir', author: 'poqrik.am', category: 'script', weights: [400], italic: false, latin: false },
  mardoto: { slug: 'mardoto', name: 'Mardoto', author: 'Christian Robertson, Vahan Hovhannisyan', category: 'sans', weights: [100, 300, 400, 500, 700, 900], italic: true, latin: true },
  'arian-amu': { slug: 'arian-amu', name: 'Arian AMU', author: 'Ruben Tarumian', category: 'sans', weights: [400, 700], italic: true, latin: true },
  'free-serif': { slug: 'free-serif', name: 'Free Serif', author: 'GNU FreeFont', category: 'serif', weights: [400, 700], italic: true, latin: true },
  'nasa-font': { slug: 'nasa-font', name: 'NASA Font', author: 'Narek Tsarukyan, Sargis Qalajyan', category: 'display', weights: [400], italic: false, latin: false },
  arti: { slug: 'arti', name: 'Arti', author: 'Համազգային հայ կրթական և մշակութային միություն', category: 'script', weights: [400], italic: false, latin: false },
  '90': { slug: '90', name: '90', author: 'Levon Chkolyan', category: 'display', weights: [400], italic: false, latin: false },
  reactive: { slug: 'reactive', name: 'Reactive', author: 'Mariam Hovhannesyan', category: 'display', weights: [400], italic: false, latin: false },
  'gaa-gayane': { slug: 'gaa-gayane', name: 'GAA Gayane', author: 'Gayane Andreasyan', category: 'sans', weights: [400, 500, 600, 700, 800], italic: true, latin: true },
  'braind-yerevan': { slug: 'braind-yerevan', name: 'Braind Yerevan', author: 'Էդուարդ Քանքանյան', category: 'sans', weights: [400], italic: false, latin: true },
  amar: { slug: 'amar', name: 'Amar', author: 'VooDoo Marketing', category: 'display', weights: [400], italic: false, latin: false },
  'braind-republic': { slug: 'braind-republic', name: 'Braind Republic', author: 'Braind', category: 'sans', weights: [400], italic: false, latin: true },
  'shk-aida': { slug: 'shk-aida', name: 'SHK Aida', author: 'Syuzi Hakobyan', category: 'sans', weights: [200, 300, 400, 500, 600, 700], italic: true, latin: true },
  kotayk: { slug: 'kotayk', name: 'Kotayk', author: 'Janik Simonyan', category: 'display', weights: [400], italic: true, latin: false },
  'calama-condensed': { slug: 'calama-condensed', name: 'Calama Condensed', author: 'Ben Karamyan', category: 'sans', weights: [400], italic: false, latin: true },
  cosiarm: { slug: 'cosiarm', name: 'CosiArm', author: 'Karlen Avetisyan', category: 'display', weights: [400], italic: false, latin: false },
  'ghea-mariam': { slug: 'ghea-mariam', name: 'GHEA Mariam', author: 'Edik Ghabuzian', category: 'serif', weights: [400, 700], italic: true, latin: true },
  'braind-doctor': { slug: 'braind-doctor', name: 'Braind Doctor', author: 'Բրեինդ', category: 'script', weights: [400], italic: false, latin: false },
  berd: { slug: 'berd', name: 'BERD', author: 'Zakar Kerdikoshvili', category: 'display', weights: [400], italic: false, latin: false },
  'arian-grqi': { slug: 'arian-grqi', name: 'Arian Grqi', author: 'Ruben Tarumian', category: 'serif', weights: [400], italic: true, latin: true },
  'atyan-dsegh': { slug: 'atyan-dsegh', name: 'Atyan Dsegh', author: 'Atyan design', category: 'sans', weights: [400], italic: false, latin: true },
  bainsley: { slug: 'bainsley', name: 'Bainsley', author: 'Paul James Miller', category: 'sans', weights: [400, 700], italic: true, latin: true },
  'braind-zbans': { slug: 'braind-zbans', name: 'Braind Zbans', author: 'Էդուարդ Քանքանյան', category: 'serif', weights: [400], italic: false, latin: false },
  'noto-sans-armenian': { slug: 'noto-sans-armenian', name: 'Noto Sans Armenian', author: 'Google Inc, Monotype Inc', category: 'sans', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], italic: false, latin: false },
  'nortar-body': { slug: 'nortar-body', name: 'Nortar Body', author: 'Vardan Ohanian', category: 'display', weights: [400], italic: false, latin: false },
  'arm-hmks-script': { slug: 'arm-hmks-script', name: "Arm Hmk's Script", author: 'Hamik Mayilyan', category: 'script', weights: [400], italic: false, latin: true },
  'emin-script': { slug: 'emin-script', name: 'Emin Script', author: 'Ruben Tarumian', category: 'script', weights: [400], italic: false, latin: true },
  'kamavor-na': { slug: 'kamavor-na', name: 'Kamavor-NA', author: 'Narek Asryan', category: 'script', weights: [400], italic: false, latin: false },
  bokonique: { slug: 'bokonique', name: 'Bokonique', author: 'Renderforest', category: 'sans', weights: [300, 400, 700], italic: true, latin: true },
  'braind-gyumri': { slug: 'braind-gyumri', name: 'Braind Gyumri', author: 'Էդուարդ Քանքանյան', category: 'sans', weights: [400], italic: false, latin: true },
  noyemi: { slug: 'noyemi', name: 'Noyemi', author: 'Narek Tsarukyan', category: 'display', weights: [400], italic: false, latin: false },
}

export const FONT_CATEGORY_ORDER: FontCategory[] = ['sans', 'serif', 'display', 'script']

/** The `@font-face` family `scripts/fonts/build-css.mjs` declares for a slug. */
export const sheetFontFamily = (slug: FontSlug): string => `'sf-${slug}'`

/** A full stack: the chosen face, then Mardoto for glyphs it lacks (Latin, digits). */
export const sheetFontStack = (slug: FontSlug): string => `${sheetFontFamily(slug)}, 'sf-mardoto', 'sf-free-sans', sans-serif`

/** Where every face in the catalogue comes from; credited in the footer. */
export const FONTS_SOURCE_URL = 'https://fonter.am'

/** The face's own (Armenian) page on fonter.am; every slug here is that page's slug. */
export const fontSourceUrl = (slug: FontSlug): string => `${FONTS_SOURCE_URL}/hy/fonts/${slug}`

/** Served by Next from `public/`; linked only by pages that draw sheets. */
export const SHEET_FONTS_STYLESHEET = '/fonts/sheet-fonts.css'
