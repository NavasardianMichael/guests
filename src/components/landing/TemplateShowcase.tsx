import type { FC } from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { sampleTexts } from '@i18n/sampleTexts'
import { ROUTES } from '@constants/routes'
import { type TemplateId, TEMPLATES } from '@constants/templates'
import { TemplateCard } from '@components/templates/TemplateCard'
import { ArrowRightOutlined } from '@components/ui/icons'

/** The free template first, then a spread of tastes — not the first six in catalogue order. */
const FEATURED: TemplateId[] = ['memorial', 'ivory', 'ornament', 'midnight', 'botanical', 'watercolor']

export const TemplateShowcase: FC = async () => {
  const t = await getTranslations('Home')
  const texts = await sampleTexts()
  return (
    <section className='mx-auto max-w-7xl px-4 py-14 sm:py-20 md:px-6' aria-labelledby='showcase-title'>
      <div className='flex flex-wrap items-end justify-between gap-6'>
        <div className='max-w-2xl min-w-0 flex-1 basis-md'>
          <h2 id='showcase-title' className='text-balance font-display text-title font-extrabold tracking-tight text-ink sm:text-4xl'>
            {t('templatesTitle')}
          </h2>
          <p className='mt-3 text-base text-muted sm:mt-4 sm:text-lg'>{t('templatesSubtitle')}</p>
        </div>
        <Link href={ROUTES.templates} className='inline-flex items-center gap-2 font-semibold text-ink no-underline hover:text-accent-strong'>
          {t('templatesAll')} <ArrowRightOutlined />
        </Link>
      </div>
      <div className='mt-10 grid grid-cols-1 gap-x-6 gap-y-10 sm:mt-12 sm:grid-cols-2 md:grid-cols-3'>
        {FEATURED.map((id) => (
          <TemplateCard key={id} template={TEMPLATES[id]} texts={texts} />
        ))}
      </div>
    </section>
  )
}
