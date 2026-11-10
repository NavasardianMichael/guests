import type { FC } from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import type { PrintKind } from '@store/lists/single/types'
import { sampleTexts } from '@i18n/sampleTexts'
import { ROUTES } from '@constants/routes'
import { type TemplateId, TEMPLATES } from '@constants/templates'
import { cn } from '@helpers/cn'
import { TemplateCard } from '@components/templates/TemplateCard'
import { ArrowRightOutlined } from '@components/ui/icons'

/**
 * One block per print kind, each in its own few templates — none repeated across blocks — so the
 * page shows the range without painting the catalogue. The seating board leads with the free
 * template and a spread of tastes, two rows; the others one row each. Hall plans are in
 * templates whose first page holds a full row of the sample's tables (in some, larger type
 * sends the tables to page two and the preview shows an empty hall).
 */
const BLOCKS: { kind: PrintKind; templates: TemplateId[] }[] = [
  { kind: 'seating', templates: ['memorial', 'ivory', 'ornament', 'midnight', 'botanical', 'watercolor'] },
  { kind: 'list', templates: ['pomegranate', 'manuscript', 'scandi'] },
  { kind: 'cards', templates: ['velvet', 'christening', 'kraft'] },
  { kind: 'plan', templates: ['carpet', 'emerald', 'tiles'] },
]

type BlockProps = { kind: PrintKind; templates: TemplateId[]; title: string; text: string; first: boolean }

const KindBlock: FC<BlockProps> = async ({ kind, templates, title, text, first }) => {
  const t = await getTranslations('Home')
  const tKinds = await getTranslations('Editor.layout.kinds')
  const texts = await sampleTexts()
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
      <div className='mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:mt-10 sm:grid-cols-2 md:grid-cols-3'>
        {templates.map((templateId) => (
          <TemplateCard key={templateId} template={TEMPLATES[templateId]} texts={texts} kind={kind} />
        ))}
      </div>
    </section>
  )
}

/** The templates, shown as each thing they print: seating board, guest list, place cards, hall plan. */
export const TemplateShowcase: FC = async () => {
  const t = await getTranslations('Home')
  return (
    <div className='mx-auto max-w-page px-4 py-14 sm:py-20 md:px-6'>
      {BLOCKS.map((block, index) => (
        <KindBlock
          key={block.kind}
          kind={block.kind}
          templates={block.templates}
          title={block.kind === 'seating' ? t('templatesTitle') : t(`showcase.${block.kind}.title`)}
          text={block.kind === 'seating' ? t('templatesSubtitle') : t(`showcase.${block.kind}.text`)}
          first={index === 0}
        />
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
