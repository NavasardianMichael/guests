import { describe, expect, it } from 'vitest'
import type { Guest, GuestTable } from '@store/lists/single/types'
import { guestDrop, isBlock, parseClipboard, pasteIntoColumns, tableColumns, tableDrop } from '@helpers/guestSheet'

const guest = (id: string, name: string, tableId = ''): Guest => ({ id, name, tableId, note: '' })

const tables: GuestTable[] = [
  { id: 't1', name: 'Սեղան 1', shape: 'round', seats: 0 },
  { id: 't2', name: 'Սեղան 2', shape: 'round', seats: 0 },
]
const guests: Guest[] = [
  guest('a', 'Արամ', 't2'),
  guest('b', 'Անի', 't1'),
  guest('c', 'Գոռ'),
  guest('d', 'Վահե', 't2'),
  guest('e', 'Lost', 'gone'),
]

describe('tableColumns', () => {
  it('puts each table’s guests under it, in list order, and the rest in a last column', () => {
    const columns = tableColumns({ guests, tables })
    expect(columns.map((column) => [column.tableId, column.guests.map((item) => item.id)])).toEqual([
      ['t1', ['b']],
      ['t2', ['a', 'd']],
      ['', ['c', 'e']],
    ])
  })

  it('has no "no table" column when everyone is seated, and only that one with no tables', () => {
    expect(tableColumns({ guests: [guest('a', 'A', 't1')], tables }).map((column) => column.tableId)).toEqual([
      't1',
      't2',
    ])
    expect(tableColumns({ guests: [], tables: [] }).map((column) => column.tableId)).toEqual([''])
  })
})

describe('parseClipboard', () => {
  it('reads rows and tab-separated cells, without the last line break', () => {
    expect(parseClipboard('Արամ\tՍեղան 1\r\nԱնի\t\r\n')).toEqual([
      ['Արամ', 'Սեղան 1'],
      ['Անի', ''],
    ])
    expect(isBlock(parseClipboard('Արամ'))).toBe(false)
    expect(isBlock(parseClipboard('Արամ\nԱնի'))).toBe(true)
    expect(isBlock(parseClipboard('Արամ\tԱնի'))).toBe(true)
  })
})

describe('pasteIntoColumns', () => {
  const columns = tableColumns({ guests, tables })

  it('renames table headers and guests, removes emptied guests, adds below the last guest', () => {
    expect(
      pasteIntoColumns(columns, -1, 0, [
        ['Գլխավոր', ' Ընտանիք '],
        ['Նոր', ''],
        ['', 'Լիլիթ  Ս.'],
        ['Հայկ', 'x'],
      ])
    ).toEqual({
      tables: [
        { id: 't1', name: 'Գլխավոր' },
        { id: 't2', name: 'Ընտանիք' },
      ],
      guests: [
        { id: 'b', name: 'Նոր' },
        { id: 'd', name: 'Լիլիթ Ս.' },
        { name: 'Հայկ', tableId: 't1' },
        { name: 'x', tableId: 't2' },
      ],
      remove: ['a'],
    })
  })

  it('drops cells past the last column and leaves the "no table" header alone', () => {
    expect(pasteIntoColumns(columns, -1, 2, [['header', 'beyond'], ['Նոր']])).toEqual({
      tables: [],
      guests: [{ id: 'c', name: 'Նոր' }],
      remove: [],
    })
  })
})

describe('guestDrop', () => {
  // Columns: t1 [b], t2 [a, d], none [c, e]; the list: a b c d e.
  const content = { guests, tables }

  it('moves a guest within its table', () => {
    expect(guestDrop(content, 'd', 1, 0)).toEqual({ tableId: 't2', beforeId: 'a' })
    expect(guestDrop(content, 'a', 1, 2)).toEqual({ tableId: 't2', beforeId: 'e' })
  })

  it('does nothing when dropped where it is', () => {
    expect(guestDrop(content, 'a', 1, 0)).toBeNull()
    expect(guestDrop(content, 'a', 1, 1)).toBeNull()
  })

  it('seats a guest at another table, before a guest or after its last', () => {
    expect(guestDrop(content, 'c', 0, 0)).toEqual({ tableId: 't1', beforeId: 'b' })
    expect(guestDrop(content, 'c', 0, 1)).toEqual({ tableId: 't1', beforeId: 'd' })
    expect(guestDrop(content, 'b', 2, 2)).toEqual({ tableId: '', beforeId: null })
  })

  it('keeps its place in the list when the table is empty', () => {
    const empty = { guests, tables: [...tables, { id: 't3', name: 'Սեղան 3', shape: 'round' as const, seats: 0 }] }
    expect(guestDrop(empty, 'b', 2, 0)).toEqual({ tableId: 't3', beforeId: 'c' })
  })
})

describe('tableDrop', () => {
  const three = [{ id: 'x' }, { id: 'y' }, { id: 'z' }]
  it('answers the table to go before, or null when nothing moves', () => {
    expect(tableDrop(three, 'z', 0)).toEqual({ beforeId: 'x' })
    expect(tableDrop(three, 'x', 3)).toEqual({ beforeId: null })
    expect(tableDrop(three, 'x', 2)).toEqual({ beforeId: 'z' })
    expect(tableDrop(three, 'y', 1)).toBeNull()
    expect(tableDrop(three, 'y', 2)).toBeNull()
  })
})
