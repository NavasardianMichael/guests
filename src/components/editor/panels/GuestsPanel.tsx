'use client'

import { type FC, memo, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
import {
  closestCenter,
  closestCorners,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MeasuringStrategy,
  type Modifier,
  PointerSensor,
  pointerWithin,
  type UniqueIdentifier,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { App, Button, Dropdown, Input, InputNumber, type MenuProps, Popconfirm, Segmented, Select, Space } from 'antd'
import { useTranslations } from 'next-intl'
import { useEditorUiStore } from '@store/editorUi/store'
import { DEFAULT_SEATS_PER_TABLE, MAX_GUESTS, useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import type { Guest, GuestTable } from '@store/lists/single/types'
import { cn } from '@helpers/cn'
import { HintTooltip } from '@components/ui/HintTooltip'
import { TileButton } from '@components/ui/TileButton'
import { SpreadsheetButton } from '../spreadsheet/SpreadsheetModal'

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

/** A droppable group of rows: a table (`group:<id>`), the guests at none (`group:`), or every guest. */
const GROUP = 'group:'
const ALL_GUESTS = `${GROUP}*`
const groupId = (table: GuestTable | null): string => `${GROUP}${table?.id ?? ''}`

/** Row ids per group, in display order. */
type Groups = Record<string, string[]>

const groupOf = (groups: Groups, id: UniqueIdentifier): string | undefined =>
  String(id) in groups ? String(id) : Object.keys(groups).find((key) => groups[key].includes(String(id)))

/** Rows only ever move up and down. */
const vertical: Modifier = ({ transform }) => ({ ...transform, x: 0 })

const SETTLE = { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }

type RowProps = {
  guest: Guest
  index: number
  tableOptions: TableSelectOption[]
  /** `always`, or only on touch screens (the by-table view, where rows are dragged with a mouse). */
  showTable: 'always' | 'touch' | 'never'
  showNote: boolean
}

/**
 * One guest's fields. A list runs to hundreds of rows, so they re-render only when their own
 * guest changes (`memo` + immer's structural sharing) — not on every frame of a drag, which
 * re-renders the sortable row around them — and the table options are built once, above.
 */
const GuestFields: FC<RowProps> = memo(function GuestFields({ guest, index, tableOptions, showTable, showNote }) {
  const t = useTranslations('Editor.guests')
  const { updateGuest, removeGuests, select } = useListEditorStoreBase.getState()
  return (
    <>
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
    </>
  )
})

/**
 * A guest row, dragged by its handle with a mouse or the keyboard (on a touch screen the table
 * picker moves a guest instead). While dragged it stays in the list, faded, as the gap the row
 * will drop into; the overlay follows the pointer.
 */
const GuestRow: FC<RowProps & { selected: boolean }> = ({ selected, ...row }) => {
  const t = useTranslations('Editor.guests')
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: row.guest.id,
    attributes: { roleDescription: t('dragRole') },
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'group flex items-center gap-1 rounded-lg border border-transparent px-0.5 py-0.5',
        selected && 'border-accent bg-accent-soft/50',
        isDragging && 'border-dashed border-accent bg-accent-soft/30 *:opacity-30'
      )}
    >
      <button
        type='button'
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={t('dragHandle')}
        className='hidden cursor-grab touch-none place-items-center rounded-md border-0 bg-transparent px-0.5 py-1.5 text-muted opacity-40 group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing pointer-fine:grid'
      >
        <HolderOutlined />
      </button>
      <GuestFields {...row} />
    </li>
  )
}

/** What follows the pointer while a row is dragged. */
const DraggedRow: FC<{ name: string }> = ({ name }) => {
  const t = useTranslations('Editor.guests')
  return (
    <div className='flex h-full cursor-grabbing items-center gap-2 rounded-lg border border-accent bg-surface px-1.5 text-sm shadow-lg'>
      <HolderOutlined className='text-muted' />
      <span className='truncate'>{name || t('namePlaceholder')}</span>
    </div>
  )
}

type GuestBarProps = {
  text: string
  onTextChange: (text: string) => void
  /** Whether the list is filtered by `text`. */
  searching: boolean
  onSearchingChange: (searching: boolean) => void
  menu: MenuProps
}

/**
 * One field, two uses. Type a name and press Enter (or +) to add it, then type the next: the
 * quickest way to write a list by hand. Guests added here have no table; a table's own field
 * (`TableAdd`) adds straight to it. The search button filters the list by the same text, live
 * while it stays on; clearing the field ends the search.
 */
const GuestBar: FC<GuestBarProps> = ({ text, onTextChange, searching, onSearchingChange, menu }) => {
  const t = useTranslations('Editor.guests')
  const addGuest = useListEditorStore.use.addGuest()
  const count = useListEditorStoreBase((state) => state.doc?.content.guests.length ?? 0)
  const full = count >= MAX_GUESTS
  const trimmed = text.trim()

  const change = (next: string) => {
    onTextChange(next)
    if (!next.trim()) onSearchingChange(false)
  }

  const add = () => {
    if (!trimmed || full) return
    addGuest(trimmed)
    change('')
  }

  return (
    <div className='flex items-center gap-1.5'>
      <Space.Compact block>
        <Input
          allowClear
          value={text}
          onChange={(event) => change(event.target.value)}
          // While searching, the list already follows the text: Enter adds nothing by surprise.
          onPressEnter={searching ? undefined : add}
          placeholder={searching ? t('search') : full ? t('full', { max: MAX_GUESTS }) : t('quickAdd')}
          aria-label={searching ? t('search') : t('quickAdd')}
          maxLength={120}
        />
        <HintTooltip title={t('add')}>
          <Button type='primary' icon={<PlusOutlined />} aria-label={t('add')} onClick={add} disabled={!trimmed || full} />
        </HintTooltip>
      </Space.Compact>
      <HintTooltip title={t('search')}>
        <Button
          type={searching ? 'primary' : 'default'}
          ghost={searching}
          icon={<SearchOutlined />}
          aria-label={t('search')}
          aria-pressed={searching}
          disabled={!searching && !trimmed}
          onClick={() => onSearchingChange(!searching)}
        />
      </HintTooltip>
      <Dropdown menu={menu} trigger={['click']}>
        <Button icon={<MoreOutlined />} aria-label={t('more')} />
      </Dropdown>
    </div>
  )
}

/** A table's own add field, at its foot: Enter adds the name to this table and keeps the field for the next. */
const TableAdd: FC<{ tableId: string; label: string }> = ({ tableId, label }) => {
  const t = useTranslations('Editor.guests')
  const addGuest = useListEditorStore.use.addGuest()
  const full = useListEditorStoreBase((state) => (state.doc?.content.guests.length ?? 0) >= MAX_GUESTS)
  const [name, setName] = useState('')
  if (full) return null

  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    addGuest(trimmed, tableId)
    setName('')
  }

  return (
    <label className='mt-0.5 flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-muted focus-within:bg-surface focus-within:ring-1 focus-within:ring-line'>
      <PlusOutlined className='shrink-0 text-xs' />
      <input
        className='min-w-0 flex-1 border-0 bg-transparent py-1 text-sm text-text outline-none placeholder:text-muted'
        value={name}
        placeholder={t('addHere')}
        aria-label={t('addTo', { table: label })}
        maxLength={120}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
          if (event.key === 'Escape') setName('')
        }}
        onBlur={submit}
      />
    </label>
  )
}

/** Seats everyone without a table, `seats` to a table, opening new tables as needed. */
const AutoSeat: FC = () => {
  const t = useTranslations('Editor.guests')
  const tSamples = useTranslations('Samples')
  const autoSeat = useListEditorStore.use.autoSeat()
  const [seats, setSeats] = useState(DEFAULT_SEATS_PER_TABLE)
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
  /** The dragged row is in this group right now. */
  highlighted: boolean
}

/** A table and the guests at it — or the guests at none — taking dragged rows. */
const TableGroup: FC<GroupProps> = ({ table, guests, tableOptions, selection, noTableLabel, showNote, highlighted }) => {
  const t = useTranslations('Editor.guests')
  const { renameTable, removeTable } = useListEditorStoreBase.getState()
  const { setNodeRef } = useDroppable({ id: groupId(table) })
  const ids = useMemo(() => guests.map((guest) => guest.id), [guests])
  return (
    <section
      ref={setNodeRef}
      role='group'
      aria-label={table?.name || noTableLabel}
      className={cn(
        'rounded-xl border border-line p-1.5 transition-colors sm:p-2',
        highlighted && 'border-accent bg-accent-soft/40'
      )}
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
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
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
              />
            ))}
          </ul>
        ) : (
          <p className='m-0 px-1.5 py-1 text-xs text-muted'>{t('dropHere')}</p>
        )}
      </SortableContext>
      <TableAdd tableId={table?.id ?? ''} label={table?.name || noTableLabel} />
    </section>
  )
}

/** A drag under way: the dragged row, where it started, and every group as it now stands. */
type DragState = { id: string; from: { group: string; index: number }; groups: Groups }

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
  /** The quick-add field's text; the list is filtered by it only while `searching`. */
  const [text, setText] = useState('')
  const [searching, setSearching] = useState(false)
  const [view, setView] = useState<View>(kind === 'seating' ? 'tables' : 'all')
  const [drag, setDragState] = useState<DragState | null>(null)
  /** The drag as last set: a drop can arrive before the render of the last move. */
  const dragRef = useRef<DragState | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const selection = useMemo(() => new Set(selectionList), [selectionList])
  const tables = useMemo<TableOption[]>(
    () => content?.tables.map(({ id, name }) => ({ id, name })) ?? [],
    [content?.tables]
  )
  const noTable = t('noTable')
  const tableOptions = useMemo(() => tableSelectOptions(tables, noTable), [tables, noTable])
  const sensors = useSensors(
    // A press that moves less than this is a click on the handle, not a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  if (!content) return null
  const { addTable, sortGuests, dedupeGuests, clearGuests, moveGuest, seatGuest } = useListEditorStoreBase.getState()
  const showNote = kind === 'cards'
  const needle = searching ? text.trim().toLocaleLowerCase() : ''
  const matches = (guest: Guest) => !needle || guest.name.toLocaleLowerCase().includes(needle)
  const filtered = content.guests.filter(matches)
  const noTableLabel = noTable
  const byId = new Map(content.guests.map((guest) => [guest.id, guest]))
  const tableIds = new Set(tables.map((table) => table.id))
  const seatingView = view === 'tables'

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

  /** The rows of every group as the store has them (the guests at no table only when shown). */
  const storedGroups = (): Groups => {
    if (!seatingView) return { [ALL_GUESTS]: filtered.map((guest) => guest.id) }
    const groups: Groups = {}
    for (const table of content.tables) groups[groupId(table)] = []
    for (const guest of filtered) {
      const key = tableIds.has(guest.tableId) ? `${GROUP}${guest.tableId}` : groupId(null)
      ;(groups[key] ??= []).push(guest.id)
    }
    if (!content.tables.length) groups[groupId(null)] ??= []
    return groups
  }

  // While a row is dragged the panel shows the groups as the drag has rearranged them.
  const groups = drag?.groups ?? storedGroups()
  const rowsOf = (key: string): Guest[] =>
    (groups[key] ?? []).flatMap((id) => {
      const guest = byId.get(id)
      return guest ? [guest] : []
    })
  const activeGroup = drag ? groupOf(drag.groups, drag.id) : undefined
  const dragged = drag ? byId.get(drag.id) : undefined
  const nameOf = (id: UniqueIdentifier): string => byId.get(String(id))?.name || t('namePlaceholder')

  const setDrag = (next: DragState | null) => {
    dragRef.current = next
    setDragState(next)
  }

  /**
   * Over a table, the nearest of its rows (or the table itself when it has none); between
   * tables, the nearest table. Rows of other tables never compete, so a row crossing into a
   * table lands among its guests rather than flickering between neighbours.
   */
  const collision: CollisionDetection = (args) => {
    if (!seatingView) return closestCenter(args)
    const under = pointerWithin(args)
    const hits = under.length ? under : closestCorners(args)
    const group = hits.find((hit) => String(hit.id).startsWith(GROUP))
    if (!group) return hits
    const rows = groups[String(group.id)] ?? []
    if (!rows.length) return [group]
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((container) => rows.includes(String(container.id))),
    })
  }

  const onDragStart = ({ active }: DragStartEvent) => {
    const start = storedGroups()
    const id = String(active.id)
    const group = groupOf(start, id)
    if (group) setDrag({ id, from: { group, index: start[group].indexOf(id) }, groups: start })
  }

  /** A row crossing into another table moves there at once; its neighbours make room. */
  const onDragOver = ({ active, over }: DragOverEvent) => {
    const current = dragRef.current
    if (!current || !over) return
    const from = groupOf(current.groups, active.id)
    const to = groupOf(current.groups, over.id)
    if (!from || !to || from === to) return
    const target = current.groups[to]
    const overIndex = target.indexOf(String(over.id))
    const rect = active.rect.current.translated
    const below = overIndex >= 0 && rect ? rect.top > over.rect.top + over.rect.height / 2 : false
    const index = overIndex < 0 ? target.length : overIndex + (below ? 1 : 0)
    setDrag({
      ...current,
      groups: {
        ...current.groups,
        [from]: current.groups[from].filter((row) => row !== current.id),
        [to]: [...target.slice(0, index), current.id, ...target.slice(index)],
      },
    })
  }

  /** Where in the whole list a row lands: before the row now after it in its group, else after the one before it. */
  const placeBefore = (rows: string[], id: string): string | null => {
    const at = rows.indexOf(id)
    if (at + 1 < rows.length) return rows[at + 1]
    const others = content.guests.filter((guest) => guest.id !== id)
    const previous = at > 0 ? others.findIndex((guest) => guest.id === rows[at - 1]) : -1
    if (previous >= 0) return others[previous + 1]?.id ?? null
    // Alone in its group: it keeps its place in the whole list.
    const own = content.guests.findIndex((guest) => guest.id === id)
    return content.guests[own + 1]?.id ?? null
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const current = dragRef.current
    setDrag(null)
    if (!current || !over) return
    const group = groupOf(current.groups, active.id)
    if (!group) return
    let rows = current.groups[group]
    const from = rows.indexOf(current.id)
    const to = rows.indexOf(String(over.id))
    if (to >= 0 && to !== from) rows = arrayMove(rows, from, to)
    if (group === current.from.group && rows.indexOf(current.id) === current.from.index) return
    const beforeId = placeBefore(rows, current.id)
    if (group === ALL_GUESTS) moveGuest(current.id, beforeId)
    else seatGuest(current.id, group.slice(GROUP.length), beforeId)
  }

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

      <SpreadsheetButton />

      <GuestBar
        text={text}
        onTextChange={setText}
        searching={searching}
        onSearchingChange={setSearching}
        menu={menu}
      />

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
          {(groups[groupId(null)]?.length ?? 0) > 0 && <AutoSeat />}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        // Rows change tables mid-drag; every table is re-measured as they do.
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDrag(null)}
        accessibility={{
          screenReaderInstructions: { draggable: t('dragInstructions') },
          announcements: {
            onDragStart: ({ active }) => t('dragMoving', { name: nameOf(active.id) }),
            onDragOver: () => undefined,
            onDragEnd: ({ active }) => t('dragDropped', { name: nameOf(active.id) }),
            onDragCancel: ({ active }) => t('dragCancelled', { name: nameOf(active.id) }),
          },
        }}
      >
        <div ref={listRef} className='flex flex-col gap-2'>
          {seatingView ? (
            <>
              {content.tables.map((table) => (
                <TableGroup
                  key={table.id}
                  table={table}
                  guests={rowsOf(groupId(table))}
                  tableOptions={tableOptions}
                  selection={selection}
                  noTableLabel={noTableLabel}
                  showNote={showNote}
                  highlighted={activeGroup === groupId(table)}
                />
              ))}
              {groups[groupId(null)] && (
                <TableGroup
                  table={null}
                  guests={rowsOf(groupId(null))}
                  tableOptions={tableOptions}
                  selection={selection}
                  noTableLabel={noTableLabel}
                  showNote={showNote}
                  highlighted={activeGroup === groupId(null)}
                />
              )}
            </>
          ) : filtered.length ? (
            <SortableContext items={groups[ALL_GUESTS] ?? []} strategy={verticalListSortingStrategy}>
              <ul className='m-0 list-none p-0'>
                {rowsOf(ALL_GUESTS).map((guest, index) => (
                  <GuestRow
                    key={guest.id}
                    guest={guest}
                    index={index}
                    tableOptions={tableOptions}
                    showTable={tables.length > 0 ? 'always' : 'never'}
                    showNote={showNote}
                    selected={selection.has(guest.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          ) : (
            <p className='m-0 py-6 text-center text-sm text-muted'>{needle ? t('noMatches') : t('empty')}</p>
          )}
        </div>
        {/* On the body: a panel that slides in is transformed, which would offset a fixed overlay. */}
        {createPortal(
          <DragOverlay modifiers={[vertical]} dropAnimation={SETTLE} zIndex={1100}>
            {dragged ? <DraggedRow name={dragged.name} /> : null}
          </DragOverlay>,
          document.body
        )}
      </DndContext>
    </div>
  )
}
