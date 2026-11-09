import { create } from 'zustand'
import { combine } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { getAccessAPI } from '@api/purchases/main'
import type { Access } from '@api/purchases/types'
import { appendSelectors } from '@store/appendSelectors'
import { reportError } from '@helpers/reportError'

type PurchasesState = {
  /** When this visitor's access pass ends (epoch ms; past once it ran out; null: never bought). Undefined until known. */
  until: number | null | undefined
  /** Whose it is: an account id, or `guest` (this browser's guest key). */
  loadedFor: string | null
}

type PurchasesActions = {
  /** Loads once per owner: a sign-in or sign-out reloads, a re-render does not. */
  load: (owner: string) => Promise<void>
  /**
   * Asks again (the server re-checks pending payments): after a payment, or a print refused.
   * With `paymentId`, also answers that payment's status (the payment result page).
   */
  refresh: (paymentId?: string) => Promise<Access>
}

const initialState: PurchasesState = { until: undefined, loadedFor: null }

/**
 * This visitor's access pass (docs/PAYMENTS.md): whether everything prints clean, and the days
 * left the editor and dashboard show. Read through `useAccessUntil`, which loads it for whoever
 * is signed in. A failed load counts as no pass — the API still prints what is paid for, and
 * says so with a 402 otherwise.
 */
export const usePurchasesStoreBase = create<PurchasesState & PurchasesActions>()(
  immer(
    combine(initialState, (set, get): PurchasesActions => {
      const fetchFor = async (owner: string, paymentId?: string): Promise<Access> => {
        try {
          const access = await getAccessAPI(paymentId ? { paymentId } : undefined)
          if (get().loadedFor === owner) set({ until: access.until })
          return access
        } catch (error) {
          reportError(error, 'purchases:load')
          if (get().loadedFor === owner) set({ until: get().until ?? null })
          return { until: get().until ?? null, payment: null }
        }
      }
      return {
        load: async (owner) => {
          if (get().loadedFor === owner) return
          set({ loadedFor: owner, until: undefined })
          await fetchFor(owner)
        },
        refresh: async (paymentId) => {
          const owner = get().loadedFor
          return owner ? fetchFor(owner, paymentId) : { until: null, payment: null }
        },
      }
    })
  )
)

export const usePurchasesStore = appendSelectors(usePurchasesStoreBase)
