import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { guidePath, ROUTES } from '@constants/routes'
import { examplesBySlug, findGuide, GUIDES, guidesBySlug } from '@content/index'
import { pageMetadata } from '@helpers/metadata'
import { articleSchema } from '@linkedDataSchema/content'
import { Breadcrumbs } from '@components/content/Breadcrumbs'
import { ContentFaq } from '@components/content/ContentFaq'
import { ContentCta, ContentMeta, ContentVideoPlayer, ExampleCard, GuideCard, TableOfContents } from '@components/content/ContentParts'
import { ContentSections } from '@components/content/ContentSections'
import { RichText } from '@components/content/RichText'
import { JsonLd } from '@components/seo/JsonLd'

type Props = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = findGuide((await params).slug)
  if (!guide) return {}
  return pageMetadata({
    title: guide.metaTitle,
    description: guide.description,
    path: guidePath(guide.slug),
    absoluteTitle: true,
    ownImage: true,
    article: { published: guide.published, updated: guide.updated },
  })
}

export default async function GuidePage({ params }: Props) {
  const guide = findGuide((await params).slug)
  if (!guide) notFound()

  const t = await getTranslations('Content')
  const tNav = await getTranslations('Nav')
  const path = guidePath(guide.slug)
  // Questions only (the questions page): they are the body, each an <h2>.
  const faqOnly = guide.sections.length === 0

  return (
    <div className='mesh-bg'>
      <JsonLd data={articleSchema(guide, path)} />
      {/* The article is Armenian in every interface language, like the legal pages. */}
      <article lang='hy' className='mx-auto max-w-3xl px-4 pt-8 pb-14 sm:pt-10 md:px-6'>
        <Breadcrumbs
          items={[
            { name: tNav('home'), path: ROUTES.home },
            { name: tNav('guides'), path: ROUTES.guides },
            { name: guide.shortTitle, path },
          ]}
        />
        <h1 className='text-balance mt-4 mb-0 font-display text-title font-extrabold tracking-tight text-ink sm:text-[2.75rem] sm:leading-tight'>
          {guide.title}
        </h1>
        <ContentMeta page={guide} />
        {guide.intro.map((paragraph) => (
          <p key={paragraph} className='mt-5 mb-0 text-lg leading-relaxed text-text'>
            <RichText text={paragraph} />
          </p>
        ))}
        {guide.video && <ContentVideoPlayer video={guide.video} pagePath={path} />}
        <TableOfContents sections={guide.sections} hasFaq={guide.faq.length > 0} />
        <ContentSections sections={guide.sections} />
        {guide.faq.length > 0 && <ContentFaq items={guide.faq} headingLevel={faqOnly ? 'h2' : 'h3'} />}
        <ContentCta />
      </article>

      <div className='mx-auto max-w-page px-4 pb-14 md:px-6'>
        <section aria-labelledby='related-guides'>
          <h2 id='related-guides' className='m-0 font-display text-xl font-extrabold text-ink sm:text-2xl'>
            {t('relatedGuides')}
          </h2>
          <div lang='hy' className='mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3'>
            {guidesBySlug(guide.related).map((other) => (
              <GuideCard key={other.slug} guide={other} />
            ))}
          </div>
        </section>
        <section className='mt-14' aria-labelledby='related-examples'>
          <h2 id='related-examples' className='m-0 font-display text-xl font-extrabold text-ink sm:text-2xl'>
            {t('relatedExamples')}
          </h2>
          <div lang='hy' className='mt-8 grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-3'>
            {examplesBySlug(guide.relatedExamples).map((example) => (
              <ExampleCard key={example.slug} example={example} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
