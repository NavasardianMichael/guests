'use client'

import { useEditorUiStore, useEditorUiStoreBase } from '@store/editorUi/store'
import { useListEditorStoreBase } from '@store/lists/single/store'
import type { ListDocument } from '@store/lists/single/types'

/** The document as it was when the spreadsheet opened; null while it is closed. */
let held: ListDocument | null = null

useEditorUiStoreBase.subscribe((state, previous) => {
  if (state.spreadsheetOpen === previous.spreadsheetOpen) return
  held = state.spreadsheetOpen ? useListEditorStoreBase.getState().doc : null
})

/**
 * Part of the document, for the editor behind the spreadsheet (`SpreadsheetModal`). The
 * spreadsheet covers the editor, so while it is open the editor keeps the document as it was
 * when it opened and catches up once, when it closes: an edit in the spreadsheet re-renders the
 * spreadsheet alone, not the sheet's layout and the guests panel nobody can see. Elsewhere, read
 * the store directly.
 */
export const useBehindSpreadsheet = <T>(select: (doc: ListDocument | null) => T): T => {
  const open = useEditorUiStore.use.spreadsheetOpen()
  return useListEditorStoreBase((state) => select(open && held ? held : state.doc))
}
