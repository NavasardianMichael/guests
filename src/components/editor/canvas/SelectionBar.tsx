'use client'

import type { FC, ReactNode } from 'react'
import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  BorderHorizontalOutlined,
  BorderVerticleOutlined,
  ColumnHeightOutlined,
  ColumnWidthOutlined,
  CompressOutlined,
  DeleteOutlined,
  EditOutlined,
  RollbackOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons'
import { Button, InputNumber, Segmented, Select } from 'antd'
import { useTranslations } from 'next-intl'
import { MAX_SEATS, placementOf, useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import { FOOTER_ID, HEADER_ID, type Position, TABLE_SHAPES, type TableShape } from '@store/lists/single/types'
import { round, type SheetBlock, type SheetLayout } from '@helpers/sheetLayout'
import type { EditTarget } from '@components/sheet/SheetInteraction'
import { HintTooltip } from '@components/ui/HintTooltip'
import { TABLE_SHAPE_ICONS } from '../plan/PlanAdd'

type Props = {
  layout: SheetLayout
  onEdit: (target: EditTarget) => void
}

const Tool: FC<{ title: string; icon: ReactNode; onClick: () => void; danger?: boolean }> = ({ title, icon, onClick, danger }) => (
  <HintTooltip title={title}>
    <Button type='text' size='small' icon={icon} aria-label={title} danger={danger} onClick={onClick} />
  </HintTooltip>
)

type AlignKind = 'left' | 'center' | 'right' | 'top'

/**
 * What can be done to the selected blocks, floating over the canvas: open the text, seat a
 * guest, remove; pick up a whole column or row; in free mode line blocks up, space them evenly,
 * or send them back to their grid place. On the hall plan, a table's shape and chairs.
 */
export const SelectionBar: FC<Props> = ({ layout, onEdit }) => {
  const t = useTranslations('Editor.selection')
  const selection = useListEditorStore.use.selection()
  const doc = useListEditorStore.use.doc()
  if (!doc || !selection.length) return null

  const { select, removeGuests, removeTable, removeVenueItems, updateGuest, updateTable, setPositions, resetPositions, resetSizes } =
    useListEditorStoreBase.getState()
  const plan = doc.design.kind === 'plan'
  // The hall plan is always arranged by hand; its places and sizes are its own.
  const free = plan || doc.design.layout.mode === 'free'
  const placement = placementOf(doc.design)
  const blocks = new Map<string, SheetBlock>()
  for (const block of layout.blocks) if (!blocks.has(block.id)) blocks.set(block.id, block)
  const selected = selection.map((id) => blocks.get(id)).filter((block): block is SheetBlock => Boolean(block))
  const guestIds = selection.filter((id) => doc.content.guests.some((guest) => guest.id === id))
  const tableIds = selection.filter((id) => doc.content.tables.some((table) => table.id === id))
  const itemIds = selection.filter((id) => doc.content.venue.some((item) => item.id === id))
  const single = selection.length === 1 ? selection[0] : null
  const singleGuest = single ? doc.content.guests.find((guest) => guest.id === single) : undefined
  const singleTable = single ? doc.content.tables.find((table) => table.id === single) : undefined
  const singleItem = single ? doc.content.venue.find((item) => item.id === single) : undefined
  const anchor = selected[0]

  const remove = () => {
    if (guestIds.length) removeGuests(guestIds)
    for (const id of tableIds) removeTable(id)
    if (itemIds.length) removeVenueItems(itemIds)
    select([])
  }

  const selectLine = (axis: 'x' | 'y') => {
    if (!anchor) return
    const ids = [...blocks.values()]
      .filter((block) => block.page === anchor.page && Math.abs(block[axis] - anchor[axis]) < 1 && block.id !== HEADER_ID && block.id !== FOOTER_ID)
      .map((block) => block.id)
    select(ids)
  }

  const onPage = anchor ? selected.filter((block) => block.page === anchor.page) : []

  const align = (kind: AlignKind) => {
    if (onPage.length < 2) return
    const positions: Record<string, Position> = {}
    const left = Math.min(...onPage.map((b) => b.x))
    const right = Math.max(...onPage.map((b) => b.x + b.w))
    const top = Math.min(...onPage.map((b) => b.y))
    const center = onPage.reduce((sum, b) => sum + b.x + b.w / 2, 0) / onPage.length
    for (const block of onPage) {
      const x = kind === 'left' ? left : kind === 'right' ? right - block.w : kind === 'center' ? center - block.w / 2 : block.x
      const y = kind === 'top' ? top : block.y
      positions[block.id] = { page: block.page, x: round(x), y: round(y) }
    }
    setPositions(positions)
  }

  const distribute = (axis: 'x' | 'y') => {
    if (onPage.length < 3) return
    const size = axis === 'x' ? 'w' : 'h'
    const sorted = [...onPage].sort((a, b) => a[axis] - b[axis])
    const start = sorted[0][axis]
    const end = sorted[sorted.length - 1][axis] + sorted[sorted.length - 1][size]
    const total = sorted.reduce((sum, b) => sum + b[size], 0)
    const gap = (end - start - total) / (sorted.length - 1)
    const positions: Record<string, Position> = {}
    let cursor = start
    for (const block of sorted) {
      positions[block.id] = { page: block.page, x: round(axis === 'x' ? cursor : block.x), y: round(axis === 'y' ? cursor : block.y) }
      cursor += block[size] + gap
    }
    setPositions(positions)
  }

  const editTarget: EditTarget | null = singleGuest
    ? { kind: 'guest', id: singleGuest.id }
    : singleTable
      ? { kind: 'table', id: singleTable.id }
      : singleItem
        ? { kind: 'item', id: singleItem.id }
        : single === HEADER_ID
        ? { kind: 'heading' }
        : single === FOOTER_ID
          ? { kind: 'footer' }
          : null

  return (
    <div
      data-canvas-ui
      className='pointer-events-auto flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-0.5 rounded-xl bg-surface px-2 py-1 shadow-lg ring-1 ring-black/5'
      role='toolbar'
      aria-label={t('label')}
    >
      <span className='px-1.5 text-xs font-medium text-muted'>{t('count', { count: selection.length })}</span>
      {editTarget && <Tool title={t('edit')} icon={<EditOutlined />} onClick={() => onEdit(editTarget)} />}
      {singleGuest && doc.content.tables.length > 0 && (
        <Select
          size='small'
          className='w-40'
          value={singleGuest.tableId || ''}
          aria-label={t('table')}
          onChange={(tableId: string) => updateGuest(singleGuest.id, { tableId })}
          options={[{ value: '', label: t('noTable') }, ...doc.content.tables.map((table) => ({ value: table.id, label: table.name || '—' }))]}
          showSearch={{ optionFilterProp: 'label' }}
        />
      )}
      {plan && singleTable && (
        <>
          <Segmented<TableShape>
            size='small'
            aria-label={t('shape')}
            value={singleTable.shape}
            onChange={(shape) => updateTable(singleTable.id, { shape })}
            options={TABLE_SHAPES.map((shape) => ({ value: shape, icon: TABLE_SHAPE_ICONS[shape], title: t(shape), label: t(shape) }))}
          />
          <HintTooltip title={t('seatsHint')}>
            <InputNumber
              size='small'
              className='w-24'
              min={0}
              max={MAX_SEATS}
              value={singleTable.seats}
              prefix={<span className='text-xs text-muted'>{t('seats')}</span>}
              aria-label={t('seats')}
              onChange={(seats) => seats !== null && updateTable(singleTable.id, { seats })}
            />
          </HintTooltip>
        </>
      )}
      {anchor && single && single !== HEADER_ID && single !== FOOTER_ID && !plan && (
        <>
          <Tool title={t('selectColumn')} icon={<ColumnHeightOutlined />} onClick={() => selectLine('x')} />
          <Tool title={t('selectRow')} icon={<ColumnWidthOutlined />} onClick={() => selectLine('y')} />
        </>
      )}
      {free && onPage.length >= 2 && (
        <>
          <span className='mx-1 h-5 w-px bg-line' aria-hidden='true' />
          <Tool title={t('alignLeft')} icon={<AlignLeftOutlined />} onClick={() => align('left')} />
          <Tool title={t('alignCenter')} icon={<AlignCenterOutlined />} onClick={() => align('center')} />
          <Tool title={t('alignRight')} icon={<AlignRightOutlined />} onClick={() => align('right')} />
          <Tool title={t('alignTop')} icon={<VerticalAlignTopOutlined />} onClick={() => align('top')} />
        </>
      )}
      {free && onPage.length >= 3 && (
        <>
          <Tool title={t('distributeX')} icon={<BorderVerticleOutlined />} onClick={() => distribute('x')} />
          <Tool title={t('distributeY')} icon={<BorderHorizontalOutlined />} onClick={() => distribute('y')} />
        </>
      )}
      {free && selected.some((block) => placement.positions[block.id]) && (
        <Tool
          title={t(plan ? 'placeAuto' : 'resetPosition')}
          icon={<RollbackOutlined />}
          onClick={() => resetPositions(selected.map((block) => block.id))}
        />
      )}
      {selected.some((block) => placement.sizes[block.id]) && (
        <Tool title={t('resetSize')} icon={<CompressOutlined />} onClick={() => resetSizes(selected.map((block) => block.id))} />
      )}
      {(guestIds.length > 0 || tableIds.length > 0 || itemIds.length > 0) && (
        <>
          <span className='mx-1 h-5 w-px bg-line' aria-hidden='true' />
          <Tool title={t('remove')} icon={<DeleteOutlined />} danger onClick={remove} />
        </>
      )}
    </div>
  )
}
