import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { examplePath, newListFromExamplePath, ROUTES, templatesPath } from '@constants/routes'
import { exampleImage } from '@content/exampleImages'
import { EVENT_EXAMPLES, examplesBySlug, findExample, guidesBySlug } from '@content/index'
import { pageMetadata } from '@helpers/metadata'
import { articleSchema } from '@linkedDataSchema/content'
import { Breadcrumbs } from '@components/content/Breadcrumbs'
import { ContentFaq } from '@components/content/ContentFaq'
import { ContentCta, ContentMeta, ExampleCard, ExamplePicture, GuideCard, TableOfContents } from '@components/content/ContentParts'
import { ContentSections } from '@components/content/ContentSections'
import { RichText } from '@components/content/RichText'
import { JsonLd } from '@components/seo/JsonLd'

type Props = { params: Promise<{ slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return EVENT_EXAMPLES.map((example) => ({ slug: example.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const example = findExample((await params).slug)
  if (!example) return {}
  return pageMetadata({
    title: example.metaTitle,
    description: example.description,
    path: examplePath(example.slug),
    absoluteTitle: true,
    ownImage: true,
    article: { published: example.published, updated: example.updated },
  })
}

export default async function ExamplePage({ params }: Props) {
  const example = findExample((await params).slug)
  if (!example) notFound()

  const t = await getTranslations('Content')
  const tNav = await getTranslations('Nav')
  const tEditor = await getTranslations('Editor')
  const tTemplates = await getTranslations('Templates')
  const path = examplePath(example.slug)
  const kind = example.sheet.kind

  return (
    <div className='mesh-bg'>
      <JsonLd data={articleSchema(example, path, exampleImage(example).src)} />
      <div className='mx-auto grid max-w-page grid-cols-1 gap-8 px-4 pt-8 pb-4 sm:gap-12 sm:pt-10 md:px-6 lg:grid-cols-[1fr_1.1fr]'>
        <div className='lg:sticky lg:top-24 lg:self-start'>
          <Breadcrumbs
            items={[
              { name: tNav('home'), path: ROUTES.home },
              { name: tNav('examples'), path: ROUTES.examples },
              { name: example.event, path },
            ]}
          />
          <div lang='hy'>
            <h1 className='text-balance mt-4 mb-0 font-display text-title font-extrabold tracking-tight text-ink sm:text-5xl'>{example.title}</h1>
            <ContentMeta page={example} />
            {example.intro.map((paragraph) => (
              <p key={paragraph} className='mt-5 mb-0 text-base leading-relaxed text-text sm:text-lg'>
                <RichText text={paragraph} />
              </p>
            ))}
          </div>
          <div className='mt-8 flex flex-wrap gap-3'>
            <Link
              href={newListFromExamplePath(example.slug)}
              // The editor: never worth a crawl, and a prefetch would start a list.
              prefetch={false}
              rel='nofollow'
              className='inline-flex items-center rounded-full bg-ink px-5 py-3 font-semibold text-white no-underline shadow-lg shadow-ink/20 transition hover:-translate-y-0.5 sm:px-6 sm:py-3.5'
            >
              {t('useExample')}
            </Link>
            <Link
              href={templatesPath({ kind })}
              className='inline-flex items-center rounded-full bg-surface px-5 py-3 font-semibold text-ink no-underline ring-1 ring-line transition hover:-translate-y-0.5 sm:px-6 sm:py-3.5'
            >
              {t('otherTemplate')}
            </Link>
          </div>
          <p className='mt-4 mb-0 text-sm text-muted'>
            {t('exampleNote', { template: tTemplates(`names.${example.sheet.templateId}`), kind: tEditor(`layout.kinds.${kind}`) })}
          </p>
        </div>

        <figure className='m-0'>
          <div className='overflow-hidden rounded-2xl shadow-[0_30px_70px_-25px_rgba(20,24,45,0.45)] ring-1 ring-black/5'>
            <ExamplePicture example={example} loading='eager' />
          </div>
          <figcaption className='mt-3 text-center text-sm text-muted'>{t('examplePreviewLabel', { event: example.event })}</figcaption>
        </figure>
      </div>

      <article lang='hy' className='mx-auto max-w-3xl px-4 pb-14 md:px-6'>
        <TableOfContents sections={example.sections} hasFaq={example.faq.length > 0} />
        <ContentSections sections={example.sections} />
        {example.faq.length > 0 && <ContentFaq items={example.faq} />}
        <ContentCta />
      </article>

      <div className='mx-auto max-w-page px-4 pb-14 md:px-6'>
        <section aria-labelledby='related-examples'>
          <h2 id='related-examples' className='m-0 font-display text-xl font-extrabold text-ink sm:text-2xl'>
            {t('moreExamples')}
          </h2>
          <div lang='hy' className='mt-8 grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-3'>
            {examplesBySlug(example.related).map((other) => (
              <ExampleCard key={other.slug} example={other} />
            ))}
          </div>
        </section>
        <section className='mt-14' aria-labelledby='related-guides'>
          <h2 id='related-guides' className='m-0 font-display text-xl font-extrabold text-ink sm:text-2xl'>
            {t('relatedGuides')}
          </h2>
          <div lang='hy' className='mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3'>
            {guidesBySlug(example.relatedGuides).map((guide) => (
              <GuideCard key={guide.slug} guide={guide} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
