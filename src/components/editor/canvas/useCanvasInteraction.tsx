'use client'

import { type PointerEvent as ReactPointerEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import { FOOTER_ID, HEADER_ID, type Position } from '@store/lists/single/types'
import { clampToPage, round, type SheetBlock, type SheetLayout } from '@helpers/sheetLayout'
import type { EditTarget, SheetInteraction } from '@components/sheet/SheetInteraction'
import { MM_TO_PX } from '@components/sheet/SheetPreview'
import { InlineEditor } from './InlineEditor'

/** The space between stacked pages on the canvas, mm. */
export const PAGE_GAP_MM = 12
/** How close an edge must come to another to snap to it, mm. */
const SNAP_MM = 1.6
/** A press that moves less than this is a click, px. */
const DRAG_THRESHOLD_PX = 4

export type Guide = { page: number; axis: 'x' | 'y'; at: number }
export type Marquee = { page: number; x0: number; y0: number; x1: number; y1: number }

type BlockDrag = {
  type: 'block'
  primary: SheetBlock
  ids: string[]
  startX: number
  startY: number
  /** Where in the primary block it was grabbed, mm. */
  grabX: number
  grabY: number
  moved: boolean
  /** Free placement (free mode, or a header/footer in any mode) rather than reordering. */
  free: boolean
  result: { dx: number; dy: number; dpage: number }
}

type NameDrag = { type: 'name'; guestId: string; element: HTMLElement; startX: number; startY: number; moved: boolean }

type MarqueeDrag = { type: 'marquee'; additive: boolean }

type Drag = BlockDrag | NameDrag | MarqueeDrag

const isFreeBlock = (block: SheetBlock): boolean => block.id === HEADER_ID || block.id === FOOTER_ID

/** First instance of each block (a header repeated on every page counts once). */
const blockIndex = (layout: SheetLayout): Map<string, SheetBlock> => {
  const index = new Map<string, SheetBlock>()
  for (const block of layout.blocks) if (!index.has(block.id)) index.set(block.id, block)
  return index
}

type Options = {
  layout: SheetLayout
  scale: number
  /** The element holding the stacked pages. */
  sheetRef: RefObject<HTMLDivElement | null>
}

/**
 * Everything the pointer does on the sheet. Dragging moves the real elements with a CSS
 * `translate` while the pointer is down — no re-layout per frame — and commits to the store
 * once, on release, as one undo step.
 *
 * - **Grid mode:** a block dropped on another takes its place (the order of guests or tables).
 * - **Free mode:** blocks go where they are dropped, on any page, snapping to the edges and
 *   centres of the blocks around them (Alt turns snapping off). A selection moves together.
 * - **A name inside a table** is dragged on its own: dropped on another table, or on a name
 *   at one, the guest moves there.
 * - **Empty paper:** a drag draws a selection rectangle; Shift/Ctrl+click adds to a selection.
 */
export const useCanvasInteraction = ({ layout, scale, sheetRef }: Options) => {
  const selection = useListEditorStore.use.selection()
  const mode = useListEditorStoreBase((state) => state.doc?.design.layout.mode ?? 'grid')
  const [editing, setEditing] = useState<EditTarget | null>(null)
  const [dropTarget, setDropTargetState] = useState<string | null>(null)
  const [guides, setGuides] = useState<Guide[]>([])
  const [marquee, setMarqueeState] = useState<Marquee | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const dropRef = useRef<string | null>(null)
  const marqueeRef = useRef<Marquee | null>(null)
  const layoutRef = useRef(layout)
  const scaleRef = useRef(scale)
  const modeRef = useRef(mode)
  useEffect(() => {
    layoutRef.current = layout
    scaleRef.current = scale
    modeRef.current = mode
  })

  const setDropTarget = (id: string | null) => {
    dropRef.current = id
    setDropTargetState(id)
  }
  const setMarquee = (next: Marquee | null) => {
    marqueeRef.current = next
    setMarqueeState(next)
  }

  const pxPerMm = (): number => scaleRef.current * MM_TO_PX

  /** The page under a point (the nearest one, between pages), and the point in its mm. */
  const pageAt = (clientX: number, clientY: number): { page: number; x: number; y: number } | null => {
    const sections = sheetRef.current?.querySelectorAll<HTMLElement>('section[data-page]')
    if (!sections?.length) return null
    let best: { page: number; rect: DOMRect; distance: number } | null = null
    for (const section of sections) {
      const rect = section.getBoundingClientRect()
      const distance = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0
      if (!best || distance < best.distance) best = { page: Number(section.dataset.page), rect, distance }
    }
    if (!best) return null
    const k = pxPerMm()
    return { page: best.page, x: (clientX - best.rect.left) / k, y: (clientY - best.rect.top) / k }
  }

  const elementsOf = (ids: string[]): HTMLElement[] => {
    const root = sheetRef.current
    if (!root) return []
    return ids.flatMap((id) => Array.from(root.querySelectorAll<HTMLElement>(`[data-block-id="${CSS.escape(id)}"]`)))
  }

  /** After the store's re-render has placed the blocks, before the next paint. */
  const clearTransforms = (elements: HTMLElement[]) => {
    requestAnimationFrame(() => {
      for (const element of elements) {
        element.style.translate = ''
        element.style.zIndex = ''
      }
    })
  }

  /** Free placement with snapping: the primary block's new corner and the guides it met. */
  const place = (drag: BlockDrag, clientX: number, clientY: number, snap: boolean) => {
    const at = pageAt(clientX, clientY)
    if (!at) return null
    const sheet = layoutRef.current
    const { primary } = drag
    let x = at.x - drag.grabX
    let y = at.y - drag.grabY
    const found: Guide[] = []
    if (snap) {
      const others = sheet.blocks.filter((block) => block.page === at.page && !drag.ids.includes(block.id))
      const xs = [sheet.width / 2, sheet.area.x, sheet.area.x + sheet.area.w, ...others.flatMap((b) => [b.x, b.x + b.w / 2, b.x + b.w])]
      const ys = [sheet.area.y, sheet.area.y + sheet.area.h, ...others.flatMap((b) => [b.y, b.y + b.h / 2, b.y + b.h])]
      const snapAxis = (start: number, size: number, candidates: number[], axis: 'x' | 'y'): number => {
        let best: { delta: number; at: number } | null = null
        for (const edge of [start, start + size / 2, start + size]) {
          for (const candidate of candidates) {
            const delta = candidate - edge
            if (Math.abs(delta) <= SNAP_MM && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, at: candidate }
          }
        }
        if (!best) return start
        found.push({ page: at.page, axis, at: best.at })
        return start + best.delta
      }
      x = snapAxis(x, primary.w, xs, 'x')
      y = snapAxis(y, primary.h, ys, 'y')
    }
    return { position: clampToPage({ page: at.page, x, y }, primary, sheet), guides: found }
  }

  const onMove = (event: PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    if (drag.type === 'marquee') {
      const current = marqueeRef.current
      const at = pageAt(event.clientX, event.clientY)
      if (!current || !at) return
      // Kept to the page it started on.
      const sheet = layoutRef.current
      const x1 = at.page === current.page ? at.x : at.page > current.page ? sheet.width : 0
      const y1 = at.page === current.page ? at.y : at.page > current.page ? sheet.height : 0
      setMarquee({ ...current, x1, y1 })
      return
    }
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD_PX) return
    drag.moved = true
    const k = pxPerMm()
    const dx = (event.clientX - drag.startX) / k
    const dy = (event.clientY - drag.startY) / k
    const under = document.elementsFromPoint(event.clientX, event.clientY)

    if (drag.type === 'name') {
      drag.element.style.translate = `${dx}mm ${dy}mm`
      drag.element.style.zIndex = '20'
      let target: string | null = null
      for (const element of under) {
        const name = element.closest<HTMLElement>('[data-guest-id]')
        if (name && name !== drag.element) {
          target = name.dataset.guestId ?? null
          break
        }
        const table = element.closest<HTMLElement>('[data-block-type="table"]')
        if (table) {
          target = table.dataset.blockId ?? null
          break
        }
      }
      setDropTarget(target)
      return
    }

    if (drag.free) {
      const placed = place(drag, event.clientX, event.clientY, !event.altKey)
      if (!placed) return
      const sheet = layoutRef.current
      drag.result = {
        dx: placed.position.x - drag.primary.x,
        dy: placed.position.y - drag.primary.y,
        dpage: placed.position.page - drag.primary.page,
      }
      const visualDy = drag.result.dy + drag.result.dpage * (sheet.height + PAGE_GAP_MM)
      for (const element of elementsOf(drag.ids)) {
        element.style.translate = `${drag.result.dx}mm ${visualDy}mm`
        element.style.zIndex = '20'
      }
      setGuides(placed.guides)
      return
    }

    for (const element of elementsOf([drag.primary.id])) {
      element.style.translate = `${dx}mm ${dy}mm`
      element.style.zIndex = '20'
    }
    let target: string | null = null
    for (const element of under) {
      const block = element.closest<HTMLElement>('[data-block-id]')
      if (block && block.dataset.blockId !== drag.primary.id && block.dataset.blockType === drag.primary.type) {
        target = block.dataset.blockId ?? null
        break
      }
    }
    setDropTarget(target)
  }

  const onFinish = (event: PointerEvent) => {
    const drag = dragRef.current
    dragRef.current = null
    const target = dropRef.current
    setDropTarget(null)
    setGuides([])
    const store = useListEditorStoreBase.getState()
    const doc = store.doc
    const cancelled = event.type === 'pointercancel'
    if (!drag || !doc) return

    if (drag.type === 'marquee') {
      const box = marqueeRef.current
      setMarquee(null)
      if (!box || cancelled) return
      const left = Math.min(box.x0, box.x1)
      const right = Math.max(box.x0, box.x1)
      const top = Math.min(box.y0, box.y1)
      const bottom = Math.max(box.y0, box.y1)
      // A click on empty paper (no rectangle drawn) clears the selection.
      if (right - left < 0.5 && bottom - top < 0.5) {
        if (!drag.additive) store.select([])
        return
      }
      const hit = layoutRef.current.blocks
        .filter((b) => b.page === box.page && b.x < right && b.x + b.w > left && b.y < bottom && b.y + b.h > top)
        .map((b) => b.id)
      store.select([...new Set(drag.additive ? [...store.selection, ...hit] : hit)])
      return
    }

    if (drag.type === 'name') {
      clearTransforms([drag.element])
      if (!drag.moved || cancelled || !target) return
      const targetGuest = doc.content.guests.find((guest) => guest.id === target)
      if (targetGuest) store.seatGuest(drag.guestId, targetGuest.tableId, targetGuest.id)
      else if (doc.content.tables.some((table) => table.id === target)) store.seatGuest(drag.guestId, target, null)
      return
    }

    clearTransforms(elementsOf(drag.ids))
    if (!drag.moved || cancelled) return

    if (drag.free) {
      const index = blockIndex(layoutRef.current)
      const positions: Record<string, Position> = {}
      for (const id of drag.ids) {
        const block = index.get(id)
        if (!block) continue
        const next = clampToPage(
          { page: block.page + drag.result.dpage, x: block.x + drag.result.dx, y: block.y + drag.result.dy },
          block,
          layoutRef.current
        )
        positions[id] = { page: next.page, x: round(next.x), y: round(next.y) }
      }
      store.setPositions(positions)
      return
    }

    if (!target) return
    if (drag.primary.type === 'table') {
      const tables = doc.content.tables
      const from = tables.findIndex((table) => table.id === drag.primary.id)
      const to = tables.findIndex((table) => table.id === target)
      store.moveTable(drag.primary.id, from < to ? (tables[to + 1]?.id ?? null) : target)
      return
    }
    // A guest or a card: the printed order is the list's own once it is manual.
    if (doc.design.layout.sort !== 'manual') store.sortGuests(doc.design.layout.sort)
    const guests = useListEditorStoreBase.getState().doc?.content.guests ?? []
    const from = guests.findIndex((guest) => guest.id === drag.primary.id)
    const to = guests.findIndex((guest) => guest.id === target)
    store.moveGuest(drag.primary.id, from < to ? (guests[to + 1]?.id ?? null) : target)
  }

  // Window listeners are attached once per drag; they call the latest handlers through refs.
  const moveRef = useRef(onMove)
  const finishRef = useRef(onFinish)
  useEffect(() => {
    moveRef.current = onMove
    finishRef.current = onFinish
  })
  /** Detaches the current drag's listeners, if a drag is under way. */
  const stopRef = useRef<(() => void) | null>(null)
  const startListening = () => {
    stopRef.current?.()
    const controller = new AbortController()
    const { signal } = controller
    const finish = (event: PointerEvent) => {
      controller.abort()
      stopRef.current = null
      finishRef.current(event)
    }
    window.addEventListener('pointermove', (event) => moveRef.current(event), { signal })
    window.addEventListener('pointerup', finish, { signal })
    window.addEventListener('pointercancel', finish, { signal })
    stopRef.current = () => controller.abort()
  }
  // Unmounting mid-drag leaves no listeners behind.
  useEffect(() => () => stopRef.current?.(), [])

  const onBlockPointerDown = (event: ReactPointerEvent, block: SheetBlock) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('input')) return
    event.stopPropagation()
    const store = useListEditorStoreBase.getState()
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      store.toggleSelect(block.id)
      return
    }
    const ids = store.selection.includes(block.id) ? store.selection : [block.id]
    if (!store.selection.includes(block.id)) store.select([block.id])
    const index = blockIndex(layoutRef.current)
    const at = pageAt(event.clientX, event.clientY)
    dragRef.current = {
      type: 'block',
      primary: block,
      ids: ids.filter((id) => index.has(id)),
      startX: event.clientX,
      startY: event.clientY,
      grabX: at ? at.x - block.x : 0,
      grabY: at ? at.y - block.y : 0,
      moved: false,
      free: modeRef.current === 'free' || isFreeBlock(block),
      result: { dx: 0, dy: 0, dpage: 0 },
    }
    startListening()
  }

  const onNamePointerDown = (event: ReactPointerEvent, guestId: string) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('input')) return
    event.stopPropagation()
    const store = useListEditorStoreBase.getState()
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      store.toggleSelect(guestId)
      return
    }
    store.select([guestId])
    dragRef.current = {
      type: 'name',
      guestId,
      element: event.currentTarget as HTMLElement,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    }
    startListening()
  }

  /** Around the blocks: empty paper starts a selection rectangle, the desk clears the selection. */
  const onBackgroundPointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('[data-block-id], input, button, [data-canvas-ui]')) return
    const store = useListEditorStoreBase.getState()
    const at = target.closest('section[data-page]') ? pageAt(event.clientX, event.clientY) : null
    if (!at) {
      store.select([])
      return
    }
    dragRef.current = { type: 'marquee', additive: event.shiftKey || event.ctrlKey || event.metaKey }
    setMarquee({ page: at.page, x0: at.x, y0: at.y, x1: at.x, y1: at.y })
    startListening()
  }

  const interaction = useMemo<SheetInteraction>(
    () => ({
      selection: new Set(selection),
      dropTarget,
      editing,
      onBlockPointerDown,
      onNamePointerDown,
      onEdit: setEditing,
      renderEditor: (target) => <InlineEditor target={target} onDone={() => setEditing(null)} />,
    }),
    // The handlers read everything else through refs and the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selection, dropTarget, editing]
  )

  return { interaction, guides, marquee, editing, setEditing, onBackgroundPointerDown }
}
