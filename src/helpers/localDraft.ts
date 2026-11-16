import type { ListDocument } from '@store/lists/single/types'
import { newId } from './listFactory'
import { reportError } from './reportError'

/**
 * A guest's lists, kept in this browser until they sign in — then the editor imports each one it
 * opens as a server list and clears it. Any number of drafts, one storage key each, so starting
 * another list never touches the others and two tabs on two drafts never overwrite each other.
 * A draft's id (`draft-…`) is its editor URL: `/editor/draft-…`. The dashboard lists them.
 *
 * Every access is wrapped: storage can be full, disabled, or throw in a private window, and
 * none of that may break the editor — the draft simply is not kept.
 */
const KEY_PREFIX = 'guests:draft:v2:'
const DRAFT_ID_PREFIX = 'draft-'

/** The one draft a browser could hold before drafts had ids — its key, and its editor URL's id. */
const LEGACY_KEY = 'guests:draft:v1'
export const LEGACY_DRAFT_ID = 'draft'

/** `edited` false: still the list as it was started, so nothing of the guest's would be lost. */
type StoredDraft = { doc: ListDocument; savedAt: string; edited: boolean }

export type LocalDraft = StoredDraft & { id: string }

/** A guest's local list rather than a server one (server ids are cuids). */
export const isDraftId = (id: string | null | undefined): id is string => !!id && id.startsWith(DRAFT_ID_PREFIX)

const keyOf = (id: string): string => `${KEY_PREFIX}${id}`

/** Null for anything that is not a draft this code can open. */
const parse = (raw: string | null): StoredDraft | null => {
  if (!raw) return null
  const parsed = JSON.parse(raw) as Partial<StoredDraft>
  const doc = parsed.doc
  if (!doc?.content || !Array.isArray(doc.content.guests) || !doc.design?.templateId || !doc.design.layout) return null
  return {
    doc,
    savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
    // A draft stored without the flag may hold the guest's work: keep it.
    edited: parsed.edited !== false,
  }
}

const draftKeys = (): string[] => {
  const keys: string[] = []
  for (let index = 0; index < window.localStorage.length; index++) {
    const key = window.localStorage.key(index)
    if (key?.startsWith(KEY_PREFIX)) keys.push(key)
  }
  return keys
}

/** The single draft of before becomes one of the many, under an id of its own. */
const migrateLegacy = (): void => {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY)
    if (raw === null) return
    const draft = parse(raw)
    if (draft) window.localStorage.setItem(keyOf(`${DRAFT_ID_PREFIX}${newId()}`), JSON.stringify(draft))
    window.localStorage.removeItem(LEGACY_KEY)
  } catch (error) {
    reportError(error, 'localDraft:migrate')
  }
}

/** This browser's drafts, the last saved first. */
export const listLocalDrafts = (): LocalDraft[] => {
  migrateLegacy()
  try {
    return draftKeys()
      .flatMap((key) => {
        const draft = parse(window.localStorage.getItem(key))
        return draft ? [{ ...draft, id: key.slice(KEY_PREFIX.length) }] : []
      })
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
  } catch (error) {
    reportError(error, 'localDraft:list')
    return []
  }
}

export const readLocalDraft = (id: string): ListDocument | null => {
  migrateLegacy()
  try {
    return parse(window.localStorage.getItem(keyOf(id)))?.doc ?? null
  } catch (error) {
    reportError(error, 'localDraft:read')
    return null
  }
}

/** Cheap enough to call on every render (no parsing): whether this browser holds a draft. */
export const hasLocalDrafts = (): boolean => {
  try {
    return window.localStorage.getItem(LEGACY_KEY) !== null || draftKeys().length > 0
  } catch {
    return false
  }
}

const store = (id: string, doc: ListDocument, edited: boolean): boolean => {
  try {
    const value: StoredDraft = { doc, savedAt: new Date().toISOString(), edited }
    window.localStorage.setItem(keyOf(id), JSON.stringify(value))
    return true
  } catch (error) {
    reportError(error, 'localDraft:write')
    return false
  }
}

/**
 * Keeps a new draft and returns its id; null when the browser refused (site data blocked, or
 * full). Drafts never edited go first: they are only the sample list as it was started, and
 * would otherwise pile up on the dashboard, one per template the guest looked into.
 */
export const startLocalDraft = (doc: ListDocument): string | null => {
  for (const draft of listLocalDrafts()) {
    if (!draft.edited) clearLocalDraft(draft.id)
  }
  const id = `${DRAFT_ID_PREFIX}${newId()}`
  return store(id, doc, false) ? id : null
}

/** Autosave's write. False when the browser refused (quota, privacy mode); the editor shows it as unsaved. */
export const writeLocalDraft = (id: string, doc: ListDocument): boolean => store(id, doc, true)

export const clearLocalDraft = (id: string): void => {
  try {
    window.localStorage.removeItem(keyOf(id))
  } catch (error) {
    reportError(error, 'localDraft:clear')
  }
}
