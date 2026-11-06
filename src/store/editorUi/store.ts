import { create } from 'zustand'
import { appendSelectors } from '@store/appendSelectors'

/** The editor's panels, which are also the steps of making a list (`EDITOR_TABS` orders them). */
export type EditorTab = 'kind' | 'template' | 'design' | 'guests' | 'layout' | 'paper'

export type ImportSource = 'paste' | 'file' | 'photo'

type EditorUiState = {
  tab: EditorTab
  /** Phones and tablets: whether the panel's bottom sheet is open. */
  sheetOpen: boolean
  importSource: ImportSource | null
  /** The guests open as a spreadsheet (`SpreadsheetModal`). */
  spreadsheetOpen: boolean
  /**
   * The list just created, if any: it opens at the first step, not at its (sample) guests. An id,
   * not a one-shot flag — the editor may load the same list twice (StrictMode, a session that
   * resolves late) and every load must agree. Dropped once the user moves to another step.
   */
  justCreated: string | null
}

type EditorUiActions = {
  openTab: (tab: EditorTab) => void
  /** The step a list opens at; unlike `openTab`, never opens the phone's bottom sheet. */
  startAt: (tab: EditorTab, listId: string) => void
  /** Called before opening a list just created: `startAt` for it goes to the first step. */
  markJustCreated: (listId: string) => void
  setSheetOpen: (open: boolean) => void
  openImport: (source: ImportSource) => void
  closeImport: () => void
  setSpreadsheetOpen: (open: boolean) => void
}

/** Editor chrome only — what is open — never document data. */
export const useEditorUiStoreBase = create<EditorUiState & EditorUiActions>()((set) => ({
  tab: 'kind',
  sheetOpen: false,
  importSource: null,
  spreadsheetOpen: false,
  justCreated: null,
  openTab: (tab) => set({ tab, sheetOpen: true, justCreated: null }),
  startAt: (tab, listId) =>
    set((state) =>
      state.justCreated === listId ? { tab: 'kind', sheetOpen: false } : { tab, sheetOpen: false, justCreated: null }
    ),
  markJustCreated: (listId) => set({ justCreated: listId }),
  setSheetOpen: (sheetOpen) => set({ sheetOpen }),
  openImport: (importSource) => set({ importSource }),
  closeImport: () => set({ importSource: null }),
  setSpreadsheetOpen: (spreadsheetOpen) => set({ spreadsheetOpen }),
}))

export const useEditorUiStore = appendSelectors(useEditorUiStoreBase)
