'use client'

import { type FC, memo, useMemo } from 'react'
import { CheckCircleFilled } from '@ant-design/icons'
import { useTranslations } from 'next-intl'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import type { PrintKind, SheetShape } from '@store/lists/single/types'
import { useAccessUntil, useNow } from '@hooks/useAccess'
import { useFormatDate } from '@hooks/useFormatDate'
import { useSampleTexts } from '@hooks/useSampleTexts'
import { formatAmount, isAccessActive, PASS_DAYS, PASS_PRICE_AMD } from '@constants/pricing'
import { FREE_TEMPLATE_ID, TEMPLATE_LIST, type TemplateId } from '@constants/templates'
import { cn } from '@helpers/cn'
import { sampleContent, templateDesign } from '@helpers/listFactory'
import { SheetPreview } from '@components/sheet/SheetPreview'
import { ShapePicker } from '@components/templates/ShapePicker'
import { PanelSection } from './LayoutPanel'
import { ArrangementPicker } from '../plan/ArrangementPicker'

/** A template's card: its look on a short sample list, in the sheet's own kind and shape. */
type ThumbProps = { id: TemplateId; kind: PrintKind; shape: SheetShape; free: boolean; active: boolean; onPick: () => void }

const TemplateThumb: FC<ThumbProps> = memo(
  function TemplateThumb({ id, kind, shape, free, active, onPick }) {
    const t = useTranslations('Templates')
    const texts = useSampleTexts()
    const doc = useMemo(
      () => ({
        title: '',
        content: sampleContent(texts, kind === 'cards' ? 2 : 6),
        design: templateDesign(id, kind, shape),
      }),
      [id, kind, shape, texts]
    )
    return (
      <button
        type='button'
        role='radio'
        aria-checked={active}
        onClick={onPick}
        className={cn(
          'group relative cursor-pointer overflow-hidden rounded-lg border-2 bg-surface p-0 text-left transition',
          active ? 'border-accent' : 'border-transparent ring-1 ring-line hover:ring-ink/30'
        )}
      >
        <SheetPreview doc={doc} />
        {free && (
          <span className='absolute top-1 left-1 rounded-full bg-ink/85 px-1.5 py-0.5 text-[9px] leading-none font-semibold text-white shadow-sm'>
            {t('free')}
          </span>
        )}
        <span className='block truncate px-1.5 py-1 text-center text-[11px] font-medium' title={t(`names.${id}`)}>
          {t(`names.${id}`)}
        </span>
        {active && <CheckCircleFilled className='absolute top-1.5 right-1.5 text-accent' />}
      </button>
    )
  }
)

/**
 * Under the templates: what downloading needs (docs/PAYMENTS.md). Without a running pass, that
 * every template is free to try and only "Classic" downloads free; with one, until when every
 * template downloads clean. Nothing until the pass is known.
 */
const useAccessHint = (): string | undefined => {
  const t = useTranslations('Editor.template')
  const tTemplates = useTranslations('Templates')
  const tCommon = useTranslations('Common')
  const formatDate = useFormatDate()
  const until = useAccessUntil()
  const now = useNow()
  if (until === undefined) return undefined
  if (isAccessActive(until, now)) return t('accessHint', { date: formatDate(until!) })
  return t('premiumHint', {
    free: tTemplates(`names.${FREE_TEMPLATE_ID}`),
    price: tCommon('amount', { amount: formatAmount(PASS_PRICE_AMD) }),
    days: PASS_DAYS,
  })
}

/**
 * The second step: the sheet's shape, then its template, every template shown in that kind and
 * shape. A template sets the colours, fonts, table style and decor (`applyTemplate`) and keeps
 * the shape; the design step then fine-tunes them. The hall plan first picks how its hall is
 * set out (`ArrangementPicker`). Place cards are always rectangles. Any template may be picked
 * and previewed; whether it downloads is the access pass's business (`useAccessHint`).
 */
export const TemplatePanel: FC = () => {
  const t = useTranslations('Editor.tabs')
  const tShapes = useTranslations('Shapes')
  const tArrangement = useTranslations('Editor.plan.arrangement')
  const accessHint = useAccessHint()
  const kind = useListEditorStoreBase((state) => state.doc?.design.kind)
  const shape = useListEditorStoreBase((state) => state.doc?.design.shape)
  const templateId = useListEditorStoreBase((state) => state.doc?.design.templateId)
  const applyTemplate = useListEditorStore.use.applyTemplate()
  const setDesign = useListEditorStore.use.setDesign()
  if (!kind || !shape || !templateId) return null
  const cards = kind === 'cards'

  return (
    <div>
      {kind === 'plan' && (
        <PanelSection title={tArrangement('title')} hint={tArrangement('hint')}>
          <ArrangementPicker />
        </PanelSection>
      )}
      <PanelSection title={tShapes('label')} hint={cards ? tShapes('cardsNote') : tShapes('hint')}>
        {!cards && <ShapePicker value={shape} onChange={(next) => setDesign({ shape: next })} />}
      </PanelSection>
      <PanelSection title={t('template')} hint={accessHint}>
        <div role='radiogroup' aria-label={t('template')} className='grid grid-cols-3 gap-2'>
          {TEMPLATE_LIST.map((template) => (
            <TemplateThumb
              key={template.id}
              id={template.id}
              kind={kind}
              shape={cards ? 'rectangle' : shape}
              free={template.free}
              active={templateId === template.id}
              onPick={() => applyTemplate(template.id)}
            />
          ))}
        </div>
      </PanelSection>
    </div>
  )
}
