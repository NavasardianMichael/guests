import type { FC } from 'react'
import { getTranslations } from 'next-intl/server'
import type { PrintKind } from '@store/lists/single/types'
import { templatePath } from '@constants/routes'
import type { TemplateMeta } from '@constants/templates'
import { cn } from '@helpers/cn'
import { sampleContent, type SampleTexts, templateDesign } from '@helpers/listFactory'
import { TemplateCardLink, TemplateCardPending } from './TemplateCardLink'
import { ShapedSheetPreview } from './TemplateShape'

type Props = { template: TemplateMeta; texts: SampleTexts; kind?: PrintKind; className?: string; headingLevel?: 'h2' | 'h3' }

/**
 * A template's live preview (the sample wedding as `kind`, a seating board unless told) linking
 * to its own page; place cards from a few tables, so the sheet shows whole cards. In the
 * gallery and on a template's page, in the shape picked there (`TemplateShapeProvider`). The
 * free template says so; the others print with an access pass (docs/PAYMENTS.md).
 */
export const TemplateCard: FC<Props> = async ({ template, texts, kind = 'seating', className, headingLevel: Heading = 'h3' }) => {
  const t = await getTranslations('Templates')
  return (
    <TemplateCardLink
      href={templatePath(template.id)}
      className={cn('group block rounded-2xl text-inherit no-underline focus-visible:outline-offset-4', className)}
    >
      <div className='relative overflow-hidden rounded-2xl bg-surface shadow-[0_10px_30px_-12px_rgba(20,24,45,0.25)] ring-1 ring-black/5 transition duration-300 group-hover:-translate-y-1.5 group-hover:shadow-[0_24px_50px_-16px_rgba(20,24,45,0.35)]'>
        <ShapedSheetPreview
          doc={{ title: '', content: sampleContent(texts, kind === 'cards' ? 3 : undefined), design: templateDesign(template.id, kind) }}
        />
        {template.free && (
          <span className='absolute top-3 right-3 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-semibold text-ink shadow-sm'>
            {t('free')}
          </span>
        )}
        <TemplateCardPending />
      </div>
      <div className='mt-4 px-1'>
        <Heading className='m-0 font-display text-lg font-bold text-ink'>{t(`names.${template.id}`)}</Heading>
        <p className='m-0 mt-1 text-sm text-muted'>{t(`taglines.${template.id}`)}</p>
      </div>
    </TemplateCardLink>
  )
}
