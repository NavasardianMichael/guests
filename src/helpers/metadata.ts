import type { Metadata } from 'next'
import { APP_NAME, APP_TAGLINE, OG_LOCALE } from '@constants/app'
import { absoluteUrl } from './url'

/**
 * The site's share image (`app/opengraph-image.tsx`). Named on every page because a page's own
 * `openGraph` replaces the root's whole object, image included — without this no share card
 * had a picture. A segment with its own `opengraph-image` (a template) still overrides it.
 */
const SITE_IMAGE = { url: '/opengraph-image', width: 1200, height: 630, type: 'image/png', alt: `${APP_NAME} — ${APP_TAGLINE}` }

/**
 * Per-page metadata for an indexable route: a self-canonical, and OpenGraph/Twitter that
 * repeat the page's own title and description (a root default would stamp the homepage's
 * onto every share card). One language, so no hreflang set.
 */
export const pageMetadata = ({
  title,
  description,
  path,
  absoluteTitle = false,
  ownImage = false,
}: {
  title: string
  description: string
  path: string
  /** Skip the root layout's "%s | Իմ ինքնակենսագրականը" template (the homepage names the brand itself). */
  absoluteTitle?: boolean
  /** The route has its own `opengraph-image` / `twitter-image` files, which a named image would override. */
  ownImage?: boolean
}): Metadata => ({
  title: absoluteTitle ? { absolute: title } : title,
  description,
  alternates: { canonical: absoluteUrl(path) },
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    locale: OG_LOCALE,
    url: absoluteUrl(path),
    title: absoluteTitle ? title : `${title} | ${APP_NAME}`,
    description,
    ...(ownImage ? {} : { images: [SITE_IMAGE] }),
  },
  twitter: { card: 'summary_large_image', title, description, ...(ownImage ? {} : { images: [SITE_IMAGE] }) },
})

/** Signed-in and transactional pages: never indexed. */
export const privateMetadata = (title: string): Metadata => ({
  title,
  robots: { index: false, follow: false },
})
