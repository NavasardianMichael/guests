import type { FC } from 'react'
import { getTranslations } from 'next-intl/server'

const STEPS = ['list', 'arrange', 'print'] as const

export const Steps: FC = async () => {
  const t = await getTranslations('Home')
  return (
    <section className='bg-ink py-14 text-white sm:py-20' aria-labelledby='steps-title'>
      <div className='mx-auto max-w-7xl px-4 md:px-6'>
        <h2 id='steps-title' className='text-center font-display text-title font-extrabold tracking-tight text-white sm:text-4xl'>
          {t('stepsTitle')}
        </h2>
        <ol className='m-0 mt-10 grid list-none gap-5 p-0 sm:mt-14 sm:gap-8 md:grid-cols-3'>
          {STEPS.map((step, index) => (
            <li key={step} className='relative rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 sm:p-8'>
              <span className='font-display text-4xl font-extrabold text-accent sm:text-5xl'>{index + 1}</span>
              <h3 className='mt-3 mb-2 text-lg font-bold text-white sm:mt-4 sm:text-xl'>{t(`steps.${step}.title`)}</h3>
              <p className='m-0 leading-relaxed text-white/70'>{t(`steps.${step}.text`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
