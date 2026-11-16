import manifest from './exampleImages.json'
import type { EventExample } from './types'

/**
 * Each event example's picture: its sheet, printed by the same renderer as the PDF (`/render`)
 * and saved as WebP in `public/content/examples/` by `pnpm content:images`. A real image, unlike
 * a client-drawn preview, shows without JavaScript, can show in Google Images and in the
 * Article's structured data, and spares the content pages the sheet fonts.
 *
 * `exampleImages.json` records, per slug, the fingerprint of what was drawn (the example's whole
 * `ListDocument`, template design included), how many pages it ran to and whether every block
 * fits. The content tests recompute the fingerprint: an example changed without a new picture
 * fails the content pipeline instead of shipping a stale one.
 */
export type ExampleImage = { src: string; width: number; height: number }

/** `pages`: how many it ran to; `fits`: every block inside the page and clear of the others. */
type ManifestEntry = { fingerprint: string; width: number; height: number; pages: number; fits: boolean }

const IMAGES = manifest as Record<string, ManifestEntry>

export const exampleImageEntry = (slug: string): ManifestEntry | undefined => IMAGES[slug]

/** The picture's URL (the fingerprint busts caches when it changes) and size. The content tests require one per example. */
export const exampleImage = (example: EventExample): ExampleImage => {
  const entry = IMAGES[example.slug]
  if (!entry) throw new Error(`no picture for the event example "${example.slug}": run pnpm content:images`)
  return { src: `/content/examples/${example.slug}.webp?v=${entry.fingerprint}`, width: entry.width, height: entry.height }
}

/** The picture's alt text: what it shows, in the words people search for. */
export const exampleImageAlt = (example: EventExample, templateName: string): string => `${example.title}՝ «${templateName}» ձևանմուշով`
