import { withSentryConfig } from '@sentry/nextjs/config'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  /**
   * User agents that get `generateMetadata`'s tags in `<head>`, blocking, instead of streamed
   * after the body. Next's default list plus the AI crawlers, which read raw HTML without
   * running scripts — without this, titles and descriptions reach them late or not at all.
   * Setting this *replaces* Next's default, so recheck it after a Next upgrade.
   */
  htmlLimitedBots:
    /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|SkypeUriPreview|Yeti|googleweblight|GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-SearchBot|Claude-User|anthropic-ai|PerplexityBot|Perplexity-User|CCBot|Bytespider|Amazonbot|cohere-ai|DuckAssistBot|meta-externalagent|MistralAI-User/i,
  async headers() {
    return [
      {
        // Self-hosted CV fonts never change under the same path (the build script rewrites
        // the folder), so they can be cached hard by browsers and CDNs.
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ]
  },
}

/**
 * Sentry's build step. Source maps go up only when the build has `SENTRY_AUTH_TOKEN` (with
 * `SENTRY_ORG` / `SENTRY_PROJECT`, which the plugin reads itself), and are then removed from
 * the bundle. Events reach Sentry through a tunnel route on this origin, so ad blockers that
 * drop requests to sentry.io do not drop the errors with them.
 */
export default withSentryConfig(withNextIntl(nextConfig), {
  silent: !process.env.CI,
  telemetry: false,
  tunnelRoute: true,
  widenClientFileUpload: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
})
