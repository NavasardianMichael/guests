import { harsaniq } from './examples/harsaniq'
import { hobelyan } from './examples/hobelyan'
import { knunq } from './examples/knunq'
import { korporativ } from './examples/korporativ'
import { nshandreq } from './examples/nshandreq'
import { tsnund } from './examples/tsnund'
import { anvanaqarter } from './guides/anvanaqarter'
import { hyureriNstetsum } from './guides/hyureri-nstetsum'
import { hyureriTsutsakHartser } from './guides/hyureri-tsutsak-hartser'
import { inchpesKazmelHyureriTsutsak } from './guides/inchpes-kazmel-hyureri-tsutsak'
import { nstategheriTsutsanak } from './guides/nstategheri-tsutsanak'
import { srahiHatakagits } from './guides/srahi-hatakagits'
import type { ContentSection, ContentVideo, EventExample, FaqItem, Guide } from './types'

/**
 * Every article and event example, in the order the hubs list them. Adding a page: a file named
 * after its slug in `guides/` or `examples/`, a line here, then `pnpm test` — the content tests
 * check the rest (an example also needs its picture: `pnpm content:images`). A push that changes
 * only `src/content/**` and `public/content/**` deploys through `.github/workflows/content.yml`
 * (docs/DEPLOYMENT.md, "Content").
 */
export const GUIDES: Guide[] = [
  inchpesKazmelHyureriTsutsak,
  hyureriNstetsum,
  nstategheriTsutsanak,
  anvanaqarter,
  srahiHatakagits,
  hyureriTsutsakHartser,
]

export const EVENT_EXAMPLES: EventExample[] = [harsaniq, knunq, nshandreq, tsnund, hobelyan, korporativ]

export const findGuide = (slug: unknown): Guide | undefined => GUIDES.find((guide) => guide.slug === slug)

export const findExample = (slug: unknown): EventExample | undefined => EVENT_EXAMPLES.find((example) => example.slug === slug)

/** In the given order, unknown slugs left out. */
export const guidesBySlug = (slugs: string[]): Guide[] => slugs.flatMap((slug) => findGuide(slug) ?? [])
export const examplesBySlug = (slugs: string[]): EventExample[] => slugs.flatMap((slug) => findExample(slug) ?? [])

/** A section's text, heading included: reading time and the content tests. */
export const sectionTexts = (section: ContentSection): string[] => [
  section.heading,
  ...section.blocks.flatMap((block) => {
    switch (block.kind) {
      case 'p':
      case 'tip':
        return [block.text]
      case 'list':
        return block.items
      case 'compare':
        return [block.weak, block.strong]
      case 'sample':
        return [block.label, block.text]
    }
  }),
]

/** Armenian words read slower than English ones: ~160 a minute. */
const WORDS_PER_MINUTE = 160

export const readingMinutes = (page: { intro: string[]; sections: ContentSection[]; faq: FaqItem[] }): number => {
  const text = [...page.intro, ...page.sections.flatMap(sectionTexts), ...page.faq.flatMap((item) => [item.question, item.answer])].join(' ')
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE))
}

/** A content video's files, served from `public/`. */
export const videoFiles = (video: ContentVideo): { src: string; poster: string; captions: string } => ({
  src: `/content/video/${video.file}.mp4`,
  poster: `/content/video/${video.file}.jpg`,
  captions: `/content/video/${video.file}.vtt`,
})

/** Every prose field of a page, for the content tests. */
export const pageTexts = (page: Guide | EventExample): string[] => [
  ...('video' in page && page.video ? [page.video.title, page.video.description] : []),
  page.title,
  page.shortTitle,
  page.metaTitle,
  page.description,
  ...page.intro,
  ...page.sections.flatMap(sectionTexts),
  ...page.faq.flatMap((item) => [item.question, item.answer]),
]
