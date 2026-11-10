import type { FC, ReactNode } from 'react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import type { LegalDocument } from '@constants/legal'
import { formatDate } from '@helpers/date'

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g

/** A paragraph's `[label](/path)` links as `<Link>`s; the rest stays text. */
const renderParagraph = (paragraph: string): ReactNode[] => {
  // `split` with two capture groups yields: text, label, href, text, label, href, …
  const parts = paragraph.split(LINK)
  return parts.map((part, index) => {
    if (index % 3 === 1) {
      return (
        <Link key={index} href={parts[index + 1]} className='font-medium text-ink underline'>
          {part}
        </Link>
      )
    }
    return index % 3 === 2 ? null : part
  })
}

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
              {renderParagraph(paragraph)}
            </p>
          ))}
        </section>
      ))}
    </article>
  )
}
