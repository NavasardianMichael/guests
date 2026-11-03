import type { ListDocument } from '@store/lists/single/types'
import { reportError } from './reportError'

/**
 * A guest's list, kept in this browser until they sign in — then the editor imports it as a
 * server list and clears it. One draft per browser: a guest who starts another list is asked
 * before the old one is replaced (`/editor/new`).
 *
 * Every access is wrapped: storage can be full, disabled, or throw in a private window, and
 * none of that may break the editor — the draft simply is not kept.
 */
const KEY = 'guests:draft:v1'

type StoredDraft = { doc: ListDocument; savedAt: string }

export const readLocalDraft = (): ListDocument | null => {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredDraft>
    const doc = parsed.doc
    if (!doc?.content || !Array.isArray(doc.content.guests) || !doc.design?.templateId || !doc.design.layout) return null
    return doc
  } catch (error) {
    reportError(error, 'localDraft:read')
    return null
  }
}

/** False when the browser refused (quota, privacy mode); the editor shows it as unsaved. */
export const writeLocalDraft = (doc: ListDocument): boolean => {
  try {
    const value: StoredDraft = { doc, savedAt: new Date().toISOString() }
    window.localStorage.setItem(KEY, JSON.stringify(value))
    return true
  } catch (error) {
    reportError(error, 'localDraft:write')
    return false
  }
}

export const clearLocalDraft = (): void => {
  try {
    window.localStorage.removeItem(KEY)
  } catch (error) {
    reportError(error, 'localDraft:clear')
  }
}
