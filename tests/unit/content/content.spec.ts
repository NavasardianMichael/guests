import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { examplePath, guidePath, ROUTES, templatePath } from '@constants/routes'
import { TEMPLATE_IDS } from '@constants/templates'
import { ABOUT } from '@content/about'
import { exampleDocument } from '@content/exampleDocument'
import { exampleImageEntry } from '@content/exampleImages'
import { EVENT_EXAMPLES, GUIDES, pageTexts, sectionTexts, videoFiles } from '@content/index'
import type { EventExample, Guide } from '@content/types'
import { inlineLinks } from '@helpers/inlineMarkup'
import { fingerprint } from '../../../scripts/content/example-images.mjs'
import { coerceContent, coerceDesign } from '../../../server/src/services/listDocument'

/**
 * The content pipeline's gate (`.github/workflows/content.yml`): what a page needs to be
 * served, found and read — and the Armenian punctuation slips that are easiest to type.
 */

const PAGES: (Guide | EventExample)[] = [...GUIDES, ...EVENT_EXAMPLES]

const aboutTexts = (): string[] => [ABOUT.title, ABOUT.metaTitle, ABOUT.description, ...ABOUT.intro, ...ABOUT.sections.flatMap(sectionTexts)]
const label = (page: Guide | EventExample): string => page.slug

const ARMENIAN_LETTER = 'Ա-և'

/** Paths a content link may point at: public pages only. */
const LINKABLE = new Set<string>([
  ROUTES.home,
  ROUTES.templates,
  ROUTES.pricing,
  ROUTES.contact,
  ROUTES.about,
  ROUTES.privacy,
  ROUTES.terms,
  ROUTES.refundPolicy,
  ROUTES.guides,
  ROUTES.examples,
  ...GUIDES.map((guide) => guidePath(guide.slug)),
  ...EVENT_EXAMPLES.map((example) => examplePath(example.slug)),
  ...TEMPLATE_IDS.map((id) => templatePath(id)),
])

/** Lowercase Latin, digits, single dashes between. */
const isSlug = (value: string): boolean => /^[a-z0-9-]+$/.test(value) && !/^-|-$|--/.test(value)

/** Outside sources a page may cite (opened in a new tab): https only, these hosts only. */
const TRUSTED_HOSTS = new Set(['fonter.am'])

const isAllowedLink = (href: string): boolean => {
  if (href.startsWith('/')) return LINKABLE.has(href)
  try {
    const url = new URL(href)
    return url.protocol === 'https:' && TRUSTED_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

const fileSlugs = (folder: string): string[] =>
  readdirSync(path.join(process.cwd(), 'src/content', folder))
    .filter((name) => name.endsWith('.ts'))
    .map((name) => name.replace(/\.ts$/, ''))
    .sort()

describe('content registry', () => {
  it('lists every file once, under its own slug', () => {
    expect(GUIDES.map((guide) => guide.slug).sort()).toEqual(fileSlugs('guides'))
    expect(EVENT_EXAMPLES.map((example) => example.slug).sort()).toEqual(fileSlugs('examples'))
  })

  it('gives every page a URL-safe slug', () => {
    for (const page of PAGES) expect(isSlug(page.slug), label(page)).toBe(true)
  })

  it('links every page from at least one other page', () => {
    const linked = new Set([
      ...GUIDES.flatMap((guide) => [...guide.related, ...guide.relatedExamples]),
      ...EVENT_EXAMPLES.flatMap((example) => [...example.related, ...example.relatedGuides]),
    ])
    for (const page of PAGES) expect(linked.has(page.slug), `${label(page)} is linked from no page`).toBe(true)
  })

  it('relates only to pages that exist, never to itself, three of each', () => {
    const guides = new Set(GUIDES.map((guide) => guide.slug))
    const examples = new Set(EVENT_EXAMPLES.map((example) => example.slug))
    for (const guide of GUIDES) {
      expect(guide.related.length, `${guide.slug} related`).toBeGreaterThanOrEqual(3)
      expect(guide.relatedExamples.length, `${guide.slug} relatedExamples`).toBeGreaterThanOrEqual(3)
      for (const slug of guide.related) expect(guides.has(slug) && slug !== guide.slug, `${guide.slug} → ${slug}`).toBe(true)
      for (const slug of guide.relatedExamples) expect(examples.has(slug), `${guide.slug} → ${slug}`).toBe(true)
    }
    for (const example of EVENT_EXAMPLES) {
      expect(example.related.length, `${example.slug} related`).toBeGreaterThanOrEqual(3)
      expect(example.relatedGuides.length, `${example.slug} relatedGuides`).toBeGreaterThanOrEqual(3)
      for (const slug of example.related) expect(examples.has(slug) && slug !== example.slug, `${example.slug} → ${slug}`).toBe(true)
      for (const slug of example.relatedGuides) expect(guides.has(slug), `${example.slug} → ${slug}`).toBe(true)
    }
  })
})

describe('search metadata', () => {
  it('keeps titles and descriptions within what results show', () => {
    for (const page of PAGES) {
      expect(page.metaTitle.length, `${label(page)} metaTitle`).toBeLessThanOrEqual(65)
      expect(page.title.length, `${label(page)} title (Article headline)`).toBeLessThanOrEqual(110)
      expect(page.description.length, `${label(page)} description`).toBeGreaterThanOrEqual(110)
      expect(page.description.length, `${label(page)} description`).toBeLessThanOrEqual(160)
    }
  })

  it('gives every page a unique title and description', () => {
    for (const field of ['title', 'metaTitle', 'description'] as const) {
      const values = PAGES.map((page) => page[field])
      expect(new Set(values).size, field).toBe(values.length)
    }
  })

  it('names Latin-lettered searches on every page', () => {
    for (const page of PAGES) {
      expect(page.searchTerms.some((term) => /^[a-z0-9 -]+$/.test(term)), label(page)).toBe(true)
      expect(page.latinTitle, label(page)).toMatch(/^[\x20-\x7E—]+$/)
    }
  })

  it('dates every page, never updated before it was published', () => {
    for (const page of PAGES) {
      expect(page.published, label(page)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(page.updated, label(page)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(page.updated >= page.published, label(page)).toBe(true)
    }
  })
})

describe('page structure', () => {
  it('anchors sections uniquely, leaving `hartser` to the questions', () => {
    for (const page of PAGES) {
      const ids = page.sections.map((section) => section.id)
      expect(new Set(ids).size, label(page)).toBe(ids.length)
      for (const id of ids) {
        expect(isSlug(id), `${label(page)} #${id}`).toBe(true)
        expect(id, label(page)).not.toBe('hartser')
      }
    }
  })

  it('has a body: sections, or a page of questions', () => {
    for (const page of PAGES) {
      expect(page.intro.length, label(page)).toBeGreaterThan(0)
      expect(page.sections.length >= 3 || page.faq.length >= 8, label(page)).toBe(true)
    }
  })

  it('links only to public pages of this site and to trusted sources', () => {
    const about = { slug: 'about', texts: aboutTexts() }
    for (const { slug, texts } of [...PAGES.map((page) => ({ slug: page.slug, texts: pageTexts(page) })), about]) {
      for (const href of texts.flatMap(inlineLinks)) {
        expect(isAllowedLink(href), `${slug} links to ${href}`).toBe(true)
      }
    }
  })

  it('has the files of every content video (pnpm content:video)', () => {
    for (const guide of GUIDES) {
      if (!guide.video) continue
      for (const file of Object.values(videoFiles(guide.video))) {
        expect(existsSync(path.join(process.cwd(), 'public', file)), `${guide.slug}: ${file}`).toBe(true)
      }
      expect(guide.video.durationSeconds, guide.slug).toBeGreaterThan(0)
      expect(guide.video.uploaded, guide.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})

describe('event examples', () => {
  it('shows a whole event: texts, several tables, every table seated', () => {
    for (const example of EVENT_EXAMPLES) {
      const { sheet } = example
      expect(sheet.heading.trim(), example.slug).not.toBe('')
      expect(sheet.tables.length, example.slug).toBeGreaterThanOrEqual(2)
      for (const table of sheet.tables) {
        expect(table.name.trim(), example.slug).not.toBe('')
        expect(table.guests.length, `${example.slug} ${table.name}`).toBeGreaterThan(0)
      }
      if (sheet.kind === 'plan') expect(sheet.venue?.length, `${example.slug}: a hall plan draws its hall`).toBeGreaterThan(0)
    }
  })

  // "Use this example" saves the list through the API, which trims what breaks its rules
  // (lengths, counts, catalogue values) without an error. A content-only push deploys no API,
  // so the content must fit the API that is already live.
  it('keeps every example list whole through the API save', () => {
    for (const example of EVENT_EXAMPLES) {
      const doc = exampleDocument(example)
      expect(coerceContent(doc.content), example.slug).toEqual(doc.content)
      expect(coerceDesign(doc.design), example.slug).toEqual(doc.design)
    }
  })

  it('has a current one-page picture of every example (pnpm content:images)', () => {
    for (const example of EVENT_EXAMPLES) {
      const entry = exampleImageEntry(example.slug)
      expect(entry, `${example.slug}: no picture — run pnpm content:images`).toBeDefined()
      expect(entry?.fingerprint, `${example.slug}: the example changed since its picture — run pnpm content:images`).toBe(
        fingerprint(exampleDocument(example))
      )
      expect(entry?.pages, `${example.slug}: runs past one page — lower its textScale or columns`).toBe(1)
      expect(entry?.fits, `${example.slug}: a block runs off the page or over another — lower its textScale`).toBe(true)
      expect(existsSync(path.join(process.cwd(), 'public/content/examples', `${example.slug}.webp`)), example.slug).toBe(true)
    }
  })
})

describe('Armenian punctuation', () => {
  const texts = [
    ...PAGES.flatMap((page) => pageTexts(page).map((text) => ({ page: label(page), text }))),
    ...aboutTexts().map((text) => ({ page: 'about', text })),
  ]

  it('asks questions with ՞ on the word, never ?', () => {
    for (const page of PAGES) {
      for (const item of page.faq) expect(item.question, label(page)).toMatch(/՞/)
    }
    for (const { page, text } of texts) expect(text, page).not.toMatch(/\?/)
  })

  it('ends sentences with ։, not a Latin full stop or colon', () => {
    // «էլ. փոստ» and other abbreviations are followed by a lowercase word, a sentence end by a capital.
    const fullStop = new RegExp(`[${ARMENIAN_LETTER}]{2,}\\.\\s+[Ա-Ֆ]`)
    const lastStop = new RegExp(`[${ARMENIAN_LETTER}]{2,}\\.$`)
    const colon = new RegExp(`[${ARMENIAN_LETTER}]:`)
    for (const { page, text } of texts) {
      expect(text, page).not.toMatch(fullStop)
      expect(text, page).not.toMatch(lastStop)
      expect(text, page).not.toMatch(colon)
    }
  })

  it('quotes with «», not straight quotes, and has no stray spaces', () => {
    for (const { page, text } of texts) {
      expect(text, page).not.toMatch(/"/)
      expect(text, page).not.toMatch(/ {2}|^\s|\s$| [,։․՝]/)
      expect(text, page).not.toMatch(new RegExp(`[${ARMENIAN_LETTER}]!`))
    }
  })
})
