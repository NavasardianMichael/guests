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
import { App, Button, Dropdown, Input, InputNumber, Popconfirm, Segmented, Select, Space } from 'antd'
import { useTranslations } from 'next-intl'
import { useEditorUiStore } from '@store/editorUi/store'
import { MAX_GUESTS, useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import type { Guest, GuestTable } from '@store/lists/single/types'
import { cn } from '@helpers/cn'
import { TileButton } from '@components/ui/TileButton'

type TableOption = { id: string; name: string }

/** A table picker's options, "no table" first. Built once per list of tables, shared by every row. */
type TableSelectOption = { value: string; label: string }

const tableSelectOptions = (tables: TableOption[], noTableLabel: string): TableSelectOption[] => [
  { value: '', label: noTableLabel },
  ...tables.map((table) => ({ value: table.id, label: table.name || '—' })),
]

/** Search a table picker by name once a list has many tables. */
const filterTable = (input: string, option?: TableSelectOption): boolean =>
  Boolean(option?.label.toLocaleLowerCase().includes(input.toLocaleLowerCase()))

/** Shown on hover with a mouse; always there on a touch screen, which has no hover. */
const HOVER_REVEAL = 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100'

const DRAG_TYPE = 'application/x-guest-id'

const startRowDrag = (event: DragEvent, guestId: string) => {
  event.dataTransfer.setData(DRAG_TYPE, guestId)
  event.dataTransfer.effectAllowed = 'move'
}

const draggedGuest = (event: DragEvent): string | null => event.dataTransfer.getData(DRAG_TYPE) || null

type RowProps = {
  guest: Guest
  index: number
  tableOptions: TableSelectOption[]
  /** `always`, or only on touch screens (the by-table view, where rows are dragged with a mouse). */
  showTable: 'always' | 'touch' | 'never'
  showNote: boolean
  selected: boolean
  onDropGuest: (draggedId: string, before: Guest) => void
}

/**
 * One guest. A list runs to hundreds of rows, so each row re-renders only when its own guest
 * changes (`memo` + immer's structural sharing), and the table options are built once, above.
 */
const GuestRow: FC<RowProps> = memo(function GuestRow({
  guest,
  index,
  tableOptions,
  showTable,
  showNote,
  selected,
  onDropGuest,
}) {
  const t = useTranslations('Editor.guests')
  const [over, setOver] = useState(false)
  const { updateGuest, removeGuests, select } = useListEditorStoreBase.getState()
  return (
    <li
      className={cn(
        'group flex items-center gap-1 rounded-lg border border-transparent px-0.5 py-0.5 transition-colors',
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
        className='hidden cursor-grab px-0.5 text-muted opacity-40 group-hover:opacity-100 pointer-fine:inline'
        draggable
        onDragStart={(event) => startRowDrag(event, guest.id)}
        aria-hidden='true'
      >
        <HolderOutlined />
      </span>
      <span className='w-6 shrink-0 text-right text-[11px] text-muted tabular-nums'>{index + 1}</span>
      <input
        className='min-w-0 flex-1 rounded-md border-0 bg-transparent px-1.5 py-1.5 text-sm outline-none focus:bg-surface focus:ring-1 focus:ring-line'
        value={guest.name}
        placeholder={t('namePlaceholder')}
        aria-label={t('name')}
        maxLength={120}
        onFocus={() => select([guest.id])}
        onChange={(event) => updateGuest(guest.id, { name: event.target.value })}
      />
      {showNote && (
        <input
          className='w-16 min-w-0 shrink rounded-md border-0 bg-transparent px-1.5 py-1.5 text-xs text-muted outline-none focus:bg-surface focus:ring-1 focus:ring-line sm:w-20'
          value={guest.note}
          placeholder={t('notePlaceholder')}
          aria-label={t('note')}
          maxLength={120}
          onChange={(event) => updateGuest(guest.id, { note: event.target.value })}
        />
      )}
      {showTable !== 'never' && (
        // A native wrapper does the showing and hiding: antd's own `display` would beat `hidden`.
        <span className={cn('w-24 shrink-0 sm:w-28', showTable === 'touch' && 'hidden pointer-coarse:block')}>
          <Select<string, TableSelectOption>
            size='small'
            className='w-full'
            value={guest.tableId}
            options={tableOptions}
            aria-label={t('table')}
            popupMatchSelectWidth={false}
            showSearch={tableOptions.length > 8 ? { filterOption: filterTable } : false}
            onChange={(tableId) => updateGuest(guest.id, { tableId })}
          />
        </span>
      )}
      <button
        type='button'
        className={cn(
          'grid size-7 shrink-0 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted hover:text-danger',
          HOVER_REVEAL
        )}
        aria-label={t('remove')}
        onClick={() => removeGuests([guest.id])}
      >
        <DeleteOutlined />
      </button>
    </li>
  )
})

/** Type a name, press Enter, type the next: the quickest way to write a list by hand. */
const QuickAdd: FC<{ tables: TableOption[]; tableOptions: TableSelectOption[]; showTable: boolean }> = ({
  tables,
  tableOptions,
  showTable,
}) => {
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
    <div className='flex flex-col gap-1.5'>
      <Space.Compact block>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onPressEnter={submit}
          placeholder={full ? t('full', { max: MAX_GUESTS }) : t('quickAdd')}
          aria-label={t('quickAdd')}
          disabled={full}
          maxLength={120}
        />
        <Button type='primary' icon={<PlusOutlined />} onClick={submit} disabled={!name.trim() || full}>
          <span className='hidden xs:inline'>{t('add')}</span>
        </Button>
      </Space.Compact>
      {showTable && tables.length > 0 && (
        <div className='flex items-center gap-2 text-xs text-muted'>
          <span className='shrink-0'>{t('quickAddTable')}</span>
          <Select<string, TableSelectOption>
            className='min-w-0 flex-1'
            value={tables.some((table) => table.id === tableId) ? tableId : ''}
            options={tableOptions}
            showSearch={tableOptions.length > 8 ? { filterOption: filterTable } : false}
            onChange={setTableId}
          />
        </div>
      )}
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
    <div className='flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl bg-canvas px-3 py-2.5 text-xs leading-snug'>
      <ThunderboltOutlined className='text-accent-strong' />
      <span className='min-w-0'>{t('autoSeat')}</span>
      <InputNumber
        size='small'
        className='w-16'
        min={1}
        max={100}
        value={seats}
        onChange={(value) => value && setSeats(value)}
        aria-label={t('seats')}
      />
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
  tableOptions: TableSelectOption[]
  selection: ReadonlySet<string>
  noTableLabel: string
  showNote: boolean
  onDropGuest: (draggedId: string, before: Guest) => void
}

/** A table and the guests at it — or the guests at none — taking dropped rows. */
const TableGroup: FC<GroupProps> = ({ table, guests, tableOptions, selection, noTableLabel, showNote, onDropGuest }) => {
  const t = useTranslations('Editor.guests')
  const { renameTable, removeTable, updateGuest } = useListEditorStoreBase.getState()
  const [over, setOver] = useState(false)
  return (
    <section
      role='group'
      aria-label={table?.name || noTableLabel}
      className={cn('rounded-xl border border-line p-1.5 sm:p-2', over && 'border-accent bg-accent-soft/40')}
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
        <span className='shrink-0 rounded-full bg-canvas px-2 text-xs text-muted tabular-nums'>{guests.length}</span>
        {table && (
          <Popconfirm
            title={t('removeTableConfirm')}
            onConfirm={() => removeTable(table.id)}
            okButtonProps={{ danger: true }}
          >
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
              tableOptions={tableOptions}
              showTable='touch'
              showNote={showNote}
              selected={selection.has(guest.id)}
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
  const tables = useMemo<TableOption[]>(
    () => content?.tables.map(({ id, name }) => ({ id, name })) ?? [],
    [content?.tables]
  )
  const noTable = t('noTable')
  const tableOptions = useMemo(() => tableSelectOptions(tables, noTable), [tables, noTable])

  if (!content) return null
  const { addTable, sortGuests, dedupeGuests, clearGuests, seatGuest } = useListEditorStoreBase.getState()
  const showNote = kind === 'cards'
  const needle = query.trim().toLocaleLowerCase()
  const matches = (guest: Guest) => !needle || guest.name.toLocaleLowerCase().includes(needle)
  const filtered = content.guests.filter(matches)
  const noTableLabel = noTable

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
      <div className='grid grid-cols-3 gap-2'>
        <TileButton icon={<SnippetsOutlined />} onClick={() => openImport('paste')}>
          {t('importPaste')}
        </TileButton>
        <TileButton icon={<FileExcelOutlined />} onClick={() => openImport('file')}>
          {t('importFile')}
        </TileButton>
        <TileButton icon={<CameraOutlined />} onClick={() => openImport('photo')}>
          {t('importPhoto')}
        </TileButton>
      </div>

      <QuickAdd tables={tables} tableOptions={tableOptions} showTable={kind !== 'list' || tables.length > 0} />

      <div className='flex items-center gap-1.5'>
        <Input
          allowClear
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('search')}
          aria-label={t('search')}
          prefix={<SearchOutlined className='text-muted' />}
        />
        <Dropdown menu={menu} trigger={['click']}>
          <Button icon={<MoreOutlined />} aria-label={t('more')} />
        </Dropdown>
      </div>

      <div className='flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5'>
        <span className='text-xs text-muted'>
          {t('counts', { guests: content.guests.length, tables: content.tables.length })}
        </span>
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
              block
              type='dashed'
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
                tableOptions={tableOptions}
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
                tableOptions={tableOptions}
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
                tableOptions={tableOptions}
                showTable={tables.length > 0 ? 'always' : 'never'}
                showNote={showNote}
                selected={selection.has(guest.id)}
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
