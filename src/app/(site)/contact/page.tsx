import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ROUTES } from '@constants/routes'
import { pageMetadata } from '@helpers/metadata'
import { breadcrumbSchema } from '@linkedDataSchema/site'
import { ContactDetails } from '@components/contact/ContactDetails'
import { ContactForm } from '@components/contact/ContactForm'
import { JsonLd } from '@components/seo/JsonLd'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Contact')
  return pageMetadata({ title: t('metaTitle'), description: t('metaDescription'), path: ROUTES.contact })
}

export default async function ContactPage() {
  const t = await getTranslations('Contact')
  const tNav = await getTranslations('Nav')

  return (
    <div className='mesh-bg flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center gap-10 px-4 py-10 sm:gap-12 sm:py-14'>
      <JsonLd
        data={breadcrumbSchema([
          { name: tNav('home'), path: ROUTES.home },
          { name: tNav('contact'), path: ROUTES.contact },
        ])}
      />
      <div className='w-full max-w-lg rounded-3xl bg-surface p-6 shadow-[0_30px_70px_-30px_rgba(20,24,45,0.35)] ring-1 ring-line sm:p-10'>
        <h1 className='m-0 font-display text-title font-extrabold tracking-tight text-ink sm:text-3xl'>{t('title')}</h1>
        <p className='mt-2 mb-0 text-muted'>{t('subtitle')}</p>
        <div className='mt-8'>
          <ContactForm />
        </div>
      </div>
      <ContactDetails />
    </div>
  )
}
