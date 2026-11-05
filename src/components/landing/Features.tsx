import type { FC, ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { BgColorsOutlined, CameraOutlined, DragOutlined, FileOutlined, FontSizeOutlined, PrinterOutlined } from '@components/ui/icons'

const FEATURES: { key: string; icon: ReactNode }[] = [
  { key: 'import', icon: <CameraOutlined /> },
  { key: 'arrange', icon: <DragOutlined /> },
  { key: 'templates', icon: <BgColorsOutlined /> },
  { key: 'paper', icon: <FileOutlined /> },
  { key: 'fonts', icon: <FontSizeOutlined /> },
  { key: 'print', icon: <PrinterOutlined /> },
]

export const Features: FC = async () => {
  const t = await getTranslations('Home')
  return (
    <section className='mx-auto max-w-7xl px-4 py-14 sm:py-20 md:px-6' aria-labelledby='features-title'>
      <div className='mx-auto max-w-2xl text-center'>
        <h2 id='features-title' className='text-balance font-display text-title font-extrabold tracking-tight text-ink sm:text-4xl'>
          {t('featuresTitle')}
        </h2>
        <p className='mt-3 text-base text-muted sm:mt-4 sm:text-lg'>{t('featuresSubtitle')}</p>
      </div>
      <ul className='m-0 mt-10 grid list-none gap-4 sm:mt-14 sm:gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3'>
        {FEATURES.map((feature) => (
          <li key={feature.key} className='rounded-2xl bg-surface p-6 ring-1 sm:p-7 ring-line transition hover:shadow-lg'>
            <span className='grid size-10 place-items-center rounded-xl bg-accent-soft text-lg text-accent-strong sm:size-12 sm:text-xl' aria-hidden='true'>
              {feature.icon}
            </span>
            <h3 className='mt-4 mb-2 text-base font-bold text-ink sm:mt-5 sm:text-lg'>{t(`features.${feature.key}.title`)}</h3>
            <p className='m-0 leading-relaxed text-muted'>{t(`features.${feature.key}.text`)}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
