import { Fragment } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import type { CreativeWork, WithContext } from 'schema-dts'
import { PRINT_KINDS } from '@store/lists/single/types'
import { sampleTexts } from '@i18n/sampleTexts'
import { APP_NAME } from '@constants/app'
import { FONTS, fontSourceUrl } from '@constants/fonts'
import { ROUTES, templatePath } from '@constants/routes'
import { isTemplateId, TEMPLATE_IDS, TEMPLATE_LIST, TEMPLATES } from '@constants/templates'
import { sampleContent, templateDesign } from '@helpers/listFactory'
import { pageMetadata } from '@helpers/metadata'
import { absoluteUrl } from '@helpers/url'
import { breadcrumbSchema, ORGANIZATION_ID } from '@linkedDataSchema/site'
import { JsonLd } from '@components/seo/JsonLd'
import { SheetFontsLink } from '@components/sheet/SheetFontsLink'
import { TemplateCard } from '@components/templates/TemplateCard'
import { ShapedSheetPreview, TemplateShapePicker, TemplateShapeProvider, UseTemplateLink } from '@components/templates/TemplateShape'

type Props = { params: Promise<{ templateId: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  return TEMPLATE_IDS.map((templateId) => ({ templateId }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { templateId } = await params
  if (!isTemplateId(templateId)) return {}
  const t = await getTranslations('Templates')
  const name = t(`names.${templateId}`)
  return pageMetadata({
    title: t('detailTitle', { name }),
    description: t('detailDescription', { name, tagline: t(`taglines.${templateId}`) }),
    path: templatePath(templateId),
    ownImage: true,
  })
}

export default async function TemplatePage({ params }: Props) {
  const { templateId } = await params
  if (!isTemplateId(templateId)) notFound()

  const t = await getTranslations('Templates')
  const tKinds = await getTranslations('Editor.layout.kinds')
  const tNav = await getTranslations('Nav')
  const tShapes = await getTranslations('Shapes')
  const locale = await getLocale()
  const texts = await sampleTexts()
  const template = TEMPLATES[templateId]
  const name = t(`names.${templateId}`)
  // The next four in the list, wrapping: every template is linked from four others.
  const position = TEMPLATE_LIST.findIndex((other) => other.id === templateId)
  const others = Array.from({ length: 4 }, (_, offset) => TEMPLATE_LIST[(position + offset + 1) % TEMPLATE_LIST.length])
  const title = t('detailTitle', { name })
  const fonts = [...new Set([template.heading.font, template.name.font])]

  const creativeWork: WithContext<CreativeWork> = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: title,
    description: t(`taglines.${templateId}`),
    url: absoluteUrl(templatePath(templateId)),
    inLanguage: locale,
    isAccessibleForFree: true,
    creator: { '@id': ORGANIZATION_ID },
    isPartOf: { '@type': 'WebSite', name: APP_NAME, url: absoluteUrl('/') },
  }

  return (
    <TemplateShapeProvider>
    <div className='mesh-bg'>
      <SheetFontsLink />
      <JsonLd
        data={[
          creativeWork,
          breadcrumbSchema([
            { name: tNav('home'), path: ROUTES.home },
            { name: tNav('templates'), path: ROUTES.templates },
            { name, path: templatePath(templateId) },
          ]),
        ]}
      />
      <div className='mx-auto grid max-w-page grid-cols-1 gap-8 px-4 pt-8 pb-12 sm:gap-12 sm:pt-10 sm:pb-16 md:px-6 lg:grid-cols-[1fr_1.1fr]'>
        <div className='lg:sticky lg:top-24 lg:self-start'>
          <nav aria-label='breadcrumb' className='text-sm text-muted'>
            <Link href={ROUTES.templates} className='no-underline hover:text-ink'>
              {tNav('templates')}
            </Link>{' '}
            / <span className='text-ink'>{name}</span>
          </nav>
          <h1 className='text-balance mt-4 font-display text-title font-extrabold tracking-tight text-ink sm:text-5xl'>{title}</h1>
          <p className='mt-3 text-base font-medium text-accent-strong sm:text-lg'>{t(`taglines.${templateId}`)}</p>
          <p className='mt-5 text-base leading-relaxed text-muted sm:text-lg'>{t('detailText')}</p>

          <dl className='mt-8 grid gap-5 sm:grid-cols-2'>
            <div>
              <dt className='text-xs font-semibold tracking-wider text-muted uppercase'>{t('style')}</dt>
              <dd className='m-0 mt-2 text-sm'>{t(`categories.${template.category}`)}</dd>
              <dt className='mt-4 text-xs font-semibold tracking-wider text-muted uppercase'>{t('price')}</dt>
              <dd className='m-0 mt-2 text-sm'>{template.free ? t('free') : t('premium')}</dd>
            </div>
            <div>
              <dt className='text-xs font-semibold tracking-wider text-muted uppercase'>{t('fonts')}</dt>
              <dd className='m-0 mt-2 text-sm'>
                {fonts.map((slug, index) => (
                  <Fragment key={slug}>
                    {index > 0 && ' · '}
                    <a href={fontSourceUrl(slug)} target='_blank' rel='noopener noreferrer' className='text-ink underline hover:text-accent-strong'>
                      {FONTS[slug].name}
                    </a>
                  </Fragment>
                ))}
              </dd>
            </div>
          </dl>

          <section className='mt-8' aria-labelledby='template-shape'>
            <h2 id='template-shape' className='m-0 text-xs font-semibold tracking-wider text-muted uppercase'>
              {tShapes('label')}
            </h2>
            <p className='m-0 mt-1.5 text-sm text-muted'>{tShapes('pageHint')}</p>
            <div className='mt-3'>
              <TemplateShapePicker />
            </div>
          </section>

          <div className='mt-9 flex flex-wrap gap-3'>
            <UseTemplateLink
              templateId={templateId}
              className='inline-flex items-center rounded-full bg-ink px-5 py-3 sm:px-6 sm:py-3.5 font-semibold text-white no-underline shadow-lg shadow-ink/20 transition hover:-translate-y-0.5'
            >
              {t('useThis')}
            </UseTemplateLink>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-4 sm:gap-6'>
          {PRINT_KINDS.map((kind, index) => (
            <figure key={kind} className={index === 0 ? 'col-span-2 m-0' : 'm-0'}>
              <div className='overflow-hidden rounded-xl shadow-[0_30px_70px_-25px_rgba(20,24,45,0.45)] ring-1 ring-black/5'>
                <ShapedSheetPreview doc={{ title: '', content: sampleContent(texts, kind === 'cards' ? 3 : 6), design: templateDesign(templateId, kind) }} />
              </div>
              <figcaption className='mt-2 text-center text-sm text-muted'>{tKinds(kind)}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      <section className='mx-auto max-w-page px-4 pb-10 md:px-6' aria-labelledby='other-templates'>
        <h2 id='other-templates' className='font-display text-xl font-extrabold text-ink sm:text-2xl'>
          {t('otherTemplates')}
        </h2>
        <div className='mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4'>
          {others.map((other) => (
            <TemplateCard key={other.id} template={other} texts={texts} />
          ))}
        </div>
      </section>
    </div>
    </TemplateShapeProvider>
  )
}
