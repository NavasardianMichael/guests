import type { IncomingGuest } from '@store/lists/single/types'

/**
 * Turning what people already have — a typed list, a spreadsheet, a CSV — into guests.
 * Pure, so the rules are pinned by `tests/unit/helpers/guestImport.spec.ts`.
 */

/** "1. ", "12) ", "- ", "• ", "* " before a name. */
const LIST_MARKER = /^\s*(?:\d{1,4}\s*[.)\]:-]\s*|[-–—•*·]\s+)/

/**
 * A line that names a table rather than a guest: it ends with a colon ("Սեղան 5:"), or is a
 * table word with a number ("Table 5", "Стол №5", "Սեղան 5").
 */
const TABLE_WORDS = /^(?:սեղան|սեղ\.|table|tbl\.|стол|столик) ?(?:№|#|no\.|no)? ?[\p{L}\p{N}]{1,12}$/iu

const clean = (value: string): string => value.replace(/\s+/g, ' ').trim()

const isTableHeading = (line: string): string | null => {
  const text = clean(line)
  if (!text) return null
  if (text.endsWith(':') && text.length <= 60) return clean(text.slice(0, -1))
  // Short lines only: the pattern needs nothing longer, and a name never matches it.
  if (text.length <= 30 && TABLE_WORDS.test(text)) return text
  return null
}

/**
 * Typed or pasted text, one guest per line. A line naming a table seats the names under it;
 * list numbering and bullets are dropped. A "name — note" or "name (note)" stays whole: what a
 * person wrote after a name is usually part of how they want it printed ("+ wife").
 */
export const parseLines = (text: string): IncomingGuest[] => {
  const guests: IncomingGuest[] = []
  let table: string | undefined
  for (const raw of text.split(/\r?\n/)) {
    const heading = isTableHeading(raw)
    if (heading) {
      table = heading
      continue
    }
    const name = clean(raw.replace(LIST_MARKER, ''))
    if (!name) continue
    guests.push(table ? { name, table } : { name })
  }
  return guests
}

/** Text with tabs (a block copied out of Excel or Google Sheets) is a table, not lines. */
export const looksTabular = (text: string): boolean => text.split(/\r?\n/).filter((line) => line.includes('\t')).length >= 1

export const splitTabular = (text: string): string[][] =>
  text
    .split(/\r?\n/)
    .map((line) => line.split('\t').map(clean))
    .filter((row) => row.some(Boolean))

/** Which column holds what. `name` may be several (first name, last name), joined in order. */
export type ColumnMapping = {
  name: number[]
  table: number | null
  note: number | null
  /** The first row is column titles, not a guest. */
  header: boolean
}

const HEADER_WORDS: Record<'name' | 'first' | 'last' | 'table' | 'note', RegExp> = {
  name: /^(?:անուն\s*ազգանուն|անուն,?\s*ազգանուն|ազգանուն\s*անուն|հյուր|հյուրեր|name|full\s*name|guest|guests|фио|имя\s*фамилия|гость|гости|ф\.?и\.?о\.?)$/iu,
  first: /^(?:անուն|first\s*name|first|given\s*name|имя)$/iu,
  last: /^(?:ազգանուն|last\s*name|last|surname|family\s*name|фамилия)$/iu,
  table: /^(?:սեղան|սեղանի\s*համար|table|table\s*(?:no\.?|number|#)|стол|номер\s*стола|столик)$/iu,
  note: /^(?:նշում|մեկնաբանություն|note|notes|comment|comments|примечание|комментарий)$/iu,
}

const columnCount = (rows: string[][]): number => rows.reduce((max, row) => Math.max(max, row.length), 0)

/**
 * A first guess at the mapping: titles in the first row when they read as titles, else the
 * first non-numeric column is the name and a mostly-numeric short column the table.
 */
export const guessMapping = (rows: string[][]): ColumnMapping => {
  const first = (rows[0] ?? []).map((cell) => clean(cell).toLowerCase())
  const find = (pattern: RegExp): number => first.findIndex((cell) => pattern.test(cell))
  const named = find(HEADER_WORDS.name)
  const firstName = find(HEADER_WORDS.first)
  const lastName = find(HEADER_WORDS.last)
  const table = find(HEADER_WORDS.table)
  const note = find(HEADER_WORDS.note)
  if (named >= 0 || firstName >= 0 || lastName >= 0 || table >= 0) {
    const name = named >= 0 ? [named] : [firstName, lastName].filter((index) => index >= 0)
    return { name: name.length ? name : [0], table: table >= 0 ? table : null, note: note >= 0 ? note : null, header: true }
  }

  const columns = columnCount(rows)
  const sample = rows.slice(0, 50)
  const numericShare = (col: number): number => {
    const cells = sample.map((row) => clean(row[col] ?? '')).filter(Boolean)
    if (!cells.length) return 0
    return cells.filter((cell) => /^[#№]?\s*\d{1,4}[a-zа-яա-ֆ]?$/iu.test(cell)).length / cells.length
  }
  const filled = (col: number): boolean => sample.some((row) => clean(row[col] ?? ''))
  let name = -1
  let tableCol: number | null = null
  for (let col = 0; col < columns; col += 1) {
    if (!filled(col)) continue
    const share = numericShare(col)
    if (share >= 0.6) {
      // A first column that only counts 1, 2, 3… is numbering, not tables.
      const counts = sample.every((row, index) => clean(row[col] ?? '') === String(index + 1))
      if (!counts && tableCol === null) tableCol = col
    } else if (name < 0) name = col
  }
  return { name: [Math.max(0, name)], table: tableCol, note: null, header: false }
}

/** Rows to guests under a mapping. Rows without a name are skipped. */
export const rowsToGuests = (rows: string[][], mapping: ColumnMapping): IncomingGuest[] => {
  const body = mapping.header ? rows.slice(1) : rows
  const guests: IncomingGuest[] = []
  for (const row of body) {
    const name = clean(mapping.name.map((col) => row[col] ?? '').join(' '))
    if (!name) continue
    const table = mapping.table === null ? '' : clean(row[mapping.table] ?? '')
    const note = mapping.note === null ? '' : clean(row[mapping.note] ?? '')
    guests.push({ name, ...(table && { table }), ...(note && { note }) })
  }
  return guests
}

/**
 * A text file's characters whatever Excel saved it as: UTF-8 (with or without a BOM),
 * UTF-16 (Excel's "Unicode text"), or, failing UTF-8, Windows-1251 (an old Russian export).
 */
export const decodeText = (bytes: Uint8Array): string => {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1251').decode(bytes)
  }
}

/** Every cell as text: a spreadsheet hands numbers and dates too. */
export const cellText = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toLocaleDateString()
  return clean(String(value))
}
