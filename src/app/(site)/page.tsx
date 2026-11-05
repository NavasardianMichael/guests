import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { APP_NAME } from '@constants/app'
import { ROUTES } from '@constants/routes'
import { pageMetadata } from '@helpers/metadata'
import { organizationSchema, webApplicationSchema, websiteSchema } from '@linkedDataSchema/site'
import { Faq } from '@components/landing/Faq'
import { Features } from '@components/landing/Features'
import { FinalCta } from '@components/landing/FinalCta'
import { Hero } from '@components/landing/Hero'
import { Steps } from '@components/landing/Steps'
import { TemplateShowcase } from '@components/landing/TemplateShowcase'
import { JsonLd } from '@components/seo/JsonLd'
import { SheetFontsLink } from '@components/sheet/SheetFontsLink'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Home')
  const tMeta = await getTranslations('Meta')
  return pageMetadata({ title: `${APP_NAME} — ${t('metaTitle')}`, description: tMeta('description'), path: ROUTES.home, absoluteTitle: true })
}

export default function HomePage() {
  return (
    <>
      <SheetFontsLink />
      <JsonLd data={[organizationSchema(), websiteSchema(), webApplicationSchema()]} />
      <Hero />
      <Features />
      <Steps />
      <TemplateShowcase />
      <Faq />
      <FinalCta />
    </>
  )
}
