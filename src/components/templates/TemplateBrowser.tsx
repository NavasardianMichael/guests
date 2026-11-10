'use client'

import { type FC, useEffect, useMemo, useState } from 'react'
import { IdcardOutlined, LayoutOutlined, TableOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { useTranslations } from 'next-intl'
import { type ListDocument, PLAN_ARRANGEMENTS, type PlanArrangement, PRINT_KINDS, type PrintKind } from '@store/lists/single/types'
import { useSampleTexts } from '@hooks/useSampleTexts'
import { templatesPath } from '@constants/routes'
import { TEMPLATE_LIST, type TemplateId } from '@constants/templates'
import { cn } from '@helpers/cn'
import { previewDocument } from '@helpers/listFactory'
import { TemplateCard } from './TemplateCard'
import { ShapedSheetPreview, TemplateShapePicker, useTemplateShapePending } from './TemplateShape'

const KIND_ICON = {
  seating: TableOutlined,
  list: UnorderedListOutlined,
  plan: LayoutOutlined,
  cards: IdcardOutlined,
} as const

/** One skin for the arrangement row, so the four halls differ by how the tables sit. */
const ARRANGEMENT_TEMPLATE: TemplateId = 'carpet'

type Props = { kind: PrintKind; arrangement: PlanArrangement }

/**
 * The catalogue as each thing a template prints. Choosing updates at once; the URL
 * (`?kind=plan&arrangement=around`) follows, so a shared link and a refresh open on the same
 * view. The hall plan adds its four arrangements, and the templates below are set out that way.
 */
export const TemplateBrowser: FC<Props> = ({ kind: kindProp, arrangement: arrangementProp }) => {
  const t = useTranslations('Templates')
  const tKinds = useTranslations('Editor.layout.kinds')
  const tHint = useTranslations('Editor.layout.kindHint')
  const tShapes = useTranslations('Shapes')
  const tArrangement = useTranslations('Editor.plan.arrangement')
  const texts = useSampleTexts()
  const [kind, setKind] = useState(kindProp)
  const [arrangement, setArrangement] = useState(arrangementProp)
  // What the catalogue is drawing. A frame behind the tabs: the choice and the spinner paint
  // first, and only then does every sheet lay out again.
  const [drawn, setDrawn] = useState({ kind: kindProp, arrangement: arrangementProp })
  const [catchingUp, setCatchingUp] = useState(false)
  const shapePending = useTemplateShapePending()

  useEffect(() => {
    if (drawn.kind === kind && drawn.arrangement === arrangement) {
      // After the sheets have committed, not in the render that builds them.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (catchingUp) setCatchingUp(false)
      return
    }
    let timer = 0
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => setDrawn({ kind, arrangement }), 0)
    })
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [arrangement, catchingUp, drawn, kind])

  const halls = useMemo(
    () => (drawn.kind === 'plan' ? PLAN_ARRANGEMENTS.map((value) => previewDocument(texts, ARRANGEMENT_TEMPLATE, 'plan', value)) : null),
    [drawn.kind, texts]
  )
  const pending = catchingUp || shapePending

  const show = (nextKind: PrintKind, nextArrangement: PlanArrangement): void => {
    if (nextKind !== kind || nextArrangement !== arrangement) setCatchingUp(true)
    setKind(nextKind)
    setArrangement(nextArrangement)
    // Kept off the Next navigation so the sheets stay mounted and only the chosen ones redraw.
    // The history entry is the one this page was opened on; refresh and a shared link use the URL.
    window.history.replaceState(window.history.state, '', templatesPath({ kind: nextKind, arrangement: nextArrangement }))
  }

  return (
    <>
      <div className='mt-8 w-fit max-w-full sm:mt-10 lg:max-w-[62rem]' role='tablist' aria-label={t('kindsLabel')}>
        <div className='flex flex-wrap gap-2 lg:flex-nowrap'>
          {PRINT_KINDS.map((value) => {
            const Icon = KIND_ICON[value]
            const active = kind === value
            return (
              <button
                key={value}
                type='button'
                role='tab'
                id={`templates-kind-${value}`}
                aria-selected={active}
                aria-controls='templates-gallery'
                onClick={() => show(value, arrangement)}
                className={cn(
                  'inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold whitespace-nowrap transition',
                  active ? 'bg-ink text-white shadow-sm' : 'bg-surface text-ink ring-1 ring-line hover:ring-ink/30'
                )}
              >
                <Icon />
                {tKinds(value)}
              </button>
            )
          })}
        </div>
        <p className='m-0 mt-3 max-w-3xl text-sm leading-relaxed text-muted'>{tHint(kind)}</p>
      </div>

      {halls && (
        <div className={cn(shapePending && 'pointer-events-none opacity-40 transition-opacity')}>
          <ArrangementRow halls={halls} arrangement={arrangement} onPick={(value) => show('plan', value)} label={tArrangement('title')} name={(value) => tArrangement(`names.${value}`)} />
        </div>
      )}

      {kind === 'plan' && <p className='m-0 mt-3 max-w-3xl text-sm leading-relaxed text-muted'>{tArrangement(`hints.${arrangement}`)}</p>}

      <section className='mt-8 max-w-3xl sm:mt-10' aria-labelledby='templates-shape'>
        <h2 id='templates-shape' className='m-0 text-xs font-semibold tracking-wider text-muted uppercase'>
          {tShapes('label')}
        </h2>
        <p className='m-0 mt-1.5 text-sm text-muted'>{kind === 'cards' ? tShapes('cardsNote') : tShapes('galleryHint')}</p>
        <div className={cn('mt-3', kind === 'cards' && 'pointer-events-none opacity-50')}>
          <TemplateShapePicker />
        </div>
      </section>

      <div className='relative mt-10 sm:mt-14'>
        {pending && (
          <div className='pointer-events-none absolute inset-0 z-20'>
            <div className='sticky top-28 flex justify-center'>
              <span role='status' className='inline-flex items-center gap-2.5 rounded-full bg-surface/95 px-4 py-2.5 text-sm font-semibold text-ink shadow-lg ring-1 ring-line'>
                <span className='size-4 animate-spin rounded-full border-2 border-line border-t-ink' aria-hidden='true' />
                {t('updating')}
              </span>
            </div>
          </div>
        )}
        <div
          id='templates-gallery'
          role='tabpanel'
          aria-labelledby={`templates-kind-${kind}`}
          aria-busy={pending}
          className={cn(
            'grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 sm:gap-y-12',
            drawn.kind === 'plan' ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-3 xl:grid-cols-4',
            pending && 'pointer-events-none opacity-40 transition-opacity'
          )}
        >
          {TEMPLATE_LIST.map((template) => (
            <TemplateCard key={template.id} template={template} kind={drawn.kind} arrangement={drawn.arrangement} headingLevel='h2' />
          ))}
        </div>
      </div>
    </>
  )
}

const ArrangementRow: FC<{
  halls: ListDocument[]
  arrangement: PlanArrangement
  onPick: (arrangement: PlanArrangement) => void
  label: string
  name: (arrangement: PlanArrangement) => string
}> = ({ halls, arrangement, onPick, label, name }) => (
  <section className='mt-8' aria-labelledby='templates-arrangement'>
    <h2 id='templates-arrangement' className='m-0 text-xs font-semibold tracking-wider text-muted uppercase'>
      {label}
    </h2>
    <div role='radiogroup' aria-label={label} className='mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4'>
      {PLAN_ARRANGEMENTS.map((value, index) => {
        const active = arrangement === value
        return (
          <button
            key={value}
            type='button'
            role='radio'
            aria-checked={active}
            onClick={() => onPick(value)}
            className={cn(
              'cursor-pointer rounded-2xl bg-surface p-2 text-left transition',
              active ? 'ring-2 ring-ink' : 'ring-1 ring-line hover:-translate-y-0.5 hover:ring-ink/30'
            )}
          >
            <span className='block overflow-hidden rounded-xl bg-canvas ring-1 ring-black/5'>
              <ShapedSheetPreview doc={halls[index]} />
            </span>
            <span className='mt-2 block px-1 text-sm leading-snug font-semibold text-ink'>{name(value)}</span>
          </button>
        )
      })}
    </div>
  </section>
)
