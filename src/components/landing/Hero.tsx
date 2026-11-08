import type { CSSProperties, FC } from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import type { PrintKind } from '@store/lists/single/types'
import { sampleTexts } from '@i18n/sampleTexts'
import { FONT_SLUGS } from '@constants/fonts'
import { newListPath, ROUTES } from '@constants/routes'
import { TEMPLATE_IDS, type TemplateId } from '@constants/templates'
import { sampleContent, templateDesign } from '@helpers/listFactory'
import { SheetPreview } from '@components/sheet/SheetPreview'
import { ArrowRightOutlined } from '@components/ui/icons'

/**
 * Three real sheets, laid out live from the sample wedding, fanned out like papers on a desk:
 * a seating board, a guest list, place cards. Delays are negative: the tilt lives in the
 * keyframes, so a positive delay would draw the card untilted until its animation starts.
 */
const STACK: { id: TemplateId; kind: PrintKind; className: string; tilt: string; delay: string }[] = [
  { id: 'botanical', kind: 'list', className: 'left-0 top-10 w-[44%] z-10', tilt: '-7deg', delay: '0s' },
  { id: 'ornament', kind: 'seating', className: 'right-0 top-6 w-[44%] z-10', tilt: '6deg', delay: '-1.2s' },
  { id: 'ivory', kind: 'seating', className: 'left-1/2 top-0 w-[52%] -translate-x-1/2 z-20', tilt: '0deg', delay: '-0.6s' },
]

export const Hero: FC = async () => {
  const t = await getTranslations('Home')
  const texts = await sampleTexts()

  return (
    <section className='mesh-bg overflow-hidden'>
      <div className='mx-auto grid max-w-page items-center gap-10 px-4 pt-10 pb-14 sm:gap-12 sm:pt-14 sm:pb-20 md:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-28'>
        <div>
          <span className='inline-flex items-center gap-2 rounded-full bg-surface/80 px-3.5 py-1.5 text-sm font-medium text-ink shadow-sm ring-1 ring-line'>
            <span className='size-2 rounded-full bg-accent' aria-hidden='true' />
            {t('eyebrow')}
          </span>
          <h1 className='text-balance mt-6 font-display text-title leading-[1.08] [--title-em:13] [--title-max:2.25rem] font-extrabold tracking-tight text-ink sm:text-5xl lg:text-5xl'>
            {t('heroTitle')} <span className='text-accent'>{t('heroTitleAccent')}</span>
          </h1>
          <p className='mt-5 max-w-xl text-base leading-relaxed text-muted sm:mt-6 sm:text-lg'>{t('heroSubtitle')}</p>
          <div className='mt-8 flex flex-wrap items-center gap-3'>
            <Link
              href={ROUTES.templates}
              className='inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 sm:px-6 sm:py-3.5 text-base font-semibold text-white no-underline shadow-lg shadow-ink/20 transition hover:-translate-y-0.5 hover:bg-ink-deep'
            >
              {t('heroSecondary')} <ArrowRightOutlined />
            </Link>
            <Link
              href={newListPath()}
              className='inline-flex items-center rounded-full bg-surface px-5 py-3 sm:px-6 sm:py-3.5 text-base font-semibold text-ink no-underline ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-ink/30'
            >
              {t('heroCta')}
            </Link>
          </div>
          <p className='mt-4 text-sm text-muted'>{t('heroNote')}</p>
          <dl className='mt-10 grid max-w-lg grid-cols-3 gap-4'>
            {[
              { value: String(TEMPLATE_IDS.length), label: t('stats.templates') },
              { value: String(FONT_SLUGS.length), label: t('stats.fonts') },
              { value: '3', label: t('stats.kinds') },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className='sr-only'>{stat.label}</dt>
                <dd className='m-0 font-display text-2xl font-extrabold text-ink sm:text-3xl'>{stat.value}</dd>
                <dd className='m-0 mt-1 text-xs leading-snug text-muted sm:text-sm'>{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <Link
          href={ROUTES.templates}
          aria-label={t('heroTemplates')}
          className='relative mx-auto block aspect-[1.15] w-full max-w-xl rounded-xl transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent'
        >
          {STACK.map((item) => (
            <div
              key={item.id}
              className={`animate-float absolute ${item.className}`}
              style={{ '--tilt': item.tilt, animationDelay: item.delay } as CSSProperties}
              aria-hidden='true'
            >
              <div className='overflow-hidden rounded-md shadow-[0_30px_60px_-20px_rgba(20,24,45,0.45)] ring-1 ring-black/5'>
                <SheetPreview doc={{ title: '', content: sampleContent(texts), design: templateDesign(item.id, item.kind) }} />
              </div>
            </div>
          ))}
        </Link>
      </div>
    </section>
  )
}
