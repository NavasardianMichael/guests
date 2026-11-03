import { create } from 'zustand'
import { combine } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { deleteListAPI, duplicateListAPI, getListsAPI } from '@api/lists/main'
import { appendSelectors } from '@store/appendSelectors'
import { processError } from '@helpers/error'
import type { ListsActions, ListsState } from './types'

const initialState: ListsState = {
  list: { byId: {}, allIds: [] },
  isLoaded: false,
  isPending: false,
  error: null,
}

/** The dashboard's lists. Rejections are rethrown to the caller that shows them. */
export const useListsStoreBase = create<ListsState & ListsActions>()(
  immer(
    combine(
      initialState,
      (set): ListsActions => ({
        getLists: async () => {
          set({ isPending: true, error: null })
          try {
            const lists = await getListsAPI()
            set((state) => {
              state.list = {
                byId: Object.fromEntries(lists.map((item) => [item.id, item])),
                allIds: lists.map((item) => item.id),
              }
              state.isLoaded = true
            })
          } catch (error) {
            set({ error: processError(error) })
            throw error
          } finally {
            set({ isPending: false })
          }
        },
        duplicateList: async (id) => {
          const copy = await duplicateListAPI({ id })
          set((state) => {
            state.list.byId[copy.id] = copy
            state.list.allIds.unshift(copy.id)
          })
          return copy
        },
        deleteList: async (id) => {
          await deleteListAPI({ id })
          set((state) => {
            delete state.list.byId[id]
            state.list.allIds = state.list.allIds.filter((existing) => existing !== id)
          })
        },
      })
    )
  )
)

export const useListsStore = appendSelectors(useListsStoreBase)
