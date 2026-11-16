import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import type { AboutPage as AboutPageSchema, WithContext } from 'schema-dts'
import { LOCALE } from '@constants/app'
import { ROUTES } from '@constants/routes'
import { ABOUT } from '@content/about'
import { formatDate } from '@helpers/date'
import { pageMetadata } from '@helpers/metadata'
import { absoluteUrl } from '@helpers/url'
import { ORGANIZATION_ID, organizationSchema, WEBSITE_ID } from '@linkedDataSchema/site'
import { Breadcrumbs } from '@components/content/Breadcrumbs'
import { ContentCta } from '@components/content/ContentParts'
import { ContentSections } from '@components/content/ContentSections'
import { RichText } from '@components/content/RichText'
import { JsonLd } from '@components/seo/JsonLd'

export const metadata: Metadata = pageMetadata({
  title: ABOUT.metaTitle,
  description: ABOUT.description,
  path: ROUTES.about,
  absoluteTitle: true,
})

/** Who is behind the site: the page every article's byline points to (`ContentMeta`). Armenian in every interface language. */
export default async function AboutPage() {
  const tNav = await getTranslations('Nav')
  const tContent = await getTranslations('Content')
  const locale = await getLocale()

  const aboutPage: WithContext<AboutPageSchema> = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: ABOUT.title,
    description: ABOUT.description,
    url: absoluteUrl(ROUTES.about),
    inLanguage: LOCALE,
    dateModified: ABOUT.updated,
    about: { '@id': ORGANIZATION_ID },
    mainEntity: { '@id': ORGANIZATION_ID },
    isPartOf: { '@id': WEBSITE_ID },
  }

  return (
    <div className='mesh-bg'>
      <JsonLd data={[aboutPage, organizationSchema()]} />
      <article lang='hy' className='mx-auto max-w-3xl px-4 pt-8 pb-14 sm:pt-10 md:px-6'>
        <Breadcrumbs
          items={[
            { name: tNav('home'), path: ROUTES.home },
            { name: tNav('about'), path: ROUTES.about },
          ]}
        />
        <h1 className='mt-4 mb-0 font-display text-title font-extrabold tracking-tight text-ink sm:text-5xl'>{ABOUT.title}</h1>
        <p className='m-0 mt-4 text-sm text-muted'>
          {tContent.rich('updated', { date: () => <time dateTime={ABOUT.updated}>{formatDate(ABOUT.updated, locale)}</time> })}
        </p>
        {ABOUT.intro.map((paragraph) => (
          <p key={paragraph} className='mt-5 mb-0 text-lg leading-relaxed text-text'>
            <RichText text={paragraph} />
          </p>
        ))}
        <ContentSections sections={ABOUT.sections} />
        <ContentCta />
      </article>
    </div>
  )
}
