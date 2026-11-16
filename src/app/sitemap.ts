import type { MetadataRoute } from 'next'
import { PRIVACY, REFUND, TERMS } from '@constants/legal'
import { examplePath, guidePath, ROUTES, templatePath } from '@constants/routes'
import { CONTENT_UPDATED } from '@constants/seo'
import { TEMPLATE_IDS } from '@constants/templates'
import { ABOUT } from '@content/about'
import { exampleImage } from '@content/exampleImages'
import { EVENT_EXAMPLES, GUIDES, videoFiles } from '@content/index'
import { absoluteUrl } from '@helpers/url'

/** Every indexable page. Indexed in Armenian; the language switch is a cookie, so no alternates. */
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
    lastModified = CONTENT_UPDATED
  ) => ({
    url: absoluteUrl(path),
    lastModified,
    changeFrequency,
    priority,
  })
  // The newest content date: a hub changes when one of its pages does.
  const latest = (dates: string[]): string => dates.reduce((a, b) => (a > b ? a : b))

  return [
    page(ROUTES.home, 1, 'weekly'),
    page(ROUTES.templates, 0.9, 'weekly'),
    ...TEMPLATE_IDS.map((id) => page(templatePath(id), 0.8, 'monthly')),
    page(ROUTES.examples, 0.8, 'weekly', latest(EVENT_EXAMPLES.map((example) => example.updated))),
    // The sheet's picture too, so it can be found in Google Images.
    ...EVENT_EXAMPLES.map((example) => ({
      ...page(examplePath(example.slug), 0.8, 'monthly', example.updated),
      images: [absoluteUrl(exampleImage(example).src)],
    })),
    page(ROUTES.guides, 0.8, 'weekly', latest(GUIDES.map((guide) => guide.updated))),
    ...GUIDES.map((guide) => ({
      ...page(guidePath(guide.slug), 0.8, 'monthly', guide.updated),
      ...(guide.video
        ? {
            videos: [
              {
                title: guide.video.title,
                description: guide.video.description,
                thumbnail_loc: absoluteUrl(videoFiles(guide.video).poster),
                content_loc: absoluteUrl(videoFiles(guide.video).src),
                duration: guide.video.durationSeconds,
                publication_date: `${guide.video.uploaded}T12:00:00+04:00`,
              },
            ],
          }
        : {}),
    })),
    page(ROUTES.pricing, 0.7, 'monthly'),
    page(ROUTES.about, 0.4, 'yearly', ABOUT.updated),
    page(ROUTES.contact, 0.3, 'yearly'),
    page(ROUTES.terms, 0.2, 'yearly', TERMS.updated),
    page(ROUTES.privacy, 0.2, 'yearly', PRIVACY.updated),
    page(ROUTES.refundPolicy, 0.2, 'yearly', REFUND.updated),
  ]
}
