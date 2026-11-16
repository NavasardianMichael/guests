import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ListDocument } from '@store/lists/single/types'
import {
  clearLocalDraft,
  hasLocalDrafts,
  isDraftId,
  listLocalDrafts,
  readLocalDraft,
  startLocalDraft,
  writeLocalDraft,
} from '@helpers/localDraft'

vi.mock('@helpers/reportError', () => ({ reportError: () => undefined }))

/** localStorage as the browser has it: string values, keys enumerable by index. */
const fakeStorage = (): Storage => {
  const items = new Map<string, string>()
  return {
    get length() {
      return items.size
    },
    key: (index) => [...items.keys()][index] ?? null,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, String(value)),
    removeItem: (key) => void items.delete(key),
    clear: () => items.clear(),
  }
}

let storage: Storage

beforeEach(() => {
  storage = fakeStorage()
  vi.stubGlobal('window', { localStorage: storage })
})

/** Only what the draft store checks; the rest of a list is not its business. */
const doc = (title: string) => ({ title, content: { guests: [] }, design: { templateId: 'free', layout: {} } }) as unknown as ListDocument

describe('local drafts', () => {
  it('starting a new draft keeps an edited one beside it', () => {
    const first = startLocalDraft(doc('first'))!
    expect(writeLocalDraft(first, doc('first, edited'))).toBe(true)
    const second = startLocalDraft(doc('second'))!

    expect(second).not.toBe(first)
    expect(readLocalDraft(first)?.title).toBe('first, edited')
    expect(readLocalDraft(second)?.title).toBe('second')
    expect(listLocalDrafts().map((draft) => draft.id).sort()).toEqual([first, second].sort())
  })

  it('a draft never edited gives way to the next one: it is only the list as started', () => {
    const untouched = startLocalDraft(doc('untouched'))!
    const next = startLocalDraft(doc('next'))!
    expect(readLocalDraft(untouched)).toBeNull()
    expect(listLocalDrafts().map((draft) => draft.id)).toEqual([next])
  })

  it('ids are draft ids, never a server cuid', () => {
    expect(isDraftId(startLocalDraft(doc('a')))).toBe(true)
    expect(isDraftId('clx0abc123def456ghi789jk')).toBe(false)
    expect(isDraftId(null)).toBe(false)
  })

  it('clearing one draft leaves the others', () => {
    const keep = startLocalDraft(doc('keep'))!
    writeLocalDraft(keep, doc('keep'))
    const drop = startLocalDraft(doc('drop'))!
    clearLocalDraft(drop)
    expect(listLocalDrafts().map((draft) => draft.id)).toEqual([keep])
    expect(hasLocalDrafts()).toBe(true)
    clearLocalDraft(keep)
    expect(hasLocalDrafts()).toBe(false)
  })

  it('the single draft of before becomes one of the list, kept as edited', () => {
    storage.setItem('guests:draft:v1', JSON.stringify({ doc: doc('old'), savedAt: '2026-01-01T00:00:00.000Z' }))
    expect(hasLocalDrafts()).toBe(true)

    const [legacy] = listLocalDrafts()
    expect(legacy.doc.title).toBe('old')
    expect(legacy.edited).toBe(true)
    expect(isDraftId(legacy.id)).toBe(true)
    expect(storage.getItem('guests:draft:v1')).toBeNull()

    startLocalDraft(doc('new'))
    expect(readLocalDraft(legacy.id)?.title).toBe('old')
  })

  it('a refused write starts nothing', () => {
    storage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    expect(startLocalDraft(doc('a'))).toBeNull()
  })
})
