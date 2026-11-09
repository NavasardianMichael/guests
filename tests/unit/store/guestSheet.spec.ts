import { beforeEach, describe, expect, it } from 'vitest'
import { useGuestSheetStoreBase } from '@store/guestSheet/store'
import { useListEditorStoreBase } from '@store/lists/single/store'
import type { Guest, ListDocument } from '@store/lists/single/types'
import { templateDesign } from '@helpers/listFactory'

const guest = (id: string, name: string, tableId = ''): Guest => ({ id, name, tableId, note: '' })

const listDoc = (): ListDocument => {
  const design = templateDesign('memorial')
  design.layout.positions = { a: { page: 0, x: 1, y: 1 }, t2: { page: 0, x: 5, y: 5 } }
  design.layout.sizes = { t2: { w: 40, h: 30 } }
  return {
    title: 'List',
    content: {
      heading: '',
      subheading: '',
      footer: '',
      guests: [guest('a', 'Արամ', 't1'), guest('b', 'Անի', 't2')],
      tables: [
        { id: 't1', name: 'Սեղան 1', shape: 'round', seats: 0 },
        { id: 't2', name: 'Սեղան 2', shape: 'round', seats: 0 },
      ],
      venue: [],
    },
    design,
  }
}

const sheet = () => useGuestSheetStoreBase.getState()
const list = () => useListEditorStoreBase.getState()

describe('the spreadsheet draft', () => {
  beforeEach(() => {
    list().loadDocument({ listId: 'list', doc: listDoc() })
    const { guests, tables } = list().doc!.content
    sheet().start({ guests, tables })
  })

  it('edits the draft, never the list', () => {
    sheet().renameGuest('a', 'Արամ Ս.')
    sheet().addGuest('Գոռ', 't1')
    sheet().removeTable('t2')

    expect(sheet().dirty).toBe(true)
    expect(sheet().draft?.guests.map((item) => item.name)).toEqual(['Արամ Ս.', 'Անի', 'Գոռ'])
    expect(sheet().draft?.guests[1].tableId).toBe('')
    expect(list().doc?.content.guests.map((item) => item.name)).toEqual(['Արամ', 'Անի'])
    expect(list().saveStatus).toBe('saved')
  })

  it('goes back to the list on reset', () => {
    sheet().removeGuest('a')
    sheet().discard()
    expect(sheet().dirty).toBe(false)
    expect(sheet().draft).toBe(sheet().base)
    expect(sheet().draft?.guests.map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('is written to the list on save, in one undo step, dropping what is gone', () => {
    sheet().removeGuest('a')
    sheet().removeTable('t2')
    sheet().addTable('Սեղան 3')
    list().applySheet(sheet().draft!)
    sheet().markSaved()

    const doc = list().doc!
    expect(doc.content.guests.map((item) => [item.id, item.tableId])).toEqual([['b', '']])
    expect(doc.content.tables.map((item) => item.name)).toEqual(['Սեղան 1', 'Սեղան 3'])
    expect(doc.design.layout.positions).toEqual({})
    expect(doc.design.layout.sizes).toEqual({})
    expect(list().saveStatus).toBe('dirty')
    expect(list().past).toHaveLength(1)
    expect(sheet().dirty).toBe(false)

    list().undo()
    expect(list().doc?.content.guests.map((item) => item.id)).toEqual(['a', 'b'])
  })
})
