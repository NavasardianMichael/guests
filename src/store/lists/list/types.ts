import type { GuestList } from '@store/lists/single/types'
import type { Normalized } from '@interfaces/commons'
import type { StateCommonProps } from '@interfaces/store'

export type ListsState = {
  list: Normalized<GuestList>
  /** Whether the list has been fetched at least once. */
  isLoaded: boolean
} & StateCommonProps

export type ListsActions = {
  getLists: () => Promise<void>
  duplicateList: (id: string) => Promise<GuestList>
  deleteList: (id: string) => Promise<void>
}
