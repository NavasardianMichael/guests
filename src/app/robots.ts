import type { MetadataRoute } from 'next'
import { ROUTES } from '@constants/routes'
import { absoluteUrl } from '@helpers/url'

/**
 * AI search and answer engines are named so the welcome is explicit: the templates, pricing
 * and FAQ are meant to be found and quoted there. A group naming a crawler replaces `*` for
 * it, so the private areas are repeated. robots is a crawling hint, never access control.
 */
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot',
  'Applebot-Extended',
  'CCBot',
  'DuckAssistBot',
  'Amazonbot',
  'meta-externalagent',
  'MistralAI-User',
  'YandexAdditional',
]

export default function robots(): MetadataRoute.Robots {
  // The editor is not here: template pages link to `/editor/new?template=…`, and a URL blocked
  // from crawling can still be indexed bare from such links. It may be crawled instead and says
  // `noindex` itself (`editor/new`, `editor/[id]`); opened by a crawler it writes nothing to the API.
  const disallow = [
    ROUTES.dashboard,
    ROUTES.account,
    '/auth/',
    '/payment/',
    ROUTES.render,
  ]
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      { userAgent: AI_CRAWLERS, allow: ['/', '/llms.txt'], disallow },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
