import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { examplePath, ROUTES } from '@constants/routes'
import { EVENT_EXAMPLES, GUIDES } from '@content/index'
import { pageMetadata } from '@helpers/metadata'
import { collectionSchema } from '@linkedDataSchema/content'
import { Breadcrumbs } from '@components/content/Breadcrumbs'
import { ContentCta, ExampleCard, GuideCard } from '@components/content/ContentParts'
import { JsonLd } from '@components/seo/JsonLd'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Content')
  return pageMetadata({
    title: t('examplesMetaTitle'),
    description: t('examplesMetaDescription', { count: EVENT_EXAMPLES.length }),
    path: ROUTES.examples,
  })
}

export default async function ExamplesPage() {
  const t = await getTranslations('Content')
  const tNav = await getTranslations('Nav')
  return (
    <div className='mesh-bg'>
      <JsonLd
        data={collectionSchema({
          name: t('examplesTitle'),
          description: t('examplesMetaDescription', { count: EVENT_EXAMPLES.length }),
          path: ROUTES.examples,
          items: EVENT_EXAMPLES.map((example) => ({ name: example.title, path: examplePath(example.slug) })),
        })}
      />
      <div className='mx-auto max-w-page px-4 pt-8 pb-14 sm:pt-10 md:px-6'>
        <Breadcrumbs
          items={[
            { name: tNav('home'), path: ROUTES.home },
            { name: tNav('examples'), path: ROUTES.examples },
          ]}
        />
        <h1 className='text-balance mt-4 max-w-3xl font-display text-title font-extrabold tracking-tight text-ink sm:text-5xl'>{t('examplesTitle')}</h1>
        <p className='mt-4 max-w-2xl text-base leading-relaxed text-muted sm:mt-5 sm:text-lg'>{t('examplesSubtitle')}</p>
        <div lang='hy' className='mt-10 grid grid-cols-1 gap-x-6 gap-y-10 sm:mt-14 sm:grid-cols-2 md:grid-cols-3'>
          {EVENT_EXAMPLES.map((example) => (
            <ExampleCard key={example.slug} example={example} headingLevel='h2' />
          ))}
        </div>

        <section className='mt-16' aria-labelledby='guides-heading'>
          <h2 id='guides-heading' className='m-0 font-display text-xl font-extrabold text-ink sm:text-2xl'>
            {t('relatedGuides')}
          </h2>
          <div lang='hy' className='mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3'>
            {GUIDES.slice(0, 3).map((guide) => (
              <GuideCard key={guide.slug} guide={guide} />
            ))}
          </div>
        </section>

        <ContentCta />
      </div>
    </div>
  )
}
