import { describe, expect, it } from 'vitest'
import { decodeText, guessMapping, looksTabular, parseLines, rowsToGuests, splitTabular } from '@helpers/guestImport'

describe('parseLines', () => {
  it('takes one guest per line and drops numbering and bullets', () => {
    expect(parseLines('1. Արամ Պետրոսյան\n2) Անի\n- Гор\n\n• John  Smith ')).toEqual([
      { name: 'Արամ Պետրոսյան' },
      { name: 'Անի' },
      { name: 'Гор' },
      { name: 'John Smith' },
    ])
  })

  it('seats names under the table line above them', () => {
    expect(parseLines('Սեղան 1\nԱրամ\nԱնի\nСтол 2:\nГор\nFamily:\nVahe')).toEqual([
      { name: 'Արամ', table: 'Սեղան 1' },
      { name: 'Անի', table: 'Սեղան 1' },
      { name: 'Гор', table: 'Стол 2' },
      { name: 'Vahe', table: 'Family' },
    ])
  })

  it('keeps what is written after a name', () => {
    expect(parseLines('Արամ + կինը')).toEqual([{ name: 'Արամ + կինը' }])
  })
})

describe('tabular text', () => {
  it('recognises a block copied from a spreadsheet', () => {
    const text = 'Անուն\tՍեղան\nԱրամ\t1\nԱնի\t2'
    expect(looksTabular(text)).toBe(true)
    expect(looksTabular('Արամ\nԱնի')).toBe(false)
    const rows = splitTabular(text)
    const mapping = guessMapping(rows)
    expect(mapping).toEqual({ name: [0], table: 1, note: null, header: true })
    expect(rowsToGuests(rows, mapping)).toEqual([
      { name: 'Արամ', table: '1' },
      { name: 'Անի', table: '2' },
    ])
  })
})

describe('guessMapping', () => {
  it('joins first and last name columns', () => {
    const rows = [
      ['Имя', 'Фамилия', 'Стол'],
      ['Арам', 'Петросян', '3'],
    ]
    const mapping = guessMapping(rows)
    expect(mapping).toEqual({ name: [0, 1], table: 2, note: null, header: true })
    expect(rowsToGuests(rows, mapping)).toEqual([{ name: 'Арам Петросян', table: '3' }])
  })

  it('finds the name and the table without titles, skipping a numbering column', () => {
    const rows = [
      ['1', 'Արամ Պետրոսյան', '5'],
      ['2', 'Անի Պետրոսյան', '5'],
      ['3', 'Գոռ Սարգսյան', '7'],
    ]
    expect(guessMapping(rows)).toEqual({ name: [1], table: 2, note: null, header: false })
  })
})

describe('decodeText', () => {
  it('reads UTF-8, UTF-16 and falls back to Windows-1251', () => {
    expect(decodeText(new TextEncoder().encode('Արամ'))).toBe('Արամ')
    const utf16 = new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0x42, 0x00])
    expect(decodeText(utf16)).toBe('AB')
    // "Гор" in Windows-1251.
    expect(decodeText(new Uint8Array([0xc3, 0xee, 0xf0]))).toBe('Гор')
  })
})
