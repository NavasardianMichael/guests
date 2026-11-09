'use client'

import { type FC, memo, useMemo } from 'react'
import { CheckCircleFilled } from '@ant-design/icons'
import { Skeleton } from 'antd'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import type { PrintKind, SheetShape } from '@store/lists/single/types'
import { useOwnedTemplates } from '@hooks/useOwnedTemplates'
import { newListPath, ROUTES } from '@constants/routes'
import { TEMPLATE_LIST, type TemplateId } from '@constants/templates'
import { cn } from '@helpers/cn'
import { sampleContent, templateDesign } from '@helpers/listFactory'
import { SheetPreview } from '@components/sheet/SheetPreview'
import { BoughtBadge } from '@components/templates/BoughtBadge'
import { ShapePicker } from '@components/templates/ShapePicker'
import { PanelSection } from './LayoutPanel'

/** A template's card: its look on a short sample list, in the sheet's own kind and shape. */
type ThumbProps = { id: TemplateId; kind: PrintKind; shape: SheetShape; free: boolean; bought: boolean; active: boolean; onPick: () => void }

const TemplateThumb: FC<ThumbProps> = memo(
  function TemplateThumb({ id, kind, shape, free, bought, active, onPick }) {
    const t = useTranslations('Templates')
    const tSamples = useTranslations('Samples')
    const doc = useMemo(
      () => ({
        title: '',
        content: sampleContent(
          {
            heading: tSamples('heading'),
            subheading: tSamples('subheading'),
            footer: tSamples('footer'),
            table: (number) => tSamples('table', { number }),
          },
          kind === 'cards' ? 2 : 6
        ),
        design: templateDesign(id, kind, shape),
      }),
      [id, kind, shape, tSamples]
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
        {bought && <BoughtBadge size='small' className='absolute top-1 left-1' />}
        <span className='block truncate px-1.5 py-1 text-center text-[11px] font-medium' title={t(`names.${id}`)}>
          {t(`names.${id}`)}
        </span>
        {active && <CheckCircleFilled className='absolute top-1.5 right-1.5 text-accent' />}
      </button>
    )
  }
)

/**
 * A list in a bought template keeps it (docs/PAYMENTS.md): a template is bought once for every
 * list its buyer makes, so a list's template choice ends with it. In its place: which template
 * this is, and the way to another one — a new list.
 */
const BoughtTemplate: FC<{ id: TemplateId; kind: PrintKind }> = ({ id, kind }) => {
  const t = useTranslations('Editor.template')
  const tTemplates = useTranslations('Templates')
  const name = tTemplates(`names.${id}`)
  return (
    <div className='flex flex-col gap-3 rounded-lg bg-canvas p-3 ring-1 ring-line'>
      <div className='flex items-center gap-2'>
        <BoughtBadge />
        <span className='min-w-0 truncate text-sm font-semibold text-ink'>{name}</span>
      </div>
      <p className='m-0 text-xs leading-relaxed text-muted'>{t('lockedText', { template: name })}</p>
      <div className='flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold'>
        <Link href={newListPath({ template: id, kind })} className='text-ink underline'>
          {t('newInThis')}
        </Link>
        <Link href={ROUTES.templates} className='text-ink underline'>
          {t('otherTemplates')}
        </Link>
      </div>
    </div>
  )
}

/**
 * The second step: the sheet's shape, then its template, every template shown in that kind and
 * shape. A template sets the colours, fonts, table style and decor (`applyTemplate`) and keeps
 * the shape; the design step then fine-tunes them. Place cards are always rectangles. A list in
 * a template its owner bought keeps it: only the shape stays to choose (`BoughtTemplate`).
 */
export const TemplatePanel: FC = () => {
  const t = useTranslations('Editor.tabs')
  const tShapes = useTranslations('Shapes')
  const owned = useOwnedTemplates()
  const kind = useListEditorStoreBase((state) => state.doc?.design.kind)
  const shape = useListEditorStoreBase((state) => state.doc?.design.shape)
  const templateId = useListEditorStoreBase((state) => state.doc?.design.templateId)
  const applyTemplate = useListEditorStore.use.applyTemplate()
  const setDesign = useListEditorStore.use.setDesign()
  if (!kind || !shape || !templateId) return null
  const cards = kind === 'cards'

  return (
    <div>
      <PanelSection title={tShapes('label')} hint={cards ? tShapes('cardsNote') : tShapes('hint')}>
        {!cards && <ShapePicker value={shape} onChange={(next) => setDesign({ shape: next })} />}
      </PanelSection>
      <PanelSection title={t('template')}>
        {owned === null ? (
          // Until the bought templates are known, no choice is offered that may not be allowed.
          <Skeleton active paragraph={{ rows: 4 }} title={false} />
        ) : owned.includes(templateId) ? (
          <BoughtTemplate id={templateId} kind={kind} />
        ) : (
          <div role='radiogroup' aria-label={t('template')} className='grid grid-cols-3 gap-2'>
            {TEMPLATE_LIST.map((template) => (
              <TemplateThumb
                key={template.id}
                id={template.id}
                kind={kind}
                shape={cards ? 'rectangle' : shape}
                free={template.free}
                bought={owned.includes(template.id)}
                active={templateId === template.id}
                onPick={() => applyTemplate(template.id)}
              />
            ))}
          </div>
        )}
      </PanelSection>
    </div>
  )
}
