import { GoogleGenAI, Type } from '@google/genai'
import { config } from '../config.js'

/**
 * Reads a photographed guest list — printed, typed or handwritten, in Armenian, Russian or
 * English — into names and tables, with Google's Gemini. The image is sent to Google for the
 * one request and kept nowhere (neither here nor, per the API's terms, there for training).
 *
 * The model answers JSON under a schema; whatever it answers is still trimmed and capped here.
 */

export type ReadGuest = { name: string; table?: string }

/** The image is not a list, or nothing could be read from it. */
export class UnreadableImageError extends Error {}

const MAX_GUESTS_PER_IMAGE = 600

const PROMPT = `You read photographed guest lists for events in Armenia (weddings, christenings, birthdays).
The image may be printed, typed or handwritten, in Armenian, Russian or English, possibly mixed.

Return every guest as one entry, in the order they appear:
- "name": the guest exactly as written, in the original script and spelling (never transliterate or translate). Keep what is written with the name, like "+ wife", "and family", "(2)".
- "table": the table, group or section the guest belongs to, when the list shows one — a heading such as "Սեղան 5", "Стол 3", "Table 2", "Ընտանիք", or a table/number column. Copy it as written. Leave it empty when there is none.

Do not return titles, headings themselves, dates, page numbers, totals, phone numbers or row numbers as guests.
If the image is not a list of people, return an empty list.`

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    guests: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          table: { type: Type.STRING },
        },
        required: ['name'],
      },
    },
  },
  required: ['guests'],
}

let client: GoogleGenAI | null = null
const getClient = (): GoogleGenAI => {
  client ??= new GoogleGenAI({ apiKey: config.gemini.apiKey, httpOptions: { timeout: 90_000 } })
  return client
}

const clean = (value: unknown, max: number): string => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '')

export const readGuestList = async (image: { mimeType: string; base64: string }): Promise<ReadGuest[]> => {
  const response = await getClient().models.generateContent({
    model: config.gemini.model,
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: image.mimeType, data: image.base64 } }, { text: PROMPT }] }],
    config: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 },
  })

  let parsed: unknown
  try {
    parsed = JSON.parse(response.text ?? '')
  } catch {
    throw new UnreadableImageError('The model did not answer JSON')
  }
  const list = (parsed as { guests?: unknown }).guests
  if (!Array.isArray(list)) throw new UnreadableImageError('No guests array')

  const guests: ReadGuest[] = []
  for (const entry of list.slice(0, MAX_GUESTS_PER_IMAGE)) {
    const name = clean((entry as { name?: unknown }).name, 120)
    if (!name) continue
    const table = clean((entry as { table?: unknown }).table, 60)
    guests.push(table ? { name, table } : { name })
  }
  return guests
}
