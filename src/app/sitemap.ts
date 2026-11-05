import type { MetadataRoute } from 'next'
import { ROUTES, templatePath } from '@constants/routes'
import { TEMPLATE_IDS } from '@constants/templates'
import { absoluteUrl } from '@helpers/url'

/** Every indexable page. Indexed in Armenian; the language switch is a cookie, so no alternates. */
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']) => ({
    url: absoluteUrl(path),
    changeFrequency,
    priority,
  })

  return [
    page(ROUTES.home, 1, 'weekly'),
    page(ROUTES.templates, 0.9, 'weekly'),
    ...TEMPLATE_IDS.map((id) => page(templatePath(id), 0.8, 'monthly')),
    page(ROUTES.pricing, 0.7, 'monthly'),
    page(ROUTES.contact, 0.3, 'yearly'),
    page(ROUTES.terms, 0.2, 'yearly'),
    page(ROUTES.privacy, 0.2, 'yearly'),
  ]
}
