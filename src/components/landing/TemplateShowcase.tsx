import type { FC, ReactNode } from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import type { PlanArrangement, PrintKind } from '@store/lists/single/types'
import { sampleTexts } from '@i18n/sampleTexts'
import { ROUTES, templatePath } from '@constants/routes'
import { type TemplateId, TEMPLATES } from '@constants/templates'
import { cn } from '@helpers/cn'
import { previewDocument, type SampleTexts } from '@helpers/listFactory'
import { TemplateCard } from '@components/templates/TemplateCard'
import { TemplateCardLink, TemplateCardPending } from '@components/templates/TemplateCardLink'
import { ShapedSheetPreview } from '@components/templates/TemplateShape'
import { ArrowRightOutlined } from '@components/ui/icons'

/**
 * One block per print kind. The seating board leads, then the hall — its four arrangements,
 * each on a different template, so the block shows how the tables are set out and not four
 * recolourings of one layout. The guest list and the place cards follow. Templates are not
 * repeated across the blocks. Hall templates are ones whose first page holds the sample hall
 * (larger type can send the tables to page two; the preview then fits the letters down).
 */
const SEATING: TemplateId[] = ['memorial', 'ivory', 'ornament', 'midnight', 'botanical', 'watercolor']

const LATER: { kind: Exclude<PrintKind, 'plan' | 'seating'>; templates: TemplateId[] }[] = [
  { kind: 'list', templates: ['pomegranate', 'manuscript', 'scandi'] },
  { kind: 'cards', templates: ['velvet', 'christening', 'kraft'] },
]

/** Hall examples: one arrangement each, on a template that keeps the sample hall on the first page. */
const PLAN_SHOWCASE: { arrangement: PlanArrangement; templateId: TemplateId }[] = [
  { arrangement: 'rows', templateId: 'carpet' },
  { arrangement: 'around', templateId: 'emerald' },
  { arrangement: 'sides', templateId: 'tiles' },
  { arrangement: 'banquet', templateId: 'blacktie' },
]

type BlockProps = { kind: PrintKind; title: string; text: string; first: boolean; wide?: boolean; children: ReactNode }

const KindBlock: FC<BlockProps> = async ({ kind, title, text, first, wide, children }) => {
  const t = await getTranslations('Home')
  const tKinds = await getTranslations('Editor.layout.kinds')
  const id = `showcase-${kind}`
  return (
    <section className={cn(!first && 'mt-16 sm:mt-24')} aria-labelledby={id}>
      <div className='flex flex-wrap items-end justify-between gap-6'>
        <div className='max-w-2xl min-w-0 flex-1 basis-md'>
          <span className='inline-flex items-center gap-2 rounded-full bg-surface/80 px-3 py-1 text-xs font-semibold text-ink shadow-sm ring-1 ring-line'>
            <span className='size-1.5 rounded-full bg-accent' aria-hidden='true' />
            {tKinds(kind)}
          </span>
          {/* Every block is a section of the page; the first, leading them, is drawn larger. */}
          <h2
            id={id}
            className={cn(
              'text-balance mt-4 font-display font-extrabold tracking-tight text-ink',
              first ? 'text-title sm:text-4xl' : 'text-2xl sm:text-3xl'
            )}
          >
            {title}
          </h2>
          <p className='mt-3 text-base text-muted sm:mt-4 sm:text-lg'>{text}</p>
        </div>
        {first && (
          <Link href={ROUTES.templates} className='inline-flex items-center gap-2 font-semibold text-ink no-underline hover:text-accent-strong'>
            {t('templatesAll')} <ArrowRightOutlined />
          </Link>
        )}
      </div>
      <div
        className={cn(
          'mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:mt-10',
          wide ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-2 md:grid-cols-3'
        )}
      >
        {children}
      </div>
    </section>
  )
}

/** One hall arrangement, on its template, opening that template's page on the same hall. */
const ArrangementCard: FC<{ arrangement: PlanArrangement; templateId: TemplateId; texts: SampleTexts }> = async ({
  arrangement,
  templateId,
  texts,
}) => {
  const t = await getTranslations('Editor.plan.arrangement')
  return (
    <TemplateCardLink
      href={templatePath(templateId, { kind: 'plan', arrangement })}
      className='group block rounded-2xl text-inherit no-underline focus-visible:outline-offset-4'
    >
      <div className='relative overflow-hidden rounded-2xl bg-surface shadow-[0_10px_30px_-12px_rgba(20,24,45,0.25)] ring-1 ring-black/5 transition duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_24px_50px_-16px_rgba(20,24,45,0.35)]'>
        <ShapedSheetPreview doc={previewDocument(texts, templateId, 'plan', arrangement)} />
        <TemplateCardPending />
      </div>
      <div className='mt-4 px-1'>
        <h3 className='m-0 font-display text-lg font-bold text-ink'>{t(`names.${arrangement}`)}</h3>
        <p className='m-0 mt-1 text-sm text-muted'>{t(`hints.${arrangement}`)}</p>
      </div>
    </TemplateCardLink>
  )
}

/** The templates, shown as each thing they print: seating board, hall plan, guest list, place cards. */
export const TemplateShowcase: FC = async () => {
  const t = await getTranslations('Home')
  const texts = await sampleTexts()
  return (
    <div className='mx-auto max-w-page px-4 py-14 sm:py-20 md:px-6'>
      <KindBlock kind='seating' title={t('templatesTitle')} text={t('templatesSubtitle')} first>
        {SEATING.map((templateId) => (
          <TemplateCard key={templateId} template={TEMPLATES[templateId]} kind='seating' />
        ))}
      </KindBlock>
      <KindBlock kind='plan' title={t('showcase.plan.title')} text={t('showcase.plan.text')} first={false} wide>
        {PLAN_SHOWCASE.map((item) => (
          <ArrangementCard key={item.arrangement} arrangement={item.arrangement} templateId={item.templateId} texts={texts} />
        ))}
      </KindBlock>
      {LATER.map((block) => (
        <KindBlock key={block.kind} kind={block.kind} title={t(`showcase.${block.kind}.title`)} text={t(`showcase.${block.kind}.text`)} first={false}>
          {block.templates.map((templateId) => (
            <TemplateCard key={templateId} template={TEMPLATES[templateId]} kind={block.kind} />
          ))}
        </KindBlock>
      ))}
      <div className='mt-12 flex justify-center sm:mt-16'>
        <Link
          href={ROUTES.templates}
          className='inline-flex items-center gap-2 rounded-full bg-surface px-5 py-3 text-base font-semibold text-ink no-underline ring-1 ring-line transition hover:-translate-y-0.5 hover:ring-ink/30 sm:px-6 sm:py-3.5'
        >
          {t('templatesAll')} <ArrowRightOutlined />
        </Link>
      </div>
    </div>
  )
}
