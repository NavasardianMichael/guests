'use client'

import { type FC, memo, type ReactNode, useMemo } from 'react'
import { CheckCircleFilled, IdcardOutlined, TableOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { useTranslations } from 'next-intl'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import { PRINT_KINDS, type PrintKind } from '@store/lists/single/types'
import type { TemplateId } from '@constants/templates'
import { cn } from '@helpers/cn'
import { sampleContent, templateDesign } from '@helpers/listFactory'
import { SheetPreview } from '@components/sheet/SheetPreview'

export const KIND_ICONS: Record<PrintKind, ReactNode> = {
  seating: <TableOutlined />,
  list: <UnorderedListOutlined />,
  cards: <IdcardOutlined />,
}

/** One kind as a choice: what it looks like in the sheet's template, its name and what it is for. */
const KindOption: FC<{ kind: PrintKind; templateId: TemplateId; active: boolean; onPick: () => void }> = memo(
  function KindOption({ kind, templateId, active, onPick }) {
    const t = useTranslations('Editor.layout')
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
        design: templateDesign(templateId, kind),
      }),
      [kind, templateId, tSamples]
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

/** The first step: what is being made — a seating chart, a guest list or place cards. */
export const KindPanel: FC = () => {
  const t = useTranslations('Editor.layout')
  const kind = useListEditorStoreBase((state) => state.doc?.design.kind)
  const templateId = useListEditorStoreBase((state) => state.doc?.design.templateId)
  const setDesign = useListEditorStore.use.setDesign()
  if (!kind || !templateId) return null

  return (
    <div role='radiogroup' aria-label={t('kind')} className='flex flex-col gap-2.5'>
      {PRINT_KINDS.map((value) => (
        <KindOption
          key={value}
          kind={value}
          templateId={templateId}
          active={kind === value}
          onPick={() => setDesign({ kind: value })}
        />
      ))}
    </div>
  )
}
