'use client'

import { type FC, memo, useMemo } from 'react'
import { CheckCircleFilled } from '@ant-design/icons'
import { useTranslations } from 'next-intl'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import { type ListDocument, PLAN_ARRANGEMENTS, type PlanArrangement } from '@store/lists/single/types'
import { cn } from '@helpers/cn'
import { startingPlanScale } from '@helpers/fitSheet'
import { withArrangement } from '@helpers/listFactory'
import { measureText } from '@helpers/measureText'
import { SheetPreview } from '@components/sheet/SheetPreview'

/** The list set out by `arrangement`, at the text size it starts at (smaller, when it would not fit otherwise). */
const arranged = (doc: ListDocument, arrangement: PlanArrangement): ListDocument => {
  const next = withArrangement(doc, arrangement)
  const textScale = startingPlanScale(next, measureText)
  return textScale === null ? next : { ...next, design: { ...next.design, textScale } }
}

type OptionProps = { arrangement: PlanArrangement; doc: ListDocument; active: boolean; onPick: (doc: ListDocument) => void }

/** One arrangement: the user's own hall set out by it, its name and what it is. */
const ArrangementOption: FC<OptionProps> = memo(function ArrangementOption({ arrangement, doc, active, onPick }) {
  const t = useTranslations('Editor.plan.arrangement')
  const preview = useMemo(() => arranged(doc, arrangement), [arrangement, doc])
  return (
    <button
      type='button'
      role='radio'
      aria-checked={active}
      onClick={() => onPick(preview)}
      className={cn(
        'relative flex cursor-pointer flex-col gap-1.5 rounded-lg border-2 bg-surface p-1.5 text-left transition',
        active ? 'border-accent bg-accent-soft' : 'border-transparent ring-1 ring-line hover:ring-ink/30'
      )}
    >
      <span className='block overflow-hidden rounded-md bg-canvas shadow-sm ring-1 ring-black/5'>
        <SheetPreview doc={preview} />
      </span>
      <span className='px-0.5 text-xs leading-snug font-semibold text-ink'>{t(`names.${arrangement}`)}</span>
      <span className='px-0.5 pb-0.5 text-[11px] leading-snug text-muted'>{t(`hints.${arrangement}`)}</span>
      {active && <CheckCircleFilled className='absolute top-2.5 right-2.5 text-accent' />}
    </button>
  )
})

/**
 * The hall plan's arrangements, each shown on the list's own tables and hall: picking one sets
 * the hall out by it (`setArrangement`) — what was moved by hand goes back, long or round
 * tables as the arrangement has them, the letters smaller when it would not fit the page.
 */
export const ArrangementPicker: FC = () => {
  const t = useTranslations('Editor.plan.arrangement')
  const content = useListEditorStoreBase((state) => state.doc?.content)
  const design = useListEditorStoreBase((state) => state.doc?.design)
  const setArrangement = useListEditorStore.use.setArrangement()
  // Moving a block on the canvas changes only the positions, which no preview shows: the
  // previews are laid out again when what they draw changes, not on every drag.
  const base = useMemo(
    () => (content && design ? { title: '', content, design: { ...design, plan: { ...design.plan, positions: {} } } } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [content, design?.templateId, design?.shape, design?.paper, design?.palette, design?.type, design?.textScale, design?.tableStyle, design?.decor, design?.layout, design?.plan.sizes, design?.plan.arrangement]
  )
  if (!base || !design) return null
  const byHand = Object.keys(design.plan.positions).length > 0

  return (
    <div className='flex flex-col gap-2'>
      <div role='radiogroup' aria-label={t('title')} className='grid grid-cols-2 gap-2'>
        {PLAN_ARRANGEMENTS.map((arrangement) => (
          <ArrangementOption
            key={arrangement}
            arrangement={arrangement}
            doc={base}
            active={design.plan.arrangement === arrangement && !byHand}
            onPick={(preview) => setArrangement(arrangement, preview.design.textScale)}
          />
        ))}
      </div>
      {byHand && <p className='m-0 text-xs leading-relaxed text-muted'>{t('pinned')}</p>}
    </div>
  )
}
