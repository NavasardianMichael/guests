'use client'

import { type DragEvent, type FC, memo, useMemo, useRef, useState } from 'react'
import {
  CameraOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  HolderOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
  SnippetsOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { App, Button, Dropdown, Input, InputNumber, Popconfirm, Segmented } from 'antd'
import { useTranslations } from 'next-intl'
import { useEditorUiStore } from '@store/editorUi/store'
import { MAX_GUESTS, useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import type { Guest, GuestTable } from '@store/lists/single/types'
import { cn } from '@helpers/cn'

type TableOption = { id: string; name: string }

const DRAG_TYPE = 'application/x-guest-id'

const startRowDrag = (event: DragEvent, guestId: string) => {
  event.dataTransfer.setData(DRAG_TYPE, guestId)
  event.dataTransfer.effectAllowed = 'move'
}

const draggedGuest = (event: DragEvent): string | null => event.dataTransfer.getData(DRAG_TYPE) || null

type RowProps = {
  guest: Guest
  index: number
  tables: TableOption[]
  showTable: boolean
  showNote: boolean
  selected: boolean
  noTableLabel: string
  onDropGuest: (draggedId: string, before: Guest) => void
}

/**
 * One guest. Native inputs, not antd's: a list runs to hundreds of rows, and each row
 * re-renders only when its own guest changes (`memo` + immer's structural sharing).
 */
const GuestRow: FC<RowProps> = memo(function GuestRow({ guest, index, tables, showTable, showNote, selected, noTableLabel, onDropGuest }) {
  const t = useTranslations('Editor.guests')
  const [over, setOver] = useState(false)
  const { updateGuest, removeGuests, select } = useListEditorStoreBase.getState()
  return (
    <li
      className={cn(
        'group flex items-center gap-1 rounded-lg border border-transparent px-1 py-0.5 transition-colors',
        selected && 'border-accent bg-accent-soft/50',
        over && 'border-t-accent'
      )}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(DRAG_TYPE)) return
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        setOver(false)
        const dragged = draggedGuest(event)
        if (dragged && dragged !== guest.id) onDropGuest(dragged, guest)
      }}
    >
      <span
        className='cursor-grab px-0.5 text-muted opacity-40 group-hover:opacity-100'
        draggable
        onDragStart={(event) => startRowDrag(event, guest.id)}
        aria-hidden='true'
      >
        <HolderOutlined />
      </span>
      <span className='w-6 shrink-0 text-right text-[11px] text-muted tabular-nums'>{index + 1}</span>
      <input
        className='min-w-0 flex-1 rounded-md border-0 bg-transparent px-1.5 py-1 text-sm outline-none focus:bg-surface focus:ring-1 focus:ring-line'
        value={guest.name}
        placeholder={t('namePlaceholder')}
        aria-label={t('name')}
        maxLength={120}
        onFocus={() => select([guest.id])}
        onChange={(event) => updateGuest(guest.id, { name: event.target.value })}
      />
      {showNote && (
        <input
          className='w-20 min-w-0 rounded-md border-0 bg-transparent px-1.5 py-1 text-xs text-muted outline-none focus:bg-surface focus:ring-1 focus:ring-line'
          value={guest.note}
          placeholder={t('notePlaceholder')}
          aria-label={t('note')}
          maxLength={120}
          onChange={(event) => updateGuest(guest.id, { note: event.target.value })}
        />
      )}
      {showTable && (
        <select
          className='w-24 shrink-0 cursor-pointer truncate rounded-md border border-line bg-surface px-1 py-1 text-xs'
          value={guest.tableId}
          aria-label={t('table')}
          onChange={(event) => updateGuest(guest.id, { tableId: event.target.value })}
        >
          <option value=''>{noTableLabel}</option>
          {tables.map((table) => (
            <option key={table.id} value={table.id}>
              {table.name || '—'}
            </option>
          ))}
        </select>
      )}
      <button
        type='button'
        className='cursor-pointer rounded-md border-0 bg-transparent p-1 text-muted opacity-0 group-hover:opacity-100 hover:text-danger focus:opacity-100'
        aria-label={t('remove')}
        onClick={() => removeGuests([guest.id])}
      >
        <DeleteOutlined />
      </button>
    </li>
  )
})

/** Type a name, press Enter, type the next: the quickest way to write a list by hand. */
const QuickAdd: FC<{ tables: TableOption[]; showTable: boolean }> = ({ tables, showTable }) => {
  const t = useTranslations('Editor.guests')
  const addGuest = useListEditorStore.use.addGuest()
  const [name, setName] = useState('')
  const [tableId, setTableId] = useState('')
  const count = useListEditorStoreBase((state) => state.doc?.content.guests.length ?? 0)
  const full = count >= MAX_GUESTS

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed || full) return
    addGuest(trimmed, tables.some((table) => table.id === tableId) ? tableId : '')
    setName('')
  }

  return (
    <div className='flex gap-1.5'>
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onPressEnter={submit}
        placeholder={full ? t('full', { max: MAX_GUESTS }) : t('quickAdd')}
        aria-label={t('quickAdd')}
        disabled={full}
        maxLength={120}
        prefix={<PlusOutlined className='text-muted' />}
      />
      {showTable && tables.length > 0 && (
        <select
          className='w-24 shrink-0 cursor-pointer rounded-lg border border-line bg-surface px-1 text-xs'
          value={tableId}
          aria-label={t('table')}
          onChange={(event) => setTableId(event.target.value)}
        >
          <option value=''>{t('noTable')}</option>
          {tables.map((table) => (
            <option key={table.id} value={table.id}>
              {table.name || '—'}
            </option>
          ))}
        </select>
      )}
      <Button type='primary' icon={<PlusOutlined />} onClick={submit} disabled={!name.trim() || full} aria-label={t('add')} />
    </div>
  )
}

/** Seats everyone without a table, `seats` to a table, opening new tables as needed. */
const AutoSeat: FC = () => {
  const t = useTranslations('Editor.guests')
  const tSamples = useTranslations('Samples')
  const autoSeat = useListEditorStore.use.autoSeat()
  const [seats, setSeats] = useState(10)
  return (
    <div className='flex flex-wrap items-center gap-2 rounded-lg bg-canvas p-2 text-xs'>
      <ThunderboltOutlined className='text-accent-strong' />
      <span>{t('autoSeat')}</span>
      <InputNumber size='small' className='w-16' min={1} max={100} value={seats} onChange={(value) => value && setSeats(value)} aria-label={t('seats')} />
      <span>{t('autoSeatPer')}</span>
      <Button size='small' onClick={() => autoSeat(seats, (number) => tSamples('table', { number }))}>
        {t('autoSeatGo')}
      </Button>
    </div>
  )
}

type GroupProps = {
  table: GuestTable | null
  guests: Guest[]
  tables: TableOption[]
  selection: ReadonlySet<string>
  noTableLabel: string
  showNote: boolean
  onDropGuest: (draggedId: string, before: Guest) => void
}

/** A table and the guests at it — or the guests at none — taking dropped rows. */
const TableGroup: FC<GroupProps> = ({ table, guests, tables, selection, noTableLabel, showNote, onDropGuest }) => {
  const t = useTranslations('Editor.guests')
  const { renameTable, removeTable, updateGuest } = useListEditorStoreBase.getState()
  const [over, setOver] = useState(false)
  return (
    <section
      role='group'
      aria-label={table?.name || noTableLabel}
      className={cn('rounded-xl border border-line p-2', over && 'border-accent bg-accent-soft/40')}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(DRAG_TYPE)) return
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setOver(false)
      }}
      onDrop={(event) => {
        setOver(false)
        const dragged = draggedGuest(event)
        if (dragged) updateGuest(dragged, { tableId: table?.id ?? '' })
      }}
    >
      <header className='mb-1 flex items-center gap-1.5'>
        {table ? (
          <input
            className='min-w-0 flex-1 rounded-md border-0 bg-transparent px-1.5 py-1 text-sm font-semibold outline-none focus:bg-surface focus:ring-1 focus:ring-line'
            value={table.name}
            placeholder={t('tableName')}
            aria-label={t('tableName')}
            maxLength={60}
            onChange={(event) => renameTable(table.id, event.target.value)}
          />
        ) : (
          <span className='flex-1 px-1.5 py-1 text-sm font-semibold text-muted'>{noTableLabel}</span>
        )}
        <span className='rounded-full bg-canvas px-2 text-xs text-muted tabular-nums'>{guests.length}</span>
        {table && (
          <Popconfirm title={t('removeTableConfirm')} onConfirm={() => removeTable(table.id)} okButtonProps={{ danger: true }}>
            <Button type='text' size='small' icon={<DeleteOutlined />} aria-label={t('removeTable')} />
          </Popconfirm>
        )}
      </header>
      {guests.length > 0 ? (
        <ul className='m-0 list-none p-0'>
          {guests.map((guest, index) => (
            <GuestRow
              key={guest.id}
              guest={guest}
              index={index}
              tables={tables}
              showTable={false}
              showNote={showNote}
              selected={selection.has(guest.id)}
              noTableLabel={noTableLabel}
              onDropGuest={onDropGuest}
            />
          ))}
        </ul>
      ) : (
        <p className='m-0 px-1.5 py-1 text-xs text-muted'>{t('dropHere')}</p>
      )}
    </section>
  )
}

type View = 'all' | 'tables'

/**
 * The guests, as a list to type into. Everything here also happens on the sheet; this is the
 * fast way: import, type-and-Enter, search, drag rows between tables.
 */
export const GuestsPanel: FC = () => {
  const t = useTranslations('Editor.guests')
  const tSamples = useTranslations('Samples')
  const { message, modal } = App.useApp()
  const content = useListEditorStoreBase((state) => state.doc?.content)
  const kind = useListEditorStoreBase((state) => state.doc?.design.kind ?? 'seating')
  const selectionList = useListEditorStore.use.selection()
  const openImport = useEditorUiStore.use.openImport()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<View>(kind === 'seating' ? 'tables' : 'all')
  const listRef = useRef<HTMLDivElement>(null)
  const selection = useMemo(() => new Set(selectionList), [selectionList])
  const tables = useMemo<TableOption[]>(() => content?.tables.map(({ id, name }) => ({ id, name })) ?? [], [content?.tables])

  if (!content) return null
  const { addTable, sortGuests, dedupeGuests, clearGuests, seatGuest } = useListEditorStoreBase.getState()
  const showNote = kind === 'cards'
  const needle = query.trim().toLocaleLowerCase()
  const matches = (guest: Guest) => !needle || guest.name.toLocaleLowerCase().includes(needle)
  const filtered = content.guests.filter(matches)
  const noTableLabel = t('noTable')

  /** A row dropped on another row: it takes that row's place and its table. */
  const onDropGuest = (draggedId: string, before: Guest) => seatGuest(draggedId, before.tableId, before.id)

  const menu = {
    items: [
      { key: 'az', label: t('sortAz') },
      { key: 'za', label: t('sortZa') },
      { key: 'dedupe', label: t('dedupe') },
      { type: 'divider' as const },
      { key: 'clear', label: t('clear'), danger: true, disabled: !content.guests.length },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'az' || key === 'za') sortGuests(key)
      if (key === 'dedupe') {
        const removed = dedupeGuests()
        void message.info(removed ? t('dedupeDone', { count: removed }) : t('dedupeNone'))
      }
      if (key === 'clear') {
        modal.confirm({
          title: t('clearConfirm'),
          content: t('clearConfirmText', { count: content.guests.length }),
          okButtonProps: { danger: true },
          onOk: clearGuests,
        })
      }
    },
  }

  const seatingView = view === 'tables'
  const unseated = filtered.filter((guest) => !tables.some((table) => table.id === guest.tableId))

  return (
    <div className='flex flex-col gap-3'>
      <div className='grid grid-cols-3 gap-1.5'>
        <Button className='h-auto flex-col gap-0.5 py-2 text-xs' icon={<SnippetsOutlined />} onClick={() => openImport('paste')}>
          {t('importPaste')}
        </Button>
        <Button className='h-auto flex-col gap-0.5 py-2 text-xs' icon={<FileExcelOutlined />} onClick={() => openImport('file')}>
          {t('importFile')}
        </Button>
        <Button className='h-auto flex-col gap-0.5 py-2 text-xs' icon={<CameraOutlined />} onClick={() => openImport('photo')}>
          {t('importPhoto')}
        </Button>
      </div>

      <QuickAdd tables={tables} showTable={kind !== 'list' || tables.length > 0} />

      <div className='flex items-center gap-1.5'>
        <Input
          size='small'
          allowClear
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('search')}
          aria-label={t('search')}
          prefix={<SearchOutlined className='text-muted' />}
        />
        <Dropdown menu={menu} trigger={['click']}>
          <Button size='small' icon={<MoreOutlined />} aria-label={t('more')} />
        </Dropdown>
      </div>

      <div className='flex items-center justify-between gap-2'>
        <span className='text-xs text-muted'>{t('counts', { guests: content.guests.length, tables: content.tables.length })}</span>
        <Segmented<View>
          size='small'
          value={view}
          onChange={setView}
          options={[
            { value: 'all', label: t('viewAll') },
            { value: 'tables', label: t('viewTables') },
          ]}
        />
      </div>

      {seatingView && (
        <div className='flex flex-col gap-2'>
          <div className='flex gap-1.5'>
            <Button
              size='small'
              icon={<PlusOutlined />}
              onClick={() => addTable(tSamples('table', { number: content.tables.length + 1 }))}
            >
              {t('addTable')}
            </Button>
          </div>
          {unseated.length > 0 && <AutoSeat />}
        </div>
      )}

      <div ref={listRef} className='flex flex-col gap-2'>
        {seatingView ? (
          <>
            {content.tables.map((table) => (
              <TableGroup
                key={table.id}
                table={table}
                guests={filtered.filter((guest) => guest.tableId === table.id)}
                tables={tables}
                selection={selection}
                noTableLabel={noTableLabel}
                showNote={showNote}
                onDropGuest={onDropGuest}
              />
            ))}
            {(unseated.length > 0 || !content.tables.length) && (
              <TableGroup
                table={null}
                guests={unseated}
                tables={tables}
                selection={selection}
                noTableLabel={noTableLabel}
                showNote={showNote}
                onDropGuest={onDropGuest}
              />
            )}
          </>
        ) : filtered.length ? (
          <ul className='m-0 list-none p-0'>
            {filtered.map((guest, index) => (
              <GuestRow
                key={guest.id}
                guest={guest}
                index={index}
                tables={tables}
                showTable={tables.length > 0}
                showNote={showNote}
                selected={selection.has(guest.id)}
                noTableLabel={noTableLabel}
                onDropGuest={onDropGuest}
              />
            ))}
          </ul>
        ) : (
          <p className='m-0 py-6 text-center text-sm text-muted'>{needle ? t('noMatches') : t('empty')}</p>
        )}
      </div>
    </div>
  )
}
