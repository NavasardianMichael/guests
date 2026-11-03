import { create } from 'zustand'
import { appendSelectors } from '@store/appendSelectors'

/** The editor's panels. */
export type EditorTab = 'guests' | 'layout' | 'design' | 'paper'

export type ImportSource = 'paste' | 'file' | 'photo'

type EditorUiState = {
  tab: EditorTab
  /** Phones and tablets: whether the panel's bottom sheet is open. */
  sheetOpen: boolean
  importSource: ImportSource | null
}

type EditorUiActions = {
  openTab: (tab: EditorTab) => void
  setSheetOpen: (open: boolean) => void
  openImport: (source: ImportSource) => void
  closeImport: () => void
}

/** Editor chrome only — what is open — never document data. */
export const useEditorUiStoreBase = create<EditorUiState & EditorUiActions>()((set) => ({
  tab: 'guests',
  sheetOpen: false,
  importSource: null,
  openTab: (tab) => set({ tab, sheetOpen: true }),
  setSheetOpen: (sheetOpen) => set({ sheetOpen }),
  openImport: (importSource) => set({ importSource }),
  closeImport: () => set({ importSource: null }),
}))

export const useEditorUiStore = appendSelectors(useEditorUiStoreBase)
