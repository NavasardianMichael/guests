'use client'

import type { FC, ReactNode } from 'react'
import { AudioOutlined, CustomerServiceOutlined, LoginOutlined, PlusOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useTranslations } from 'next-intl'
import { DEFAULT_SEATS_PER_TABLE, MAX_TABLES, MAX_VENUE_ITEMS, useListEditorStoreBase } from '@store/lists/single/store'
import { type TableShape, VENUE_KINDS, type VenueKind } from '@store/lists/single/types'
import { useSampleTexts } from '@hooks/useSampleTexts'
import { TileButton } from '@components/ui/TileButton'

/** A round table seen from above: the top and its chairs. */
const RoundTableIcon: FC = () => (
  <svg viewBox='0 0 24 24' width='1em' height='1em' fill='none' stroke='currentColor' strokeWidth='1.8' aria-hidden='true'>
    <circle cx='12' cy='12' r='5.5' />
    <circle cx='12' cy='3' r='1.4' fill='currentColor' stroke='none' />
    <circle cx='12' cy='21' r='1.4' fill='currentColor' stroke='none' />
    <circle cx='3' cy='12' r='1.4' fill='currentColor' stroke='none' />
    <circle cx='21' cy='12' r='1.4' fill='currentColor' stroke='none' />
  </svg>
)

/** A long table seen from above: the top and a row of chairs on each side. */
const LongTableIcon: FC = () => (
  <svg viewBox='0 0 24 24' width='1em' height='1em' fill='none' stroke='currentColor' strokeWidth='1.8' aria-hidden='true'>
    <rect x='2.5' y='8.5' width='19' height='7' rx='1.2' />
    {[6, 12, 18].map((x) => (
      <g key={x} fill='currentColor' stroke='none'>
        <circle cx={x} cy='4.4' r='1.4' />
        <circle cx={x} cy='19.6' r='1.4' />
      </g>
    ))}
  </svg>
)

export const TABLE_SHAPE_ICONS: Record<TableShape, ReactNode> = { round: <RoundTableIcon />, rect: <LongTableIcon /> }

export const VENUE_ICONS: Record<VenueKind, ReactNode> = {
  stage: <AudioOutlined />,
  dancefloor: <CustomerServiceOutlined />,
  entrance: <LoginOutlined />,
}

type Choice = { key: string; label: string; icon: ReactNode; disabled: boolean; onAdd: () => void }

/**
 * What can be added to the hall: a round or a long table (named "Table N", as the sample's,
 * with ten chairs)
 * and a stage, dance floor or entrance (named for what they are). The new block is selected,
 * so it shows where the plan put it — the first free spot — ready to drag.
 */
const usePlanChoices = (): Choice[] => {
  const t = useTranslations('Editor.plan')
  const texts = useSampleTexts()
  const tables = useListEditorStoreBase((state) => state.doc?.content.tables.length ?? 0)
  const items = useListEditorStoreBase((state) => state.doc?.content.venue.length ?? 0)
  const addTable = (shape: TableShape) => {
    const store = useListEditorStoreBase.getState()
    // Chairs from the start: an empty table on a plan still shows how many it seats.
    store.select([store.addTable(texts.table(tables + 1), shape, DEFAULT_SEATS_PER_TABLE)])
  }
  const addItem = (kind: VenueKind) => {
    const store = useListEditorStoreBase.getState()
    store.select([store.addVenueItem(kind, texts.venue[kind])])
  }
  return [
    ...(['round', 'rect'] as const).map((shape) => ({
      key: shape,
      label: t(shape),
      icon: TABLE_SHAPE_ICONS[shape],
      disabled: tables >= MAX_TABLES,
      onAdd: () => addTable(shape),
    })),
    ...VENUE_KINDS.map((kind) => ({
      key: kind,
      label: t(`venue.${kind}`),
      icon: VENUE_ICONS[kind],
      disabled: items >= MAX_VENUE_ITEMS,
      onAdd: () => addItem(kind),
    })),
  ]
}

/** The Layout step's choices: tiles, which wrap long labels. */
export const PlanAddTiles: FC = () => {
  const choices = usePlanChoices()
  return (
    <div className='grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-3'>
      {choices.map((choice) => (
        <TileButton key={choice.key} icon={choice.icon} disabled={choice.disabled} onClick={choice.onAdd}>
          {choice.label}
        </TileButton>
      ))}
    </div>
  )
}

/** Over the canvas, above the plan: the same choices in one row that wraps. */
export const PlanToolbar: FC = () => {
  const t = useTranslations('Editor.plan')
  const choices = usePlanChoices()
  return (
    <div
      data-canvas-ui
      role='toolbar'
      aria-label={t('toolbar')}
      className='flex flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-surface p-2 shadow-sm ring-1 ring-black/5'
    >
      <span className='flex items-center gap-1 px-1 text-xs font-semibold text-muted'>
        <PlusOutlined aria-hidden='true' />
        {t('add')}
      </span>
      {choices.map((choice) => (
        // Inline: antd's own font size is unlayered and beats a Tailwind utility.
        <Button key={choice.key} size='small' icon={choice.icon} disabled={choice.disabled} onClick={choice.onAdd} style={{ fontSize: 12 }}>
          {choice.label}
        </Button>
      ))}
    </div>
  )
}
