'use client'

import { type FC, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useListEditorStoreBase } from '@store/lists/single/store'
import type { ListDocument } from '@store/lists/single/types'
import type { EditTarget } from '@components/sheet/SheetInteraction'

/** The text a target edits, as stored (not upper-cased, not wrapped). */
export const targetText = (doc: ListDocument, target: EditTarget): string => {
  if (target.kind === 'guest') return doc.content.guests.find((guest) => guest.id === target.id)?.name ?? ''
  if (target.kind === 'table') return doc.content.tables.find((table) => table.id === target.id)?.name ?? ''
  if (target.kind === 'item') return doc.content.venue.find((item) => item.id === target.id)?.label ?? ''
  return doc.content[target.kind]
}

export const writeTarget = (target: EditTarget, value: string): void => {
  const { updateGuest, renameTable, renameVenueItem, setHeaderText } = useListEditorStoreBase.getState()
  if (target.kind === 'guest') updateGuest(target.id, { name: value })
  else if (target.kind === 'table') renameTable(target.id, value)
  else if (target.kind === 'item') renameVenueItem(target.id, value)
  else setHeaderText(target.kind, value)
}

type Props = {
  target: EditTarget
  /** Where the click landed, as a character offset; the end of the text when unknown. */
  caret?: number
  onDone: () => void
}

/**
 * A text opened on the sheet: one line, typed straight into the document (the sheet re-flows
 * as it grows). Enter or leaving the field keeps it; Escape puts back what was there.
 */
export const InlineEditor: FC<Props> = ({ target, caret, onDone }) => {
  const t = useTranslations('Editor.canvas')
  const inputRef = useRef<HTMLInputElement>(null)
  const value = useListEditorStoreBase((state) => (state.doc ? targetText(state.doc, target) : ''))
  const initial = useRef(value)

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    // The caret where the text was clicked, never the whole text selected: typing goes in at
    // that point, and a selection would hide the caret.
    const at = Math.min(Math.max(0, caret ?? input.value.length), input.value.length)
    input.setSelectionRange(at, at)
    // Opened by the mount, not by later renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <input
      ref={inputRef}
      className='sh-inline-input'
      value={value}
      maxLength={target.kind === 'item' ? 60 : target.kind === 'guest' || target.kind === 'table' ? 120 : 200}
      aria-label={t(`edit.${target.kind}`)}
      onChange={(event) => writeTarget(target, event.target.value)}
      onPointerDown={(event) => event.stopPropagation()}
      onBlur={onDone}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter') onDone()
        if (event.key === 'Escape') {
          writeTarget(target, initial.current)
          onDone()
        }
      }}
    />
  )
}
