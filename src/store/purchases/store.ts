import { create } from 'zustand'
import { combine } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { getOwnedTemplatesAPI } from '@api/purchases/main'
import { appendSelectors } from '@store/appendSelectors'
import type { TemplateId } from '@constants/templates'
import { reportError } from '@helpers/reportError'

type PurchasesState = {
  /** The premium templates this visitor has bought; null until known. */
  templates: TemplateId[] | null
  /** Whose they are: an account id, or `guest` (this browser's guest key). */
  loadedFor: string | null
}

type PurchasesActions = {
  /** Loads once per owner: a sign-in or sign-out reloads, a re-render does not. */
  load: (owner: string) => Promise<void>
  /** Asks again (the server re-checks pending payments): after a payment, or a print refused. */
  refresh: () => Promise<TemplateId[]>
}

const initialState: PurchasesState = { templates: null, loadedFor: null }

/**
 * The templates this visitor owns (docs/PAYMENTS.md): what prints clean, which lists keep their
 * template (the editor's Template step), and the "Bought" badges. Read through
 * `useOwnedTemplates`, which loads it for whoever is signed in. A failed load counts as owning
 * nothing — the API still prints what is bought, and says so with a 402 otherwise.
 */
export const usePurchasesStoreBase = create<PurchasesState & PurchasesActions>()(
  immer(
    combine(initialState, (set, get): PurchasesActions => {
      const fetchFor = async (owner: string): Promise<TemplateId[]> => {
        try {
          const templates = await getOwnedTemplatesAPI()
          if (get().loadedFor === owner) set({ templates })
          return templates
        } catch (error) {
          reportError(error, 'purchases:load')
          if (get().loadedFor === owner) set({ templates: get().templates ?? [] })
          return get().templates ?? []
        }
      }
      return {
        load: async (owner) => {
          if (get().loadedFor === owner) return
          set({ loadedFor: owner, templates: null })
          await fetchFor(owner)
        },
        refresh: async () => {
          const owner = get().loadedFor
          return owner ? fetchFor(owner) : []
        },
      }
    })
  )
)

export const usePurchasesStore = appendSelectors(usePurchasesStoreBase)
