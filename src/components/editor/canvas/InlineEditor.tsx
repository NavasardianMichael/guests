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
  return doc.content[target.kind]
}

export const writeTarget = (target: EditTarget, value: string): void => {
  const { updateGuest, renameTable, setHeaderText } = useListEditorStoreBase.getState()
  if (target.kind === 'guest') updateGuest(target.id, { name: value })
  else if (target.kind === 'table') renameTable(target.id, value)
  else setHeaderText(target.kind, value)
}

type Props = { target: EditTarget; onDone: () => void }

/**
 * A text opened on the sheet: one line, typed straight into the document (the sheet re-flows
 * as it grows). Enter or leaving the field keeps it; Escape puts back what was there.
 */
export const InlineEditor: FC<Props> = ({ target, onDone }) => {
  const t = useTranslations('Editor.canvas')
  const inputRef = useRef<HTMLInputElement>(null)
  const value = useListEditorStoreBase((state) => (state.doc ? targetText(state.doc, target) : ''))
  const initial = useRef(value)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  return (
    <input
      ref={inputRef}
      className='sh-inline-input'
      value={value}
      maxLength={target.kind === 'guest' || target.kind === 'table' ? 120 : 200}
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
