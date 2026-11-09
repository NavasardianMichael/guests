import { create } from 'zustand'
import { appendSelectors } from '@store/appendSelectors'

/** The editor's panels, which are also the steps of making a list (`EDITOR_TABS` orders them). */
export type EditorTab = 'kind' | 'template' | 'design' | 'guests' | 'layout' | 'paper'

export type ImportSource = 'paste' | 'file' | 'photo'

type EditorUiState = {
  tab: EditorTab
  /** Phones and tablets: whether the panel's bottom sheet is open. */
  sheetOpen: boolean
  /** Desktop: the settings column folded to a narrow rail, for more room on the canvas. */
  panelCollapsed: boolean
  /**
   * A drop on the canvas is being committed: the sheet draws the new document in the same frame
   * instead of its deferred copy (`EditorShell`), so what was dropped never shows its old place.
   * Cleared by the shell once the deferred copy has caught up.
   */
  drawNow: boolean
  importSource: ImportSource | null
  /** The guests open as a spreadsheet (`SpreadsheetModal`). */
  spreadsheetOpen: boolean
  /**
   * The list just created, if any: it opens at the first step, not at its (sample) guests. An id,
   * not a one-shot flag — the editor may load the same list twice (StrictMode, a session that
   * resolves late) and every load must agree. Dropped once the user moves to another step.
   */
  justCreated: string | null
  /** The template checkout (`CheckoutModal`): from either Download button, or `?checkout=1`. */
  checkoutOpen: boolean
}

type EditorUiActions = {
  openTab: (tab: EditorTab) => void
  /** The step a list opens at; unlike `openTab`, never opens the phone's bottom sheet. */
  startAt: (tab: EditorTab, listId: string) => void
  /** Called before opening a list just created: `startAt` for it goes to the first step. */
  markJustCreated: (listId: string) => void
  setSheetOpen: (open: boolean) => void
  setPanelCollapsed: (collapsed: boolean) => void
  setDrawNow: (drawNow: boolean) => void
  openImport: (source: ImportSource) => void
  closeImport: () => void
  setSpreadsheetOpen: (open: boolean) => void
  setCheckoutOpen: (open: boolean) => void
}

/** Editor chrome only — what is open — never document data. */
export const useEditorUiStoreBase = create<EditorUiState & EditorUiActions>()((set) => ({
  tab: 'kind',
  sheetOpen: false,
  panelCollapsed: false,
  drawNow: false,
  importSource: null,
  spreadsheetOpen: false,
  justCreated: null,
  checkoutOpen: false,
  // A step opened from the steps bar unfolds the column, so it shows.
  openTab: (tab) => set({ tab, sheetOpen: true, panelCollapsed: false, justCreated: null }),
  startAt: (tab, listId) =>
    set((state) =>
      state.justCreated === listId ? { tab: 'kind', sheetOpen: false } : { tab, sheetOpen: false, justCreated: null }
    ),
  markJustCreated: (listId) => set({ justCreated: listId }),
  setSheetOpen: (sheetOpen) => set({ sheetOpen }),
  setPanelCollapsed: (panelCollapsed) => set({ panelCollapsed }),
  setDrawNow: (drawNow) => set({ drawNow }),
  openImport: (importSource) => set({ importSource }),
  closeImport: () => set({ importSource: null }),
  setSpreadsheetOpen: (spreadsheetOpen) => set({ spreadsheetOpen }),
  setCheckoutOpen: (checkoutOpen) => set({ checkoutOpen }),
}))

export const useEditorUiStore = appendSelectors(useEditorUiStoreBase)
