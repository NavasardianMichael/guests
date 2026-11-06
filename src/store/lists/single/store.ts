import { type Draft, original } from 'immer'
import { create } from 'zustand'
import { combine } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { appendSelectors } from '@store/appendSelectors'
import { TEMPLATES } from '@constants/templates'
import { resetDesign } from '@helpers/designReset'
import { KIND_ALIGN, KIND_LAYOUT, newGuest, newTable, templateTypography } from '@helpers/listFactory'
import { applyPaperPatch, MIN_BLOCK_SIZE } from '@helpers/paperChange'
import { compareNames } from '@helpers/sheetLayout'
import type { GuestTable, ListDocument, ListEditorActions, ListEditorState } from './types'
import { TEXT_ROLES } from './types'

/**
 * The guest list open in the editor, with undo/redo.
 *
 * Every content or design change goes through `edit`, which records the document as it was
 * before. Typing fires an edit per keystroke, so edits with the same `key` (one field) less
 * than `COALESCE_MS` apart share one undo step. Saving is not this store's job: `useAutosave`
 * watches `doc` and reports back through `setSaveStatus`.
 */
const HISTORY_LIMIT = 100
const COALESCE_MS = 1000

/** Hard caps, mirrored by the API's coercion (`LIST_LIMITS`). */
export const MAX_GUESTS = 2000
/** The smallest a block can be resized to, mm (defined beside the paper maths that scales sizes). */
export { MIN_BLOCK_SIZE } from '@helpers/paperChange'
export const MAX_TABLES = 300
/** Guests per table that auto-seating starts from. */
export const DEFAULT_SEATS_PER_TABLE = 10

const initialState: ListEditorState = {
  listId: null,
  doc: null,
  paidAt: null,
  saveStatus: 'saved',
  past: [],
  future: [],
  lastEditKey: null,
  lastEditAt: 0,
  selection: [],
  isPending: false,
  error: null,
}

type EditorDraft = Draft<ListEditorState>

const edit = (state: EditorDraft, key: string | null, mutate: (doc: Draft<ListDocument>) => void): void => {
  if (!state.doc) return
  const now = Date.now()
  const coalesce = key !== null && key === state.lastEditKey && now - state.lastEditAt < COALESCE_MS
  if (!coalesce) {
    const before = original(state.doc)
    if (before) state.past.push(before)
    if (state.past.length > HISTORY_LIMIT) state.past.shift()
  }
  state.future = []
  state.lastEditKey = key
  state.lastEditAt = now
  mutate(state.doc)
  state.saveStatus = 'dirty'
}

/** Moves `id` before `beforeId` (last when null) within `items`. */
export const moveBefore = <T extends { id: string }>(items: T[], id: string, beforeId: string | null): void => {
  const from = items.findIndex((item) => item.id === id)
  if (from < 0 || id === beforeId) return
  const [item] = items.splice(from, 1)
  const to = beforeId === null ? items.length : items.findIndex((other) => other.id === beforeId)
  items.splice(to < 0 ? items.length : to, 0, item)
}

const normalise = (name: string): string => name.replace(/\s+/g, ' ').trim().toLocaleLowerCase()

/** Finds a table by name (case and spacing ignored), creating it when new. */
const tableByName = (tables: Draft<GuestTable>[], name: string): string => {
  const wanted = normalise(name)
  if (!wanted) return ''
  const found = tables.find((table) => normalise(table.name) === wanted)
  if (found) return found.id
  if (tables.length >= MAX_TABLES) return ''
  const table = newTable(name.replace(/\s+/g, ' ').trim())
  tables.push(table)
  return table.id
}

export const useListEditorStoreBase = create<ListEditorState & ListEditorActions>()(
  immer(
    combine(
      initialState,
      (set, get): ListEditorActions => ({
        loadDocument: ({ listId, doc, paidAt }) => {
          // A draft saved in this browser before blocks could be resized has no `sizes`, and
          // one saved before sheets had shapes no `shape`.
          const stored: Partial<Pick<ListDocument['design']['layout'], 'sizes'>> = doc.design.layout
          const storedDesign: Partial<Pick<ListDocument['design'], 'shape'>> = doc.design
          const layout = { ...doc.design.layout, sizes: stored.sizes ?? {} }
          const loaded = { ...doc, design: { ...doc.design, shape: storedDesign.shape ?? 'rectangle', layout } }
          set((state) => ({ ...state, ...initialState, listId, doc: loaded, paidAt }))
        },
        reset: () => {
          set((state) => ({ ...state, ...initialState }))
        },
        setSaveStatus: (saveStatus) => {
          set({ saveStatus })
        },
        setPaidAt: (paidAt) => {
          set({ paidAt })
        },
        setListId: (listId) => {
          set({ listId })
        },
        undo: () => {
          set((state) => {
            const previous = state.past.pop()
            if (!previous || !state.doc) return
            const current = original(state.doc)
            if (current) state.future.push(current)
            state.doc = previous
            state.lastEditKey = null
            state.saveStatus = 'dirty'
          })
        },
        redo: () => {
          set((state) => {
            const next = state.future.pop()
            if (!next || !state.doc) return
            const current = original(state.doc)
            if (current) state.past.push(current)
            state.doc = next
            state.lastEditKey = null
            state.saveStatus = 'dirty'
          })
        },

        setTitle: (title) => {
          set((state) => edit(state, 'title', (doc) => void (doc.title = title)))
        },
        setHeaderText: (field, value) => {
          set((state) => edit(state, `content.${field}`, (doc) => void (doc.content[field] = value)))
        },

        addGuest: (name = '', tableId = '') => {
          const guest = newGuest(name, tableId)
          set((state) =>
            edit(state, null, (doc) => {
              if (doc.content.guests.length < MAX_GUESTS) doc.content.guests.push(guest)
            })
          )
          return guest.id
        },
        addGuests: (rows, mode) => {
          set((state) =>
            edit(state, null, (doc) => {
              if (mode === 'replace') {
                doc.content.guests = []
                doc.content.tables = []
                doc.design.layout.positions = {}
                doc.design.layout.sizes = {}
              }
              for (const row of rows) {
                const name = row.name.replace(/\s+/g, ' ').trim()
                if (!name || doc.content.guests.length >= MAX_GUESTS) continue
                const tableId = row.table ? tableByName(doc.content.tables, row.table) : ''
                doc.content.guests.push(newGuest(name, tableId, row.note?.trim() ?? ''))
              }
            })
          )
        },
        updateGuest: (guestId, patch) => {
          set((state) =>
            edit(state, `${guestId}.${Object.keys(patch).join(',')}`, (doc) => {
              const guest = doc.content.guests.find((item) => item.id === guestId)
              if (guest) Object.assign(guest, patch)
            })
          )
        },
        removeGuests: (guestIds) => {
          const ids = new Set(guestIds)
          set((state) => {
            edit(state, null, (doc) => {
              doc.content.guests = doc.content.guests.filter((guest) => !ids.has(guest.id))
              for (const id of ids) {
                delete doc.design.layout.positions[id]
                delete doc.design.layout.sizes[id]
              }
            })
            // A new array only when it changes: everything showing the selection re-renders for one.
            if (state.selection.some((id) => ids.has(id))) state.selection = state.selection.filter((id) => !ids.has(id))
          })
        },
        moveGuest: (guestId, beforeId) => {
          set((state) => edit(state, null, (doc) => moveBefore(doc.content.guests, guestId, beforeId)))
        },
        seatGuest: (guestId, tableId, beforeId) => {
          set((state) =>
            edit(state, null, (doc) => {
              const guest = doc.content.guests.find((item) => item.id === guestId)
              if (!guest) return
              guest.tableId = tableId
              moveBefore(doc.content.guests, guestId, beforeId)
            })
          )
        },
        sortGuests: (order) => {
          set((state) =>
            edit(state, null, (doc) => {
              doc.content.guests.sort((a, b) => compareNames(a.name, b.name) * (order === 'za' ? -1 : 1))
              doc.design.layout.sort = 'manual'
            })
          )
        },
        dedupeGuests: () => {
          const guests = get().doc?.content.guests ?? []
          const seen = new Set<string>()
          const duplicates: string[] = []
          for (const guest of guests) {
            const key = normalise(guest.name)
            if (!key) continue
            if (seen.has(key)) duplicates.push(guest.id)
            else seen.add(key)
          }
          if (!duplicates.length) return 0
          const ids = new Set(duplicates)
          set((state) => {
            edit(state, null, (doc) => {
              doc.content.guests = doc.content.guests.filter((guest) => !ids.has(guest.id))
              for (const id of ids) {
                delete doc.design.layout.positions[id]
                delete doc.design.layout.sizes[id]
              }
            })
            state.selection = state.selection.filter((id) => !ids.has(id))
          })
          return duplicates.length
        },
        applySheet: ({ guests, tables }) => {
          set((state) => {
            if (!state.doc) return
            const kept = new Set([...guests, ...tables].map((item) => item.id))
            const { content } = state.doc
            const removed = new Set([...content.guests, ...content.tables].map((item) => item.id).filter((id) => !kept.has(id)))
            edit(state, null, (doc) => {
              doc.content.guests = guests
              doc.content.tables = tables
              // Dragged or resized blocks that are gone.
              for (const id of removed) {
                delete doc.design.layout.positions[id]
                delete doc.design.layout.sizes[id]
              }
            })
            if (state.selection.some((id) => removed.has(id))) state.selection = state.selection.filter((id) => !removed.has(id))
          })
        },
        clearGuests: () => {
          set((state) => {
            edit(state, null, (doc) => {
              doc.content.guests = []
              doc.design.layout.positions = {}
              doc.design.layout.sizes = {}
            })
            state.selection = []
          })
        },

        addTable: (name) => {
          const table = newTable(name ?? '')
          set((state) =>
            edit(state, null, (doc) => {
              if (doc.content.tables.length < MAX_TABLES) doc.content.tables.push(table)
            })
          )
          return table.id
        },
        renameTable: (tableId, name) => {
          set((state) =>
            edit(state, `${tableId}.name`, (doc) => {
              const table = doc.content.tables.find((item) => item.id === tableId)
              if (table) table.name = name
            })
          )
        },
        removeTable: (tableId) => {
          set((state) => {
            edit(state, null, (doc) => {
              doc.content.tables = doc.content.tables.filter((table) => table.id !== tableId)
              for (const guest of doc.content.guests) if (guest.tableId === tableId) guest.tableId = ''
              delete doc.design.layout.positions[tableId]
              delete doc.design.layout.sizes[tableId]
            })
            state.selection = state.selection.filter((id) => id !== tableId)
          })
        },
        moveTable: (tableId, beforeId) => {
          set((state) => edit(state, null, (doc) => moveBefore(doc.content.tables, tableId, beforeId)))
        },
        autoSeat: (seats, tableName) => {
          const perTable = Math.max(1, Math.round(seats))
          set((state) =>
            edit(state, null, (doc) => {
              const { tables, guests } = doc.content
              const counts = new Map(tables.map((table) => [table.id, 0]))
              for (const guest of guests) if (counts.has(guest.tableId)) counts.set(guest.tableId, (counts.get(guest.tableId) ?? 0) + 1)
              let cursor = 0
              for (const guest of guests) {
                if (counts.has(guest.tableId)) continue
                while (cursor < tables.length && (counts.get(tables[cursor].id) ?? 0) >= perTable) cursor += 1
                if (cursor >= tables.length) {
                  if (tables.length >= MAX_TABLES) break
                  const table = newTable(tableName(tables.length + 1))
                  tables.push(table)
                  counts.set(table.id, 0)
                }
                const table = tables[cursor]
                guest.tableId = table.id
                counts.set(table.id, (counts.get(table.id) ?? 0) + 1)
              }
            })
          )
        },

        setDesign: (patch) => {
          set((state) =>
            edit(state, `design.${Object.keys(patch).join(',')}`, (doc) => {
              const kindChanged = patch.kind !== undefined && patch.kind !== doc.design.kind
              Object.assign(doc.design, patch)
              if (kindChanged && patch.kind) {
                // Each kind has its own grid: a seating board in rows of tables, a plain list
                // in columns of names, cards edge to edge. Dragged and resized blocks belong to the old one.
                Object.assign(doc.design.layout, KIND_LAYOUT[patch.kind], { mode: 'grid', positions: {}, sizes: {} })
                for (const role of TEXT_ROLES) doc.design.type[role].align = KIND_ALIGN[patch.kind][role]
              }
            })
          )
        },
        setPaper: (patch) => {
          set((state) => edit(state, `paper.${Object.keys(patch).join(',')}`, (doc) => applyPaperPatch(doc.design, patch)))
        },
        setPalette: (patch) => {
          set((state) =>
            edit(state, `palette.${Object.keys(patch).join(',')}`, (doc) => {
              doc.design.palette = { ...doc.design.palette, ...patch }
            })
          )
        },
        setTextStyle: (role, patch) => {
          set((state) =>
            edit(state, `type.${role}.${Object.keys(patch).join(',')}`, (doc) => {
              doc.design.type[role] = { ...doc.design.type[role], ...patch }
            })
          )
        },
        setLayout: (patch) => {
          set((state) =>
            edit(state, `layout.${Object.keys(patch).join(',')}`, (doc) => {
              Object.assign(doc.design.layout, patch)
              // A grid change re-flows the sheet; dragged blocks would sit on top of it.
              const regrid = ['columns', 'flow', 'gapX', 'gapY', 'cardWidth', 'cardHeight', 'cardFold'].some((key) => key in patch)
              if (regrid && doc.design.layout.mode === 'grid') doc.design.layout.positions = {}
            })
          )
        },
        fitToPage: ({ columns, textScale }) => {
          set((state) =>
            edit(state, null, (doc) => {
              doc.design.textScale = textScale
              // Fitted on the grid: blocks dragged by hand would sit on top of it.
              Object.assign(doc.design.layout, { columns, mode: 'grid', positions: {} })
            })
          )
        },
        applyTemplate: (templateId) => {
          set((state) =>
            edit(state, null, (doc) => {
              const kind = doc.design.kind
              const type = templateTypography(templateId, kind)
              for (const role of TEXT_ROLES) type[role].align = doc.design.type[role].align
              doc.design.templateId = templateId
              doc.design.palette = { ...TEMPLATES[templateId].palette }
              doc.design.type = type
              doc.design.tableStyle = TEMPLATES[templateId].tableStyle
              doc.design.decor = true
            })
          )
        },

        resetDesign: (scope) => {
          const design = get().doc?.design
          if (!design) return
          const next = resetDesign(design, scope)
          set((state) => edit(state, null, (doc) => void (doc.design = next)))
        },

        setPositions: (positions) => {
          set((state) =>
            edit(state, null, (doc) => {
              Object.assign(doc.design.layout.positions, positions)
              doc.design.layout.mode = 'free'
            })
          )
        },
        resetPositions: (blockIds) => {
          set((state) =>
            edit(state, null, (doc) => {
              if (!blockIds) {
                doc.design.layout.positions = {}
                doc.design.layout.mode = 'grid'
              } else for (const id of blockIds) delete doc.design.layout.positions[id]
            })
          )
        },
        setSize: (blockId, size) => {
          set((state) =>
            // Every frame of one resize lands in one undo step.
            edit(state, `size.${blockId}`, (doc) => {
              doc.design.layout.sizes[blockId] = {
                w: Math.max(MIN_BLOCK_SIZE.w, size.w),
                h: Math.max(MIN_BLOCK_SIZE.h, size.h),
              }
            })
          )
        },
        resetSizes: (blockIds) => {
          set((state) =>
            edit(state, null, (doc) => {
              if (!blockIds) doc.design.layout.sizes = {}
              else for (const id of blockIds) delete doc.design.layout.sizes[id]
            })
          )
        },

        select: (blockIds) => {
          set({ selection: blockIds })
        },
        toggleSelect: (blockId) => {
          set((state) => {
            state.selection = state.selection.includes(blockId)
              ? state.selection.filter((id) => id !== blockId)
              : [...state.selection, blockId]
          })
        },
      })
    )
  )
)

export const useListEditorStore = appendSelectors(useListEditorStoreBase)
