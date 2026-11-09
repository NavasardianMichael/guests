import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { formatAmount, PASS_DAYS, PASS_PRICE_AMD } from '@constants/pricing'
import { newListPath, ROUTES } from '@constants/routes'
import { FREE_TEMPLATE_ID } from '@constants/templates'
import { pageMetadata } from '@helpers/metadata'
import { breadcrumbSchema, webApplicationSchema } from '@linkedDataSchema/site'
import { Faq } from '@components/landing/Faq'
import { JsonLd } from '@components/seo/JsonLd'
import { CheckOutlined, ClockCircleOutlined } from '@components/ui/icons'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Pricing')
  const tCommon = await getTranslations('Common')
  const price = tCommon('amount', { amount: formatAmount(PASS_PRICE_AMD) })
  return pageMetadata({ title: t('metaTitle'), description: t('metaDescription', { price, days: PASS_DAYS }), path: ROUTES.pricing })
}

/**
 * The model (docs/PAYMENTS.md): free to build and preview, the free template prints free, and
 * an access pass opens everything for `PASS_DAYS`. Below the plans, what happens when the days
 * end (nothing is deleted) and how long unused lists are kept.
 */
export default async function PricingPage() {
  const t = await getTranslations('Pricing')
  const tNav = await getTranslations('Nav')
  const tCommon = await getTranslations('Common')
  const tDownload = await getTranslations('Editor.download')
  const tTemplates = await getTranslations('Templates')
  const freeItems = t.raw('freeItems') as string[]
  const paidItems = t.raw('paidItems') as string[]
  const price = tCommon('amount', { amount: formatAmount(PASS_PRICE_AMD) })

  return (
    <div className='mesh-bg'>
      <JsonLd
        data={[
          webApplicationSchema(),
          breadcrumbSchema([
            { name: tNav('home'), path: ROUTES.home },
            { name: tNav('pricing'), path: ROUTES.pricing },
          ]),
        ]}
      />
      <div className='mx-auto max-w-5xl px-4 pt-10 sm:pt-14 md:px-6'>
        <div className='text-center'>
          <h1 className='font-display text-title font-extrabold tracking-tight text-ink sm:text-5xl'>{t('title')}</h1>
          <p className='mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted sm:mt-5 sm:text-lg'>{t('subtitle', { days: PASS_DAYS })}</p>
        </div>

        <div className='mt-10 grid gap-5 sm:mt-14 sm:gap-6 md:grid-cols-2'>
          <div className='rounded-3xl bg-surface p-6 ring-1 ring-line sm:p-8'>
            <h2 className='m-0 text-base font-bold text-muted sm:text-lg'>{t('free')}</h2>
            <p className='mt-2 mb-5 font-display text-4xl font-extrabold text-ink sm:mt-3 sm:mb-6 sm:text-5xl'>{t('freePrice')}</p>
            <ul className='m-0 flex list-none flex-col gap-3 p-0'>
              {freeItems.map((item) => (
                <li key={item} className='flex gap-3'>
                  <CheckOutlined className='mt-1 text-success' /> {item}
                </li>
              ))}
            </ul>
          </div>

          <div className='relative overflow-hidden rounded-3xl bg-ink p-6 text-white shadow-2xl shadow-ink/30 sm:p-8'>
            <div className='pointer-events-none absolute -top-20 -right-20 size-60 rounded-full bg-accent opacity-30 blur-3xl' aria-hidden='true' />
            <h2 className='relative m-0 text-base font-bold text-white/70 sm:text-lg'>{t('paid')}</h2>
            <p className='relative mt-2 mb-1 font-display text-4xl font-extrabold text-white sm:mt-3 sm:text-5xl'>{price}</p>
            <p className='relative mt-0 mb-6 text-white/60'>{t('perPass', { days: PASS_DAYS })}</p>
            <ul className='relative m-0 flex list-none flex-col gap-3 p-0'>
              {paidItems.map((item) => (
                <li key={item} className='flex gap-3'>
                  <CheckOutlined className='mt-1 text-accent' /> {item}
                </li>
              ))}
            </ul>
            <Link
              href={newListPath()}
              className='relative mt-6 flex justify-center rounded-full bg-accent px-5 py-3 sm:px-6 sm:py-3.5 font-semibold text-white no-underline transition hover:bg-accent-strong sm:mt-8'
            >
              {t('cta')}
            </Link>
          </div>
        </div>

        <section className='mt-5 rounded-3xl bg-surface p-6 ring-1 ring-line sm:mt-6 sm:p-8' aria-labelledby='pricing-after'>
          <h2 id='pricing-after' className='m-0 flex items-center gap-2 text-base font-bold text-ink sm:text-lg'>
            <ClockCircleOutlined className='text-accent' aria-hidden='true' />
            {t('afterTitle', { days: PASS_DAYS })}
          </h2>
          <p className='mt-3 mb-0 leading-relaxed text-muted'>
            {tDownload('afterText', { free: tTemplates(`names.${FREE_TEMPLATE_ID}`), days: PASS_DAYS })}
          </p>
          <p className='mt-3 mb-0 text-sm leading-relaxed text-muted'>{t('keptText')}</p>
        </section>
      </div>
      <Faq />
    </div>
  )
}
