import { create } from 'zustand'
import { combine } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { appendSelectors } from '@store/appendSelectors'
import { MAX_GUESTS, MAX_TABLES, moveBefore } from '@store/lists/single/store'
import type { SheetContent, SheetEdit } from '@store/lists/single/types'
import { newGuest, newTable } from '@helpers/listFactory'

/**
 * The guests open in the spreadsheet (`SpreadsheetModal`): a draft of the list's guests and
 * tables, edited apart from the list. The list gets it only when the user saves
 * (`applySheet`, one undo step, then autosaved as any edit); closing without saving drops it.
 */
type GuestSheetState = {
  /** The guests and tables as the list had them when the spreadsheet opened (or was last saved). */
  base: SheetContent | null
  draft: SheetContent | null
  /** Edited since it opened, was saved or reset. */
  dirty: boolean
}

type GuestSheetActions = {
  start: (content: SheetContent) => void
  /** Back to `base`. */
  discard: () => void
  /** The draft now is what the list has. */
  markSaved: () => void
  clear: () => void

  addGuest: (name: string, tableId: string) => void
  renameGuest: (guestId: string, name: string) => void
  removeGuest: (guestId: string) => void
  /** A guest to `tableId`, before `beforeId` in the whole list (null: last). */
  seatGuest: (guestId: string, tableId: string, beforeId: string | null) => void
  /** A pasted block. */
  editSheet: (edit: SheetEdit) => void

  addTable: (name: string) => void
  renameTable: (tableId: string, name: string) => void
  /** Its guests stay, without a table. */
  removeTable: (tableId: string) => void
  moveTable: (tableId: string, beforeId: string | null) => void
}

const initialState: GuestSheetState = { base: null, draft: null, dirty: false }

export const useGuestSheetStoreBase = create<GuestSheetState & GuestSheetActions>()(
  immer(
    combine(initialState, (set): GuestSheetActions => {
      /** Every edit: on the draft, if one is open, marking it unsaved. */
      const edit = (mutate: (draft: SheetContent) => void) =>
        set((state) => {
          if (!state.draft) return
          mutate(state.draft)
          state.dirty = true
        })

      return {
        start: (content) => set({ base: content, draft: content, dirty: false }),
        discard: () => set((state) => ({ ...state, draft: state.base, dirty: false })),
        markSaved: () => set((state) => ({ ...state, base: state.draft, dirty: false })),
        clear: () => set(initialState),

        addGuest: (name, tableId) =>
          edit((draft) => {
            if (draft.guests.length < MAX_GUESTS) draft.guests.push(newGuest(name, tableId))
          }),
        renameGuest: (guestId, name) =>
          edit((draft) => {
            const guest = draft.guests.find((item) => item.id === guestId)
            if (guest) guest.name = name
          }),
        removeGuest: (guestId) =>
          edit((draft) => {
            draft.guests = draft.guests.filter((guest) => guest.id !== guestId)
          }),
        seatGuest: (guestId, tableId, beforeId) =>
          edit((draft) => {
            const guest = draft.guests.find((item) => item.id === guestId)
            if (!guest) return
            guest.tableId = tableId
            moveBefore(draft.guests, guestId, beforeId)
          }),
        editSheet: ({ guests, tables = [], remove = [] }) =>
          edit((draft) => {
            for (const change of tables) {
              const table = draft.tables.find((item) => item.id === change.id)
              if (table) table.name = change.name
            }
            for (const change of guests) {
              if ('id' in change) {
                const guest = draft.guests.find((item) => item.id === change.id)
                if (guest) guest.name = change.name
              } else if (draft.guests.length < MAX_GUESTS) {
                draft.guests.push(newGuest(change.name, change.tableId))
              }
            }
            if (remove.length) {
              const removed = new Set(remove)
              draft.guests = draft.guests.filter((guest) => !removed.has(guest.id))
            }
          }),

        addTable: (name) =>
          edit((draft) => {
            if (draft.tables.length < MAX_TABLES) draft.tables.push(newTable(name))
          }),
        renameTable: (tableId, name) =>
          edit((draft) => {
            const table = draft.tables.find((item) => item.id === tableId)
            if (table) table.name = name
          }),
        removeTable: (tableId) =>
          edit((draft) => {
            draft.tables = draft.tables.filter((table) => table.id !== tableId)
            for (const guest of draft.guests) if (guest.tableId === tableId) guest.tableId = ''
          }),
        moveTable: (tableId, beforeId) => edit((draft) => moveBefore(draft.tables, tableId, beforeId)),
      }
    })
  )
)

export const useGuestSheetStore = appendSelectors(useGuestSheetStoreBase)
