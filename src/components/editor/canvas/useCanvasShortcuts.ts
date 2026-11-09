'use client'

import { useEffect, useRef } from 'react'
import { useListEditorStoreBase } from '@store/lists/single/store'
import type { Position } from '@store/lists/single/types'
import { clampToPage, round, type SheetBlock, type SheetLayout } from '@helpers/sheetLayout'

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select, [role="combobox"]'))

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

/**
 * The editor's keys, outside text fields (there the browser's own undo and caret keys run):
 * Ctrl/Cmd+Z / Y undo and redo; Delete removes the selected guests, tables and hall items; arrows
 * nudge the selection 1mm (Shift: 5mm) in free mode and on the hall plan; Escape clears it; Ctrl/Cmd+A selects every block.
 */
export const useCanvasShortcuts = ({ layout, enabled }: { layout: SheetLayout; enabled: boolean }): void => {
  const layoutRef = useRef(layout)
  useEffect(() => {
    layoutRef.current = layout
  })

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return
      const store = useListEditorStoreBase.getState()
      const doc = store.doc
      if (!doc) return
      const key = event.key.toLowerCase()
      const mod = event.ctrlKey || event.metaKey

      if (mod && key === 'z' && !event.shiftKey) {
        event.preventDefault()
        store.undo()
      } else if (mod && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault()
        store.redo()
      } else if (mod && key === 'a') {
        event.preventDefault()
        store.select([...new Set(layoutRef.current.blocks.map((block) => block.id))])
      } else if (event.key === 'Escape') {
        store.select([])
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && store.selection.length) {
        event.preventDefault()
        const guests = store.selection.filter((id) => doc.content.guests.some((guest) => guest.id === id))
        const tables = store.selection.filter((id) => doc.content.tables.some((table) => table.id === id))
        const items = store.selection.filter((id) => doc.content.venue.some((item) => item.id === id))
        if (guests.length) store.removeGuests(guests)
        for (const id of tables) store.removeTable(id)
        if (items.length) store.removeVenueItems(items)
        store.select([])
      } else if (ARROWS[event.key] && store.selection.length && (doc.design.kind === 'plan' || doc.design.layout.mode === 'free')) {
        event.preventDefault()
        const [dx, dy] = ARROWS[event.key]
        const step = event.shiftKey ? 5 : 1
        const blocks = new Map<string, SheetBlock>()
        for (const block of layoutRef.current.blocks) if (!blocks.has(block.id)) blocks.set(block.id, block)
        const positions: Record<string, Position> = {}
        for (const id of store.selection) {
          const block = blocks.get(id)
          if (!block) continue
          const next = clampToPage({ page: block.page, x: block.x + dx * step, y: block.y + dy * step }, block, layoutRef.current)
          positions[id] = { page: next.page, x: round(next.x), y: round(next.y) }
        }
        if (Object.keys(positions).length) store.setPositions(positions)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
