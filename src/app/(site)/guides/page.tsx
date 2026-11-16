import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { guidePath, ROUTES } from '@constants/routes'
import { EVENT_EXAMPLES, GUIDES } from '@content/index'
import { pageMetadata } from '@helpers/metadata'
import { collectionSchema } from '@linkedDataSchema/content'
import { Breadcrumbs } from '@components/content/Breadcrumbs'
import { ContentCta, ExampleCard, GuideCard } from '@components/content/ContentParts'
import { JsonLd } from '@components/seo/JsonLd'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Content')
  return pageMetadata({ title: t('guidesMetaTitle'), description: t('guidesMetaDescription'), path: ROUTES.guides })
}

export default async function GuidesPage() {
  const t = await getTranslations('Content')
  const tNav = await getTranslations('Nav')
  return (
    <div className='mesh-bg'>
      <JsonLd
        data={collectionSchema({
          name: t('guidesTitle'),
          description: t('guidesMetaDescription'),
          path: ROUTES.guides,
          items: GUIDES.map((guide) => ({ name: guide.title, path: guidePath(guide.slug) })),
        })}
      />
      <div className='mx-auto max-w-page px-4 pt-8 pb-14 sm:pt-10 md:px-6'>
        <Breadcrumbs
          items={[
            { name: tNav('home'), path: ROUTES.home },
            { name: tNav('guides'), path: ROUTES.guides },
          ]}
        />
        <h1 className='text-balance mt-4 max-w-3xl font-display text-title font-extrabold tracking-tight text-ink sm:text-5xl'>{t('guidesTitle')}</h1>
        <p className='mt-4 max-w-2xl text-base leading-relaxed text-muted sm:mt-5 sm:text-lg'>{t('guidesSubtitle')}</p>
        <div lang='hy' className='mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3'>
          {GUIDES.map((guide) => (
            <GuideCard key={guide.slug} guide={guide} headingLevel='h2' />
          ))}
        </div>

        <section className='mt-16' aria-labelledby='examples-heading'>
          <h2 id='examples-heading' className='m-0 font-display text-xl font-extrabold text-ink sm:text-2xl'>
            {t('relatedExamples')}
          </h2>
          <div lang='hy' className='mt-8 grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-4'>
            {EVENT_EXAMPLES.slice(0, 4).map((example) => (
              <ExampleCard key={example.slug} example={example} />
            ))}
          </div>
        </section>

        <ContentCta />
      </div>
    </div>
  )
}
