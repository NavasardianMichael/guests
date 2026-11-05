'use client'

import { createContext, type FC, memo, type PointerEvent, useContext, useEffect, useRef, useState } from 'react'
import { HolderOutlined } from '@ant-design/icons'
import { useListEditorStoreBase } from '@store/lists/single/store'
import { cn } from '@helpers/cn'
import { isBlock, parseClipboard } from '@helpers/guestSheet'
import type { DragSource } from './useSheetDrag'

/**
 * What the grid does with its cells. One object for the whole grid, stable across renders, so
 * a cell re-renders only when its own value changes.
 */
export type CellHandlers = {
  /** A cell left with new text (Enter, Tab, the arrows, a click elsewhere, the window closing). */
  commit: (row: number, col: number, value: string) => void
  /** A block copied from a spreadsheet, dropped with its top-left corner here. */
  paste: (row: number, col: number, matrix: string[][]) => void
  /** Enter, Shift+Enter and the arrows: the neighbouring cell, once the edit has rendered. */
  move: (row: number, col: number, rows: number, cols: number) => void
  /** A drag handle pressed. */
  drag: (event: PointerEvent, source: DragSource) => void
}

export const CellContext = createContext<CellHandlers | null>(null)

/** The cell at (`row`, `col`) of the grid under `root`, focused with its text selected, as a spreadsheet does. */
export const focusCell = (root: HTMLElement | null, row: number, col: number): boolean => {
  const input = root?.querySelector<HTMLInputElement>(`input[data-cell="${row}:${col}"]`)
  if (!input) return false
  input.focus()
  input.select()
  input.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  return true
}

/** The grip a guest's cell or a table's header is dragged by: a mouse's only (touch scrolls the grid). */
export const DragGrip: FC<{ source: DragSource; label: string; className?: string }> = ({
  source,
  label,
  className,
}) => {
  const handlers = useContext(CellContext)
  return (
    <button
      type='button'
      tabIndex={-1}
      aria-label={label}
      onPointerDown={(event) => handlers?.drag(event, source)}
      className={cn(
        'hidden shrink-0 cursor-grab touch-none place-items-center border-0 bg-transparent p-0 text-xs text-muted opacity-0 group-hover/cell:opacity-100 active:cursor-grabbing pointer-fine:grid',
        className
      )}
    >
      <HolderOutlined />
    </button>
  )
}

type Props = {
  row: number
  col: number
  value: string
  /** The column's name, for screen readers. */
  label: string
  maxLength: number
  placeholder?: string
  className?: string
  /** The guest this cell is: it can be dragged by its grip. */
  guestId?: string
  gripLabel?: string
}

/**
 * One cell: a borderless input filling its grid square. Typing stays in the cell — nothing else
 * on the page re-renders — until the cell is left, when the list takes the text in one edit, as
 * a spreadsheet does. Escape puts the text back; Enter / Shift+Enter go down / up, the arrows
 * move between cells (left and right once the caret is at the text's edge), Tab is the
 * browser's own. Pasting a block copied from Excel fills the cells from this one on.
 */
export const SpreadsheetCell: FC<Props> = memo(function SpreadsheetCell({
  row,
  col,
  value,
  label,
  maxLength,
  placeholder,
  className,
  guestId,
  gripLabel,
}) {
  const handlers = useContext(CellContext)
  const [draft, setDraft] = useState<string | null>(null)
  /** The text being typed, read by handlers that run before the next render. */
  const draftRef = useRef<string | null>(null)
  const latest = useRef({ row, col, value, handlers })
  useEffect(() => {
    latest.current = { row, col, value, handlers }
  })
  // The window closing (Escape, ×) removes the cell without a blur: the text typed is kept.
  useEffect(
    () => () => {
      const text = draftRef.current
      const cell = latest.current
      if (text !== null && text !== cell.value) cell.handlers?.commit(cell.row, cell.col, text)
    },
    []
  )
  if (!handlers) return null

  const edit = (next: string | null) => {
    draftRef.current = next
    setDraft(next)
  }
  const commit = () => {
    const text = draftRef.current
    if (text === null) return
    edit(null)
    if (text !== value) handlers.commit(row, col, text)
  }

  return (
    <div className='group/cell flex items-center'>
      {guestId && (
        <DragGrip
          source={{ kind: 'guest', id: guestId, label: value }}
          label={gripLabel ?? label}
          className='h-8 w-3.5 pl-0.5'
        />
      )}
      <input
        data-cell={`${row}:${col}`}
        className={cn(
          'block w-full min-w-0 scroll-mt-10 scroll-ml-12 border-0 bg-transparent px-2 py-1.5 text-sm text-text outline-none',
          'placeholder:text-muted/60 focus:bg-surface focus:ring-2 focus:ring-accent focus:ring-inset',
          guestId && 'pointer-fine:pl-1',
          className
        )}
        value={draft ?? value}
        placeholder={placeholder}
        aria-label={label}
        maxLength={maxLength}
        autoComplete='off'
        spellCheck={false}
        onChange={(event) => edit(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return
          const input = event.currentTarget
          const atStart = input.selectionStart === 0 && input.selectionEnd === 0
          const atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length
          const go = (rows: number, cols: number) => {
            event.preventDefault()
            commit()
            handlers.move(row, col, rows, cols)
          }
          const key = event.key.toLowerCase()
          const editing = draftRef.current !== null && draftRef.current !== value
          if ((event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y')) {
            // While typing, undo drops the typing; otherwise it is the list's own undo.
            event.preventDefault()
            if (editing) return edit(null)
            const { undo, redo } = useListEditorStoreBase.getState()
            if (key === 'z' && !event.shiftKey) undo()
            else redo()
          } else if (event.key === 'Escape' && editing) {
            // Puts the text back, not close the window.
            event.stopPropagation()
            edit(null)
          } else if (event.key === 'Enter') go(event.shiftKey ? -1 : 1, 0)
          else if (event.key === 'ArrowDown') go(1, 0)
          else if (event.key === 'ArrowUp') go(-1, 0)
          else if (event.key === 'ArrowLeft' && atStart) go(0, -1)
          else if (event.key === 'ArrowRight' && atEnd) go(0, 1)
        }}
        onPaste={(event) => {
          const matrix = parseClipboard(event.clipboardData.getData('text/plain'))
          if (!isBlock(matrix)) return
          event.preventDefault()
          edit(null)
          handlers.paste(row, col, matrix)
        }}
      />
    </div>
  )
})
