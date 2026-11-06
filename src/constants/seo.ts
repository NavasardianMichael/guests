/**
 * What people type to find this. Pages are indexed in Armenian; the Russian and English
 * phrasings live in metadata: the `keywords` meta (a weak signal for some search engines,
 * ignored by Google), the JSON-LD `keywords` / `alternateName`, and `/llms.txt`, which answer engines
 * read.
 */
export const KEYWORDS_HY = [
  'հյուրերի ցուցակ',
  'հյուրերի նստեցում',
  'նստատեղերի պլան',
  'նստատեղերի ցուցանակ',
  'սեղանների դասավորություն',
  'հարսանիքի հյուրերի ցուցակ',
  'անվանաքարտ',
  'սեղանի քարտ',
  'հրավիրյալների ցուցակ',
  'հարսանիք',
  'կնունք',
]

export const KEYWORDS_EN = [
  'guest list maker',
  'seating chart maker',
  'wedding seating chart Armenia',
  'place cards printable',
  'table plan',
  'Armenian wedding',
]

export const KEYWORDS_RU = [
  'список гостей',
  'рассадка гостей',
  'план рассадки гостей на свадьбу',
  'карточки рассадки',
  'свадьба в Армении',
  'список гостей на армянском',
]

export const SEARCH_KEYWORDS = [...KEYWORDS_HY, ...KEYWORDS_EN, ...KEYWORDS_RU]

/** The service's name as an English or Russian speaker would put it. */
export const ALTERNATE_NAMES = ['Guests', 'Guest list & seating chart', 'Список гостей и рассадка']

/**
 * Google Search Console ownership tag, inlined at build time and left out when empty. A DNS
 * TXT record verifies the same ownership without it (docs/PRODUCTION_SETUP.md).
 */
export const SITE_VERIFICATION = {
  google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? '',
}
