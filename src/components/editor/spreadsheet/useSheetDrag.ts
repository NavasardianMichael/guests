'use client'

import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback, useEffect, useRef } from 'react'

/** What is picked up: a guest's cell, or a table's column (by its header). */
export type DragSource = { kind: 'guest' | 'table'; id: string; label: string }

/** Where it would land: a guest at `index` of column `col`; a table before the table at `index`. */
export type DropTarget = { kind: 'guest'; col: number; index: number } | { kind: 'table'; index: number }

type Options = {
  gridRef: RefObject<HTMLDivElement | null>
  /** Guests per column and how many columns are tables (the "no table" column comes after them), as the drag starts. */
  measure: () => { counts: number[]; tables: number }
  onDrop: (source: DragSource, target: DropTarget) => void
}

/** A press that moves less than this is a click, not a drag. */
const THRESHOLD = 4
/** Near the grid's edge, the grid scrolls; faster the closer the pointer. */
const EDGE = 48
const MAX_SPEED = 18

const GHOST =
  'pointer-events-none fixed top-0 left-0 z-[2000] max-w-56 truncate rounded-md border border-accent bg-surface px-2 py-1 text-sm text-text shadow-lg'
const LINE = 'pointer-events-none absolute z-[4] rounded-full bg-accent'
const SOURCE = 'opacity-40'

const cellAt = (grid: HTMLElement, row: number, col: number): HTMLElement | null =>
  grid.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`)

const edgeSpeed = (pointer: number, start: number, end: number): number => {
  if (pointer < start + EDGE) return -MAX_SPEED * Math.min(1, (start + EDGE - pointer) / EDGE)
  if (pointer > end - EDGE) return MAX_SPEED * Math.min(1, (pointer - (end - EDGE)) / EDGE)
  return 0
}

/**
 * Dragging guests (up and down a column, or into another) and tables (across) in the
 * spreadsheet, without React: while the pointer moves, only a ghost and a drop line move, set
 * straight on the DOM once a frame, so a grid of thousands of cells never re-renders mid-drag.
 * The drop is one edit. The grid's cells carry `data-row` / `data-col` (the header row is -1);
 * the grid scrolls when the pointer nears its edge. Escape cancels.
 */
export const useSheetDrag = ({ gridRef, measure, onDrop }: Options) => {
  const options = useRef({ measure, onDrop })
  useEffect(() => {
    options.current = { measure, onDrop }
  })
  const stop = useRef<(() => void) | null>(null)
  useEffect(() => () => stop.current?.(), [])

  return useCallback(
    (event: ReactPointerEvent, source: DragSource) => {
      const grid = gridRef.current
      if (event.button !== 0 || !grid) return
      event.preventDefault()
      stop.current?.()

      const { counts, tables } = options.current.measure()
      const origin = event.currentTarget.closest<HTMLElement>('[data-col]')
      const startX = event.clientX
      const startY = event.clientY
      let pointer = { x: startX, y: startY }
      let started = false
      let target: DropTarget | null = null
      let frame = 0
      let ghost: HTMLDivElement | null = null
      let line: HTMLDivElement | null = null

      const findTarget = (): DropTarget | null => {
        const under = document.elementFromPoint(pointer.x, pointer.y)?.closest<HTMLElement>('[data-col]')
        if (!under || !grid.contains(under)) return null
        const col = Number(under.dataset.col)
        if (source.kind === 'table') {
          if (col >= tables) return { kind: 'table', index: tables }
          const rect = under.getBoundingClientRect()
          return { kind: 'table', index: col + (pointer.x > rect.left + rect.width / 2 ? 1 : 0) }
        }
        const row = Number(under.dataset.row)
        const count = counts[col] ?? 0
        if (row < 0) return { kind: 'guest', col, index: 0 }
        if (row >= count) return { kind: 'guest', col, index: count }
        const rect = under.getBoundingClientRect()
        return { kind: 'guest', col, index: row + (pointer.y > rect.top + rect.height / 2 ? 1 : 0) }
      }

      /** The drop line, in the grid's scrolled content (it scrolls with the cells). */
      const drawLine = () => {
        if (!line) return
        const box = grid.getBoundingClientRect()
        const place = (left: number, top: number, width: number, height: number) => {
          line!.style.transform = `translate(${left - box.left + grid.scrollLeft}px, ${top - box.top + grid.scrollTop}px)`
          line!.style.width = `${width}px`
          line!.style.height = `${height}px`
          line!.style.display = 'block'
        }
        if (!target) return void (line.style.display = 'none')
        if (target.kind === 'guest') {
          const cell = cellAt(grid, target.index, target.col)
          if (!cell) return void (line.style.display = 'none')
          const rect = cell.getBoundingClientRect()
          place(rect.left + 2, rect.top - 1.5, rect.width - 4, 3)
        } else {
          const atEnd = target.index >= tables
          const head = cellAt(grid, -1, atEnd ? tables - 1 : target.index)
          if (!head) return void (line.style.display = 'none')
          const rect = head.getBoundingClientRect()
          const table = grid.querySelector('table')
          place(atEnd ? rect.right - 1.5 : rect.left - 1.5, rect.top, 3, table?.offsetHeight ?? rect.height)
        }
      }

      const tick = () => {
        frame = 0
        if (!started) return
        const box = grid.getBoundingClientRect()
        const dx = edgeSpeed(pointer.x, box.left, box.right)
        const dy = edgeSpeed(pointer.y, box.top, box.bottom)
        if (dx || dy) grid.scrollBy(dx, dy)
        if (ghost) ghost.style.transform = `translate(${pointer.x + 12}px, ${pointer.y + 8}px)`
        target = findTarget()
        drawLine()
        // Keep scrolling while the pointer rests at the edge.
        if (dx || dy) frame = requestAnimationFrame(tick)
      }
      const schedule = () => {
        if (!frame) frame = requestAnimationFrame(tick)
      }

      const begin = () => {
        started = true
        ghost = document.createElement('div')
        ghost.className = GHOST
        ghost.textContent = source.label || '…'
        document.body.append(ghost)
        line = document.createElement('div')
        line.className = LINE
        line.style.display = 'none'
        line.style.top = '0'
        line.style.left = '0'
        // In the scrolling grid itself (positioned), so the line scrolls with the cells.
        grid.append(line)
        origin?.classList.add(SOURCE)
        document.body.style.cursor = 'grabbing'
        document.body.style.userSelect = 'none'
        ;(document.activeElement as HTMLElement | null)?.blur()
      }

      const onMove = (move: PointerEvent) => {
        pointer = { x: move.clientX, y: move.clientY }
        if (!started && Math.hypot(pointer.x - startX, pointer.y - startY) < THRESHOLD) return
        if (!started) begin()
        schedule()
      }

      const end = (drop: boolean) => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onCancel)
        window.removeEventListener('keydown', onKey, true)
        if (frame) cancelAnimationFrame(frame)
        ghost?.remove()
        line?.remove()
        origin?.classList.remove(SOURCE)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        stop.current = null
        if (drop && started) {
          const landing = findTarget()
          if (landing) options.current.onDrop(source, landing)
        }
      }
      const onUp = (up: PointerEvent) => {
        pointer = { x: up.clientX, y: up.clientY }
        end(true)
      }
      const onCancel = () => end(false)
      const onKey = (key: KeyboardEvent) => {
        if (key.key !== 'Escape') return
        // Cancels the drag, not the window around it.
        key.stopPropagation()
        key.preventDefault()
        end(false)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onCancel)
      window.addEventListener('keydown', onKey, true)
      stop.current = () => end(false)
    },
    [gridRef]
  )
}
