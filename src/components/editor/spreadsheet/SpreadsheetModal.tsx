'use client'

import { type FC, memo, type RefObject, useCallback, useMemo, useRef } from 'react'
import { MoreOutlined, PlusOutlined, TableOutlined } from '@ant-design/icons'
import { App, Button, Dropdown, Modal } from 'antd'
import { useTranslations } from 'next-intl'
import { useEditorUiStore } from '@store/editorUi/store'
import { useGuestSheetStore, useGuestSheetStoreBase } from '@store/guestSheet/store'
import { MAX_GUESTS, MAX_TABLES, useListEditorStoreBase } from '@store/lists/single/store'
import type { SheetContent } from '@store/lists/single/types'
import {
  GUEST_TEXT_MAX,
  guestDrop,
  pasteIntoColumns,
  TABLE_NAME_MAX,
  tableColumns,
  tableDrop,
} from '@helpers/guestSheet'
import { CellContext, type CellHandlers, DragGrip, focusCell, SpreadsheetCell } from './SpreadsheetCell'
import { type DragSource, type DropTarget, useSheetDrag } from './useSheetDrag'

/** The header row and the row numbers stay put while the grid scrolls under them. */
const HEAD =
  'sticky top-0 z-2 w-48 min-w-48 border-r border-b border-line bg-canvas p-0 text-left align-middle font-normal'
const ROW_HEAD =
  'sticky left-0 z-1 w-10 min-w-10 border-r border-b border-line bg-canvas px-1 text-center text-[11px] font-normal text-muted tabular-nums'
const CORNER = 'sticky top-0 left-0 z-3 w-10 min-w-10 border-r border-b border-line bg-canvas'
const CELL = 'border-r border-b border-line p-0 align-middle'
/** A blank cell's hint shows only where the pointer or the caret is, not in every column at once. */
const QUIET_PLACEHOLDER = 'placeholder:opacity-0 hover:placeholder:opacity-100 focus:placeholder:opacity-100'

/** The spreadsheet's draft, not the list: the list gets it on Save. */
const store = () => useGuestSheetStoreBase.getState()

/** The columns as the draft has them now (an edit lands before the grid has rendered it). */
const currentColumns = () => {
  const draft = store().draft
  return draft ? tableColumns(draft) : []
}

/** Focus a cell once the edit that creates it has rendered. */
const focusSoon = (grid: RefObject<HTMLDivElement | null>, row: number, col: number, fallback = false): void => {
  requestAnimationFrame(() => {
    if (focusCell(grid.current, row, col) || !fallback) return
    // Beside a shorter column: its lowest cell.
    for (let at = row - 1; at >= -1; at -= 1) if (focusCell(grid.current, at, col)) return
  })
}

type HeaderProps = { col: number; tableId: string; name: string; count: number; first: boolean; last: boolean }

/** A column's header: the table's name to type over, its guests' count, its menu, and the grip it is dragged by. */
const ColumnHeader: FC<HeaderProps> = memo(function ColumnHeader({ col, tableId, name, count, first, last }) {
  const t = useTranslations('Editor.spreadsheet')
  const tGuests = useTranslations('Editor.guests')

  const menu = {
    items: [
      { key: 'left', label: t('moveLeft'), disabled: first },
      { key: 'right', label: t('moveRight'), disabled: last },
      { type: 'divider' as const },
      { key: 'delete', label: tGuests('removeTable'), danger: true },
    ],
    onClick: ({ key }: { key: string }) => {
      const tables = store().draft?.tables ?? []
      const index = tables.findIndex((table) => table.id === tableId)
      if (key === 'left') store().moveTable(tableId, tables[index - 1]?.id ?? null)
      if (key === 'right') store().moveTable(tableId, tables[index + 2]?.id ?? null)
      // No confirmation: this edits the draft, and nothing reaches the list until Save.
      if (key === 'delete') store().removeTable(tableId)
    },
  }

  return (
    <th data-row={-1} data-col={col} scope='col' className={HEAD}>
      <div className='group/cell flex items-center gap-0.5 pr-1'>
        {tableId ? (
          <>
            <DragGrip
              source={{ kind: 'table', id: tableId, label: name }}
              label={tGuests('dragHandle')}
              className='h-8 w-3.5 pl-0.5'
            />
            <SpreadsheetCell
              row={-1}
              col={col}
              value={name}
              label={tGuests('tableName')}
              placeholder={tGuests('tableName')}
              maxLength={TABLE_NAME_MAX}
              className='font-semibold pointer-fine:pl-1'
            />
          </>
        ) : (
          <span className='min-w-0 flex-1 truncate px-2 py-1.5 text-sm font-semibold text-muted'>
            {tGuests('noTable')}
          </span>
        )}
        <span className='shrink-0 rounded-full bg-surface px-1.5 text-[11px] text-muted tabular-nums'>{count}</span>
        {tableId && (
          <Dropdown menu={menu} trigger={['click']}>
            <Button type='text' size='small' icon={<MoreOutlined />} aria-label={t('tableMenu')} />
          </Dropdown>
        )}
      </div>
    </th>
  )
})

/** One square of a row: a guest, the blank cell that adds one at the column's foot, or nothing. */
type RowCell = { key: string; guestId: string | null; name: string; blank: boolean; label: string; count: number }

const sameCells = (a: RowCell[], b: RowCell[]): boolean =>
  a.length === b.length &&
  a.every(
    (cell, index) =>
      cell.key === b[index].key &&
      cell.guestId === b[index].guestId &&
      cell.name === b[index].name &&
      cell.blank === b[index].blank &&
      cell.label === b[index].label &&
      cell.count === b[index].count
  )

type RowProps = { row: number; cells: RowCell[]; grid: RefObject<HTMLDivElement | null> }

/**
 * A row of the grid. Its cells are compared by value, so an edit re-renders only the rows it
 * changed — on a sheet of hundreds of cells, typing a name re-renders one.
 */
const SheetRow: FC<RowProps> = memo(
  function SheetRow({ row, cells, grid }) {
    const tGuests = useTranslations('Editor.guests')
    return (
      <tr>
        <th scope='row' className={ROW_HEAD}>
          {row + 1}
        </th>
        {cells.map((cell, col) => (
          // Keyed by place, not by guest: a cell keeps its focus while the guest in it changes.
          <td key={cell.key} data-row={row} data-col={col} className={CELL}>
            {cell.guestId ? (
              <SpreadsheetCell
                row={row}
                col={col}
                value={cell.name}
                label={cell.label}
                placeholder={tGuests('namePlaceholder')}
                maxLength={GUEST_TEXT_MAX}
                guestId={cell.guestId}
                gripLabel={tGuests('dragHandle')}
              />
            ) : cell.blank ? (
              <SpreadsheetCell
                row={row}
                col={col}
                value=''
                label={cell.label}
                placeholder={tGuests('addHere')}
                maxLength={GUEST_TEXT_MAX}
                className={QUIET_PLACEHOLDER}
              />
            ) : (
              // Below a column's blank cell: a click there starts typing in it.
              <div aria-hidden className='h-8 cursor-text' onClick={() => focusCell(grid.current, cell.count, col)} />
            )}
          </td>
        ))}
      </tr>
    )
  },
  (before, after) => before.row === after.row && before.grid === after.grid && sameCells(before.cells, after.cells)
)

/**
 * A column per table, its name in the header, its guests down it, and a blank cell at its foot
 * that adds a guest to it. A cell emptied removes its guest; "Add table" adds a column. Guests
 * are dragged by their grip, up and down or to another table; tables by theirs, across.
 */
const TableSheet: FC<{ content: SheetContent }> = ({ content }) => {
  const t = useTranslations('Editor.spreadsheet')
  const tGuests = useTranslations('Editor.guests')
  const tSamples = useTranslations('Samples')
  const gridRef = useRef<HTMLDivElement>(null)
  const columns = useMemo(() => tableColumns(content), [content])

  const measure = useCallback(() => {
    const draft = store().draft
    return { counts: currentColumns().map((column) => column.guests.length), tables: draft?.tables.length ?? 0 }
  }, [])
  const onDrop = useCallback((source: DragSource, target: DropTarget) => {
    const draft = store().draft
    if (!draft) return
    if (source.kind === 'table' && target.kind === 'table') {
      const drop = tableDrop(draft.tables, source.id, target.index)
      if (drop) store().moveTable(source.id, drop.beforeId)
    }
    if (source.kind === 'guest' && target.kind === 'guest') {
      const drop = guestDrop(draft, source.id, target.col, target.index)
      if (drop) store().seatGuest(source.id, drop.tableId, drop.beforeId)
    }
  }, [])
  const drag = useSheetDrag({ gridRef, measure, onDrop })

  const handlers = useMemo<CellHandlers>(
    () => ({
      commit: (row, col, value) => {
        const column = currentColumns()[col]
        if (!column) return
        const text = value.replace(/\s+/g, ' ').trim()
        if (row < 0) {
          if (column.tableId) store().renameTable(column.tableId, text)
          return
        }
        const guest = column.guests[row]
        if (!guest) {
          if (text) store().addGuest(text, column.tableId)
        } else if (text) store().renameGuest(guest.id, text)
        else store().removeGuest(guest.id)
      },
      paste: (row, col, matrix) => store().editSheet(pasteIntoColumns(currentColumns(), row, col, matrix)),
      move: (row, col, rows, cols) => focusSoon(gridRef, row + rows, col + cols, cols !== 0),
      drag,
    }),
    [drag]
  )

  const tableCount = content.tables.length
  const full = content.guests.length >= MAX_GUESTS
  const rows = Math.max(0, ...columns.map((column) => column.guests.length)) + 1
  const noTable = tGuests('noTable')
  const bodyRows = useMemo(
    () =>
      Array.from({ length: rows }, (_, row) =>
        columns.map((column): RowCell => {
          const guest = column.guests[row]
          return {
            key: column.tableId || 'none',
            guestId: guest?.id ?? null,
            name: guest?.name ?? '',
            blank: !guest && row === column.guests.length && !full,
            label: column.name || noTable,
            count: column.guests.length,
          }
        })
      ),
    [columns, rows, full, noTable]
  )

  const addTable = () => {
    store().addTable(tSamples('table', { number: tableCount + 1 }))
    focusSoon(gridRef, -1, tableCount)
  }

  return (
    <>
      <div className='flex flex-col gap-2'>
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-xs text-muted'>
            {tGuests('counts', { guests: content.guests.length, tables: tableCount })}
          </span>
          <Button className='ml-auto' icon={<PlusOutlined />} onClick={addTable} disabled={tableCount >= MAX_TABLES}>
            {tGuests('addTable')}
          </Button>
        </div>
        <p className='m-0 text-xs leading-relaxed text-muted'>
          {t('hint')} <span className='hidden sm:inline'>{t('keys')}</span>
        </p>
      </div>

      <CellContext.Provider value={handlers}>
        <div
          ref={gridRef}
          className='relative min-h-0 flex-1 scrollbar-thin overflow-auto overscroll-contain rounded-lg border border-line bg-surface'
        >
          <table className='border-separate border-spacing-0'>
            <thead>
              <tr>
                <th className={CORNER} aria-label={t('row')} />
                {columns.map((column, col) => (
                  <ColumnHeader
                    key={column.tableId || 'none'}
                    col={col}
                    tableId={column.tableId}
                    name={column.name}
                    count={column.guests.length}
                    first={col === 0}
                    last={col >= tableCount - 1}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((cells, row) => (
                <SheetRow key={row} row={row} cells={cells} grid={gridRef} />
              ))}
            </tbody>
          </table>
        </div>
      </CellContext.Provider>
    </>
  )
}

const SpreadsheetBody: FC = () => {
  const draft = useGuestSheetStore.use.draft()
  return draft ? <TableSheet content={draft} /> : null
}

/**
 * The guests as a spreadsheet, a column per table, every name editable in place. Opened from the
 * guests and layout steps (`SpreadsheetButton`). It edits a draft (`useGuestSheetStore`): the
 * list, and so the sheet and its autosave, get it only on Save, in one undo step. Reset puts the
 * draft back; a click outside does not close it, and closing with unsaved changes asks first.
 */
export const SpreadsheetModal: FC = () => {
  const t = useTranslations('Editor.spreadsheet')
  const { modal } = App.useApp()
  const open = useEditorUiStore.use.spreadsheetOpen()
  const setOpen = useEditorUiStore.use.setSpreadsheetOpen()
  const dirty = useGuestSheetStore.use.dirty()

  const save = () => {
    const { draft, dirty: changed, markSaved } = store()
    if (draft && changed) {
      useListEditorStoreBase.getState().applySheet(draft)
      markSaved()
    }
    setOpen(false)
  }
  const requestClose = () => {
    if (!store().dirty) return setOpen(false)
    modal.confirm({
      title: t('closeTitle'),
      content: t('closeText'),
      okText: t('closeOk'),
      okButtonProps: { danger: true },
      cancelText: t('keepEditing'),
      onOk: () => setOpen(false),
    })
  }
  const reset = () => {
    modal.confirm({
      title: t('resetTitle'),
      content: t('resetText'),
      okText: t('reset'),
      okButtonProps: { danger: true },
      onOk: () => store().discard(),
    })
  }

  return (
    <Modal
      open={open}
      onCancel={requestClose}
      afterClose={() => store().clear()}
      mask={{ closable: false }}
      destroyOnHidden
      width={1280}
      title={t('title')}
      style={{ maxWidth: 'calc(100vw - 16px)' }}
      styles={{
        container: { display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 16px)' },
        body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 },
      }}
      footer={
        <div className='flex items-center justify-between gap-2'>
          <Button onClick={reset} disabled={!dirty}>
            {t('reset')}
          </Button>
          <Button type='primary' onClick={save}>
            {t('save')}
          </Button>
        </div>
      }
    >
      <SpreadsheetBody />
    </Modal>
  )
}

/** Opens the spreadsheet on a draft of the list's guests: in the guests step and the layout step. */
export const SpreadsheetButton: FC = () => {
  const t = useTranslations('Editor.spreadsheet')
  const setOpen = useEditorUiStore.use.setSpreadsheetOpen()
  const openSheet = () => {
    const doc = useListEditorStoreBase.getState().doc
    if (!doc) return
    store().start({ guests: doc.content.guests, tables: doc.content.tables })
    setOpen(true)
  }
  return (
    <Button
      block
      icon={<TableOutlined />}
      onClick={openSheet}
      // antd fixes a button's height and forbids wrapping: a long label would overflow.
      style={{ height: 'auto', minHeight: 36, whiteSpace: 'normal', paddingBlock: 6 }}
    >
      {t('open')}
    </Button>
  )
}
