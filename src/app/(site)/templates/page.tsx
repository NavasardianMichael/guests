import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { sampleTexts } from '@i18n/sampleTexts'
import { ROUTES } from '@constants/routes'
import { TEMPLATE_LIST } from '@constants/templates'
import { pageMetadata } from '@helpers/metadata'
import { breadcrumbSchema, templatesListSchema } from '@linkedDataSchema/site'
import { JsonLd } from '@components/seo/JsonLd'
import { SheetFontsLink } from '@components/sheet/SheetFontsLink'
import { TemplateCard } from '@components/templates/TemplateCard'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Templates')
  return pageMetadata({ title: t('metaTitle'), description: t('metaDescription'), path: ROUTES.templates })
}

export default async function TemplatesPage() {
  const t = await getTranslations('Templates')
  const tNav = await getTranslations('Nav')
  const texts = await sampleTexts()
  return (
    <div className='mesh-bg'>
      <SheetFontsLink />
      <JsonLd
        data={[
          templatesListSchema((id) => t(`names.${id}`), t('metaTitle')),
          breadcrumbSchema([
            { name: tNav('home'), path: ROUTES.home },
            { name: tNav('templates'), path: ROUTES.templates },
          ]),
        ]}
      />
      <div className='mx-auto max-w-7xl px-4 pt-10 pb-10 sm:pt-14 md:px-6'>
        <h1 className='text-balance max-w-3xl font-display text-title font-extrabold tracking-tight text-ink sm:text-5xl'>{t('title')}</h1>
        <p className='mt-4 max-w-2xl text-base leading-relaxed text-muted sm:mt-5 sm:text-lg'>{t('subtitle')}</p>
        <div className='mt-10 grid grid-cols-1 gap-x-6 gap-y-10 sm:mt-14 sm:gap-y-12 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'>
          {TEMPLATE_LIST.map((template) => (
            <TemplateCard key={template.id} template={template} texts={texts} headingLevel='h2' />
          ))}
        </div>
      </div>
    </div>
  )
}
