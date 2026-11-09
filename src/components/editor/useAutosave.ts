'use client'

import { type FC, useEffect } from 'react'
import { updateListAPI } from '@api/lists/main'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import { DRAFT_ID } from '@store/lists/single/types'
import { useLeaveGuard } from '@hooks/useLeaveGuard'
import { writeLocalDraft } from '@helpers/localDraft'
import { reportError } from '@helpers/reportError'

const DEBOUNCE_MS = 900
const RETRY_MS = 5000

/** Saves run one at a time, so a slow save can never land after (and undo) a newer one. */
let inFlight: Promise<void> = Promise.resolve()

const saveCurrent = (): Promise<void> => {
  inFlight = inFlight.then(async () => {
    const { listId, doc, saveStatus, setSaveStatus } = useListEditorStoreBase.getState()
    if (!listId || !doc || saveStatus === 'saved') return

    if (listId === DRAFT_ID) {
      setSaveStatus(writeLocalDraft(doc) ? 'saved' : 'error')
      return
    }

    setSaveStatus('saving')
    try {
      await updateListAPI({ id: listId, title: doc.title, content: doc.content, design: doc.design })
      // An edit made while the request was out leaves the document newer than what was sent.
      setSaveStatus(useListEditorStoreBase.getState().doc === doc ? 'saved' : 'dirty')
    } catch (error) {
      reportError(error, 'editor:autosave')
      setSaveStatus('error')
    }
  })
  return inFlight
}

/** Saves now, if anything is unsaved — before the server prints its copy. */
export const flushSave = async (): Promise<boolean> => {
  await saveCurrent()
  return useListEditorStoreBase.getState().saveStatus === 'saved'
}

/**
 * Debounced autosave of the open list: to the API for a saved list, to localStorage for a
 * guest's draft. A failed save retries on its own; leaving with unsaved work asks first.
 */
export const useAutosave = (): void => {
  const doc = useListEditorStore.use.doc()
  const saveStatus = useListEditorStore.use.saveStatus()
  const setSaveStatus = useListEditorStore.use.setSaveStatus()

  useEffect(() => {
    if (saveStatus !== 'dirty') return
    const timer = setTimeout(() => void saveCurrent(), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [doc, saveStatus])

  useEffect(() => {
    if (saveStatus !== 'error') return
    const timer = setTimeout(() => setSaveStatus('dirty'), RETRY_MS)
    return () => clearTimeout(timer)
  }, [saveStatus, setSaveStatus])

  // Closing, reloading, a link or Back while an edit is not saved yet asks first (`LeaveGuard`).
  useLeaveGuard(saveStatus !== 'saved' && 'unsaved')
}

/**
 * `useAutosave` as a component of its own. It re-renders on every keystroke (it watches
 * `doc`), so it must not live in a component with children: that would re-render the editor.
 */
export const Autosave: FC = () => {
  useAutosave()
  return null
}
