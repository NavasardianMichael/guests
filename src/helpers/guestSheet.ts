import type { Guest, ListContent, SheetEdit } from '@store/lists/single/types'

/**
 * The guest list as a spreadsheet (`components/editor/spreadsheet`): a column per table (its
 * name in the header), its guests down the column. Here are the pure parts: the columns, and
 * what a block pasted from Excel changes.
 */

/** Longest texts a cell takes, as the panel's fields (the API caps them too). */
export const GUEST_TEXT_MAX = 120
export const TABLE_NAME_MAX = 60

/** A column: a table, or the guests at none (`tableId` ''). */
export type SheetColumn = { tableId: string; name: string; guests: Guest[] }

/** Every table in print order, its guests in list order; then the guests at no table, when there are any (or no tables at all). */
export const tableColumns = (content: Pick<ListContent, 'guests' | 'tables'>): SheetColumn[] => {
  const columns: SheetColumn[] = content.tables.map((table) => ({ tableId: table.id, name: table.name, guests: [] }))
  const byId = new Map(columns.map((column) => [column.tableId, column]))
  const unseated: Guest[] = []
  for (const guest of content.guests) (byId.get(guest.tableId)?.guests ?? unseated).push(guest)
  if (unseated.length || !columns.length) columns.push({ tableId: '', name: '', guests: unseated })
  return columns
}

/** Text copied from a spreadsheet: a row per line, a cell per tab (the line break after the last row dropped). */
export const parseClipboard = (text: string): string[][] => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines.map((line) => line.split('\t'))
}

/** More than one cell: a paste the sheet spreads over its cells, not text for the one cell. */
export const isBlock = (matrix: string[][]): boolean => matrix.length > 1 || (matrix[0]?.length ?? 0) > 1

const clean = (text: string, max: number): string => text.replace(/\s+/g, ' ').trim().slice(0, max)

/**
 * A block pasted into the sheet at (`row`, `col`); row -1 is the header of table names.
 * Cells over guests rename them (an empty one removes the guest); cells below a column's last
 * guest add guests to its table. Cells past the last column are dropped.
 */
export const pasteIntoColumns = (columns: SheetColumn[], row: number, col: number, matrix: string[][]): SheetEdit => {
  const edit: Required<SheetEdit> = { guests: [], tables: [], remove: [] }
  matrix.forEach((cells, i) =>
    cells.forEach((cell, j) => {
      const column = columns[col + j]
      if (!column) return
      const at = row + i
      if (at < 0) {
        if (column.tableId) edit.tables.push({ id: column.tableId, name: clean(cell, TABLE_NAME_MAX) })
        return
      }
      const name = clean(cell, GUEST_TEXT_MAX)
      const guest = column.guests[at]
      if (guest) {
        if (name) edit.guests.push({ id: guest.id, name })
        else edit.remove.push(guest.id)
      } else if (name) edit.guests.push({ name, tableId: column.tableId })
    })
  )
  return edit
}

/**
 * A guest dropped at `index` of column `col` (counted with the guest still where it was): the
 * table it goes to and the guest it then comes before in the whole list (null: last) — what
 * `seatGuest` takes. Null when it would land where it is.
 */
export const guestDrop = (
  content: Pick<ListContent, 'guests' | 'tables'>,
  guestId: string,
  col: number,
  index: number
): { tableId: string; beforeId: string | null } | null => {
  const column = tableColumns(content).at(col)
  if (!column || col < 0) return null
  const from = column.guests.findIndex((guest) => guest.id === guestId)
  const at = from >= 0 && from < index ? index - 1 : index
  if (from >= 0 && at === from) return null
  const rest = column.guests.filter((guest) => guest.id !== guestId)
  const next = rest[at]
  if (next) return { tableId: column.tableId, beforeId: next.id }
  const others = content.guests.filter((guest) => guest.id !== guestId)
  const last = rest.at(-1)
  if (!last) {
    // Into an empty column: it keeps its place in the whole list.
    const own = content.guests.findIndex((guest) => guest.id === guestId)
    return { tableId: column.tableId, beforeId: content.guests[own + 1]?.id ?? null }
  }
  // Below a column's last guest: right after that guest in the whole list.
  return {
    tableId: column.tableId,
    beforeId: others[others.findIndex((guest) => guest.id === last.id) + 1]?.id ?? null,
  }
}

/**
 * A table dropped before the table at `index` (`tables.length`: last), counted with it still in
 * place: the table it then comes before (null: last) — what `moveTable` takes. Null when it stays.
 */
export const tableDrop = (
  tables: { id: string }[],
  tableId: string,
  index: number
): { beforeId: string | null } | null => {
  const from = tables.findIndex((table) => table.id === tableId)
  if (from < 0 || index === from || index === from + 1) return null
  return { beforeId: tables[index]?.id ?? null }
}
