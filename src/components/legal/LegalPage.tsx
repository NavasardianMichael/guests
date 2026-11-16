import type { FC } from 'react'
import { getLocale, getTranslations } from 'next-intl/server'
import type { LegalDocument } from '@constants/legal'
import { formatDate } from '@helpers/date'
import { RichText } from '@components/content/RichText'

export const LegalPage: FC<{ document: LegalDocument }> = async ({ document }) => {
  const t = await getTranslations('Legal')
  const locale = await getLocale()
  return (
    <article className='mx-auto max-w-3xl px-4 py-10 sm:py-14 md:px-6'>
      <h1 className='m-0 font-display text-title font-extrabold tracking-tight text-ink sm:text-4xl'>{document.title}</h1>
      <p className='mt-3 text-sm text-muted'>{t('updated', { date: formatDate(document.updated, locale) })}</p>
      {document.sections.map((section) => (
        <section key={section.heading} className='mt-10'>
          <h2 className='m-0 text-lg font-bold text-ink sm:text-xl'>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className='mt-3 mb-0 leading-relaxed text-text'>
              <RichText text={paragraph} />
            </p>
          ))}
        </section>
      ))}
    </article>
  )
}
