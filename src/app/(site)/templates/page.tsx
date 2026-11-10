import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ROUTES } from '@constants/routes'
import { pageMetadata } from '@helpers/metadata'
import { viewFromQuery } from '@helpers/templateQuery'
import { breadcrumbSchema, templatesListSchema } from '@linkedDataSchema/site'
import { JsonLd } from '@components/seo/JsonLd'
import { SheetFontsLink } from '@components/sheet/SheetFontsLink'
import { TemplateBrowser } from '@components/templates/TemplateBrowser'
import { TemplateShapeProvider } from '@components/templates/TemplateShape'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Templates')
  return pageMetadata({ title: t('metaTitle'), description: t('metaDescription'), path: ROUTES.templates })
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function TemplatesPage({ searchParams }: Props) {
  const t = await getTranslations('Templates')
  const tNav = await getTranslations('Nav')
  const view = viewFromQuery(await searchParams)
  return (
    <TemplateShapeProvider>
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
        <div className='mx-auto max-w-page px-4 pt-10 pb-10 sm:pt-14 md:px-6'>
          <h1 className='text-balance max-w-3xl font-display text-title font-extrabold tracking-tight text-ink sm:text-5xl'>
            {t('title')}
          </h1>
          <p className='mt-4 max-w-2xl text-base leading-relaxed text-muted sm:mt-5 sm:text-lg'>{t('subtitle')}</p>
          <TemplateBrowser key={`${view.kind}:${view.arrangement}`} kind={view.kind} arrangement={view.arrangement} />
        </div>
      </div>
    </TemplateShapeProvider>
  )
}
