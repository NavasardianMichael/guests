import type { PlanArrangement, PrintKind, SheetShape, SortOrder, TableShape, VenueKind } from '@store/lists/single/types'
import type { Orientation } from '@constants/paper'
import type { TemplateId } from '@constants/templates'

/**
 * The site's articles (`/guides`) and event examples (`/examples`): Armenian copy as typed data,
 * one file per page, named after its slug. Armenian in every interface language, like the legal
 * pages: they are what is indexed. Text fields take two inline marks, rendered by `RichText`:
 * `[label](/path)` links and `**bold**`. `tests/unit/content` checks the rest — slugs, lengths,
 * links, related pages, Armenian punctuation.
 */

export type ContentBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  /** A highlighted piece of advice. */
  | { kind: 'tip'; text: string }
  /** The same thing done poorly, then well. */
  | { kind: 'compare'; weak: string; strong: string }
  /** Text meant to be copied: a sheet's heading, an invitation line. `label` names it. */
  | { kind: 'sample'; label: string; text: string }

export type ContentSection = {
  /** The heading's anchor, for the table of contents: lowercase Latin, dashes. */
  id: string
  heading: string
  blocks: ContentBlock[]
}

export type FaqItem = { question: string; answer: string }

/** What every content page has: metadata, search phrasing and dates. */
type ContentPage = {
  /** The URL's last part: the main search phrase, transliterated (`hyureri-nstetsum`). */
  slug: string
  /** The `<h1>` and the Article headline. */
  title: string
  /** For cards, breadcrumbs and the share image. */
  shortTitle: string
  /** `<title>`: the main keyword first, at most 65 characters, no brand (Google adds the site name). */
  metaTitle: string
  /** The meta description, 110-160 characters. */
  description: string
  /** The title in Latin letters, as many people type Armenian: the Article's `alternativeHeadline`. */
  latinTitle: string
  /**
   * Other ways people search for this, Latin-lettered among them: the Article's `keywords` in
   * JSON-LD only. Never shown as a list on the page — Google's spam policies name "keywords in
   * a list or group" as keyword stuffing. Visible text says these things in sentences.
   */
  searchTerms: string[]
  /** ISO dates (YYYY-MM-DD). */
  published: string
  updated: string
  intro: string[]
  sections: ContentSection[]
  faq: FaqItem[]
}

/**
 * A tutorial video shown under the article's intro, self-hosted in `public/content/video/`
 * (`pnpm content:video` records it). `file` is the name without extension: `<file>.mp4`, its
 * poster `<file>.jpg` and its captions `<file>.vtt`.
 */
export type ContentVideo = {
  file: string
  title: string
  description: string
  durationSeconds: number
  /** ISO date (YYYY-MM-DD). */
  uploaded: string
  width: number
  height: number
}

export type Guide = ContentPage & {
  video?: ContentVideo
  /** The template drawn on the share image. */
  cardTemplate: TemplateId
  /** Other guides, by slug. */
  related: string[]
  /** Event examples, by slug. */
  relatedExamples: string[]
}

/** A table of the example's list, its guests in seating order. */
export type ExampleTable = {
  name: string
  /** How the hall plan draws it; round when left out. */
  shape?: TableShape
  /** Chairs on the hall plan; one per guest when left out. */
  seats?: number
  guests: string[]
}

/**
 * The list an example shows and opens: its texts, tables and guests, and how it prints. Turned
 * into a real `ListDocument` by `exampleDocument` (`content/exampleDocument.ts`), which starts
 * from the template's own design and applies only what is set here.
 */
export type ExampleSheet = {
  templateId: TemplateId
  kind: PrintKind
  shape?: SheetShape
  /** The hall plan's arrangement; rows when left out. */
  arrangement?: PlanArrangement
  /** The kind's own when left out (the hall plan is landscape, the rest portrait). */
  orientation?: Orientation
  /** Grid columns; the kind's default when left out. */
  columns?: number
  /** The printout's order (A–Z for an entrance list); the list's own when left out. */
  sort?: SortOrder
  /** "1. Name" on a plain list. */
  numbering?: boolean
  /** Every text's size multiplier; 1 when left out. Set so the sheet fits one page. */
  textScale?: number
  heading: string
  subheading: string
  footer: string
  tables: ExampleTable[]
  /** What the hall plan draws besides the tables, with its label. */
  venue?: { kind: VenueKind; label: string }[]
}

export type EventExample = ContentPage & {
  /** The event, as a card names it: «Հարսանիք». */
  event: string
  /** The list itself: shown on the page as a picture, and the start of "use this example". */
  sheet: ExampleSheet
  /** Other examples, by slug. */
  related: string[]
  /** Guides, by slug. */
  relatedGuides: string[]
}
