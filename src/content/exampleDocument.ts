import type { Guest, GuestTable, ListDocument, VenueItem } from '@store/lists/single/types'
import { arrange, templateDesign } from '@helpers/listFactory'
import type { EventExample } from './types'

/**
 * An event example as the list it is: the template's own design for its kind and shape, with
 * only what the example sets changed, and its tables, guests and hall. What the example's
 * picture prints (`scripts/content/example-images.mjs`) and what "use this example" opens.
 *
 * Ids are fixed (`t1`, `t1g2`, `v1`) rather than random: the same example is always the same
 * document, so its picture's fingerprint changes only when the example does. Ids need only be
 * unique within one list.
 */
export const exampleDocument = (example: EventExample): ListDocument => {
  const { sheet } = example
  const design = templateDesign(sheet.templateId, sheet.kind, sheet.shape)
  if (sheet.orientation) design.paper.orientation = sheet.orientation
  if (sheet.columns) design.layout.columns = sheet.columns
  if (sheet.textScale) design.textScale = sheet.textScale
  if (sheet.sort) design.layout.sort = sheet.sort
  if (sheet.numbering) design.layout.numbering = true

  const tables: GuestTable[] = []
  const guests: Guest[] = []
  sheet.tables.forEach((table, tableIndex) => {
    const id = `t${tableIndex + 1}`
    tables.push({ id, name: table.name, shape: table.shape ?? 'round', seats: table.seats ?? 0 })
    table.guests.forEach((name, guestIndex) => guests.push({ id: `${id}g${guestIndex + 1}`, name, tableId: id, note: '' }))
  })
  const venue: VenueItem[] = (sheet.venue ?? []).map((item, index) => ({ id: `v${index + 1}`, kind: item.kind, label: item.label }))

  const doc: ListDocument = {
    title: example.shortTitle,
    content: { heading: sheet.heading, subheading: sheet.subheading, footer: sheet.footer, guests, tables, venue },
    design,
  }
  // A preset sets the tables' shape too (round around the dance floor, long in banquet rows).
  if (sheet.arrangement) arrange(doc, sheet.arrangement)
  return doc
}
