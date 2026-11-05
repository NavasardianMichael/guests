import { create } from 'zustand'
import { appendSelectors } from '@store/appendSelectors'

/** The editor's panels, which are also the steps of making a list (`EDITOR_TABS` orders them). */
export type EditorTab = 'kind' | 'design' | 'guests' | 'layout' | 'paper'

export type ImportSource = 'paste' | 'file' | 'photo'

type EditorUiState = {
  tab: EditorTab
  /** Phones and tablets: whether the panel's bottom sheet is open. */
  sheetOpen: boolean
  importSource: ImportSource | null
}

type EditorUiActions = {
  openTab: (tab: EditorTab) => void
  /** The step a list opens at; unlike `openTab`, never opens the phone's bottom sheet. */
  startAt: (tab: EditorTab) => void
  setSheetOpen: (open: boolean) => void
  openImport: (source: ImportSource) => void
  closeImport: () => void
}

/** Editor chrome only — what is open — never document data. */
export const useEditorUiStoreBase = create<EditorUiState & EditorUiActions>()((set) => ({
  tab: 'kind',
  sheetOpen: false,
  importSource: null,
  openTab: (tab) => set({ tab, sheetOpen: true }),
  startAt: (tab) => set({ tab, sheetOpen: false }),
  setSheetOpen: (sheetOpen) => set({ sheetOpen }),
  openImport: (importSource) => set({ importSource }),
  closeImport: () => set({ importSource: null }),
}))

export const useEditorUiStore = appendSelectors(useEditorUiStoreBase)
