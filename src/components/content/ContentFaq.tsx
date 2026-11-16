import type { FC } from 'react'
import { getTranslations } from 'next-intl/server'
import type { FaqItem } from '@content/types'
import { plainText } from '@helpers/inlineMarkup'
import { faqSchema } from '@linkedDataSchema/site'
import { JsonLd } from '@components/seo/JsonLd'
import { RichText } from './RichText'

/**
 * A page's questions, open rather than folded (they are the content people search for), and
 * the FAQPage JSON-LD from the same strings, marks removed. On a questions-only page each
 * question is an `<h2>`; elsewhere they sit under one "Questions" `<h2>`.
 */
export const ContentFaq: FC<{ items: FaqItem[]; headingLevel?: 'h2' | 'h3' }> = async ({ items, headingLevel = 'h3' }) => {
  const t = await getTranslations('Content')
  const Question = headingLevel
  return (
    <section id='hartser' className='mt-14 scroll-mt-24' aria-labelledby='faq-heading'>
      <JsonLd data={faqSchema(items.map((item) => ({ question: item.question, answer: plainText(item.answer) })))} />
      {headingLevel === 'h3' ? (
        <h2 id='faq-heading' className='m-0 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-[1.75rem]'>
          {t('faqTitle')}
        </h2>
      ) : (
        <span id='faq-heading' className='sr-only'>
          {t('faqTitle')}
        </span>
      )}
      <div className='mt-6 flex flex-col gap-3'>
        {items.map((item) => (
          <div key={item.question} className='rounded-2xl bg-surface p-5 ring-1 ring-line'>
            <Question className='m-0 text-lg font-bold text-ink'>{item.question}</Question>
            <p className='m-0 mt-2 leading-relaxed text-text'>
              <RichText text={item.answer} />
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
