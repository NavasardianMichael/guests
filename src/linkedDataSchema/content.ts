import type { Article, CollectionPage, VideoObject, WithContext } from 'schema-dts'
import { APP_NAME, LOCALE } from '@constants/app'
import { ROUTES } from '@constants/routes'
import { videoFiles } from '@content/index'
import type { ContentVideo, EventExample, Guide } from '@content/types'
import { absoluteUrl } from '@helpers/url'
import { ORGANIZATION_ID, WEBSITE_ID } from './site'

/**
 * A guide or an event example as an Article: dates, and the Latin-lettered title as
 * `alternativeHeadline`. The image is an example's picture, else the site's card: a page's own
 * card (its `og:image`) is served under a hashed name Next picks at build time
 * (`opengraph-image-<hash>`), which a hand-written URL would miss. The author is the
 * organisation, named in full so the node stands on its own, with the About page as its URL.
 */
export const articleSchema = (page: Guide | EventExample, path: string, image?: string): WithContext<Article> => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  '@id': `${absoluteUrl(path)}#article`,
  headline: page.title,
  alternativeHeadline: page.latinTitle,
  description: page.description,
  url: absoluteUrl(path),
  mainEntityOfPage: absoluteUrl(path),
  image: absoluteUrl(image ?? '/opengraph-image'),
  inLanguage: LOCALE,
  datePublished: page.published,
  dateModified: page.updated,
  keywords: page.searchTerms.join(', '),
  isAccessibleForFree: true,
  author: { '@type': 'Organization', '@id': ORGANIZATION_ID, name: APP_NAME, url: absoluteUrl(ROUTES.about) },
  publisher: { '@id': ORGANIZATION_ID },
  isPartOf: { '@id': WEBSITE_ID },
})

/** A hub page (`/guides`, `/examples`) and the pages it lists. */
export const collectionSchema = ({
  name,
  description,
  path,
  items,
}: {
  name: string
  description: string
  path: string
  items: { name: string; path: string }[]
}): WithContext<CollectionPage> => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name,
  description,
  url: absoluteUrl(path),
  inLanguage: LOCALE,
  isPartOf: { '@id': WEBSITE_ID },
  mainEntity: {
    '@type': 'ItemList',
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  },
})

/**
 * A self-hosted tutorial video: what Google needs to show it in video results (name,
 * description, thumbnail, upload date) plus its file and length. Upload time is noon, Yerevan.
 */
export const videoSchema = (video: ContentVideo, pagePath: string): WithContext<VideoObject> => {
  const files = videoFiles(video)
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: video.description,
    thumbnailUrl: absoluteUrl(files.poster),
    contentUrl: absoluteUrl(files.src),
    uploadDate: `${video.uploaded}T12:00:00+04:00`,
    duration: `PT${video.durationSeconds}S`,
    width: { '@type': 'QuantitativeValue', value: video.width },
    height: { '@type': 'QuantitativeValue', value: video.height },
    inLanguage: LOCALE,
    isFamilyFriendly: true,
    publisher: { '@id': ORGANIZATION_ID },
    mainEntityOfPage: absoluteUrl(pagePath),
  }
}
