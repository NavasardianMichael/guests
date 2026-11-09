'use client'

import { type FC, memo, type ReactNode, useMemo } from 'react'
import { CheckCircleFilled, IdcardOutlined, LayoutOutlined, TableOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { useTranslations } from 'next-intl'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import { PRINT_KINDS, type PrintKind, type SheetShape } from '@store/lists/single/types'
import { useSampleTexts } from '@hooks/useSampleTexts'
import type { TemplateId } from '@constants/templates'
import { cn } from '@helpers/cn'
import { startingPlanScale } from '@helpers/fitSheet'
import { sampleContent, templateDesign } from '@helpers/listFactory'
import { measureText } from '@helpers/measureText'
import { SheetPreview } from '@components/sheet/SheetPreview'

export const KIND_ICONS: Record<PrintKind, ReactNode> = {
  seating: <TableOutlined />,
  list: <UnorderedListOutlined />,
  cards: <IdcardOutlined />,
  plan: <LayoutOutlined />,
}

/** One kind as a choice: what it looks like in the sheet's template and shape, its name and what it is for. */
const KindOption: FC<{ kind: PrintKind; templateId: TemplateId; shape: SheetShape; active: boolean; onPick: () => void }> = memo(
  function KindOption({ kind, templateId, shape, active, onPick }) {
    const t = useTranslations('Editor.layout')
    const texts = useSampleTexts()
    const doc = useMemo(
      () => ({
        title: '',
        content: sampleContent(texts, kind === 'cards' ? 2 : 6),
        design: templateDesign(templateId, kind, kind === 'cards' ? 'rectangle' : shape),
      }),
      [kind, shape, templateId, texts]
    )

    return (
      <button
        type='button'
        role='radio'
        aria-checked={active}
        onClick={onPick}
        className={cn(
          'relative flex w-full cursor-pointer items-center gap-3 rounded-xl border-2 bg-surface p-2.5 text-left transition',
          active ? 'border-accent bg-accent-soft' : 'border-transparent ring-1 ring-line hover:ring-ink/30'
        )}
      >
        <span className='w-24 shrink-0 overflow-hidden rounded-md bg-canvas shadow-sm ring-1 ring-black/5'>
          <SheetPreview doc={doc} />
        </span>
        <span className='flex min-w-0 flex-1 flex-col gap-1 pr-5'>
          <span className='flex items-center gap-2 text-sm leading-snug font-semibold text-ink'>
            <span className={cn('flex text-base', active ? 'text-accent-strong' : 'text-muted')}>
              {KIND_ICONS[kind]}
            </span>
            {t(`kinds.${kind}`)}
          </span>
          <span className='text-xs leading-relaxed text-muted'>{t(`kindHint.${kind}`)}</span>
        </span>
        {active && <CheckCircleFilled className='absolute top-2.5 right-2.5 text-accent' />}
      </button>
    )
  }
)

/** The first step: what is being made — a seating chart, a guest list, place cards or the hall plan. */
export const KindPanel: FC = () => {
  const t = useTranslations('Editor.layout')
  const kind = useListEditorStoreBase((state) => state.doc?.design.kind)
  const templateId = useListEditorStoreBase((state) => state.doc?.design.templateId)
  const shape = useListEditorStoreBase((state) => state.doc?.design.shape)
  const setDesign = useListEditorStore.use.setDesign()
  const fitToPage = useListEditorStore.use.fitToPage()
  if (!kind || !templateId || !shape) return null

  /**
   * A hall arranged by the app that runs onto a second page starts fitted to one (smaller
   * letters), as the canvas's "fit to the page" would: a plan is read at a glance.
   */
  const pick = (value: PrintKind) => {
    setDesign({ kind: value })
    const doc = useListEditorStoreBase.getState().doc
    const textScale = doc ? startingPlanScale(doc, measureText) : null
    if (textScale !== null) fitToPage({ columns: 0, textScale })
  }

  return (
    <div role='radiogroup' aria-label={t('kind')} className='flex flex-col gap-2.5'>
      {PRINT_KINDS.map((value) => (
        <KindOption
          key={value}
          kind={value}
          templateId={templateId}
          shape={shape}
          active={kind === value}
          onPick={() => pick(value)}
        />
      ))}
    </div>
  )
}
