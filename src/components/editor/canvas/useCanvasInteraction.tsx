'use client'

import { type PointerEvent as ReactPointerEvent, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { produce } from 'immer'
import { MIN_BLOCK_SIZE, moveBefore, useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import { FOOTER_ID, HEADER_ID, type ListDocument, type Position, type Size } from '@store/lists/single/types'
import { measureText } from '@helpers/measureText'
import { clampToPage, compareNames, layoutSheet, round, type SheetBlock, type SheetLayout } from '@helpers/sheetLayout'
import { type EditTarget, type SheetInteraction, targetBlockId } from '@components/sheet/SheetInteraction'
import { MM_TO_PX } from '@components/sheet/SheetPreview'
import { InlineEditor } from './InlineEditor'

/** The space between stacked pages on the canvas, mm. */
export const PAGE_GAP_MM = 12
/** How close an edge must come to another to snap to it, mm. */
const SNAP_MM = 1.6
/** A press that moves less than this is a click, px. */
const DRAG_THRESHOLD_PX = 4
/** How blocks glide into place once dropped (the in-drag shuffle is in `sheet.css`). */
const SETTLE_MS = 200
const SETTLE = `translate ${SETTLE_MS}ms cubic-bezier(0.2, 0, 0, 1)`

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
  /** Grid mode: the block whose place the dragged one would take; null, its own place. */
  target: string | null
}

type NameDrag = { type: 'name'; guestId: string; element: HTMLElement; startX: number; startY: number; moved: boolean }

type MarqueeDrag = { type: 'marquee'; additive: boolean }

/** A block resized from its corner: the latest size asked for, applied once a frame. */
type ResizeDrag = { type: 'resize'; block: SheetBlock; startX: number; startY: number; next: Size | null; frame: number }

type Drag = BlockDrag | NameDrag | MarqueeDrag | ResizeDrag

/** One place card's face, mm, as the API coerces it (`cardWidth` / `cardHeight`). */
const CARD_LIMITS = { minW: 30, maxW: 300, minH: 20, maxH: 300 }

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), Math.max(min, max))

const isFreeBlock = (block: SheetBlock): boolean => block.id === HEADER_ID || block.id === FOOTER_ID

/** Where `id` goes so that it takes `target`'s place: after it when moving forward, before it when back. */
const beforeFor = (items: { id: string }[], id: string, target: string): string | null => {
  const from = items.findIndex((item) => item.id === id)
  const to = items.findIndex((item) => item.id === target)
  return from < to ? (items[to + 1]?.id ?? null) : target
}

/** The document as a grid drop of `primary` on `target` would leave it — what `onFinish` commits. */
const reordered = (doc: ListDocument, primary: SheetBlock, target: string): ListDocument =>
  produce(doc, (draft) => {
    if (primary.type === 'table') {
      moveBefore(draft.content.tables, primary.id, beforeFor(draft.content.tables, primary.id, target))
      return
    }
    const { layout } = draft.design
    if (layout.sort !== 'manual') {
      const sign = layout.sort === 'za' ? -1 : 1
      draft.content.guests.sort((a, b) => compareNames(a.name, b.name) * sign)
      layout.sort = 'manual'
    }
    moveBefore(draft.content.guests, primary.id, beforeFor(draft.content.guests, primary.id, target))
  })

/** A block or a table's name, as one element across a re-render (a header repeats per page). */
const flipKey = (element: HTMLElement): string => {
  const { guestId, blockId, blockType } = element.dataset
  if (guestId) return `name:${guestId}`
  if (blockType === 'header' || blockType === 'footer')
    return `${blockId}@${element.closest<HTMLElement>('section[data-page]')?.dataset.page}`
  return blockId ?? ''
}

const sameGuides = (a: Guide[], b: Guide[]): boolean =>
  a.length === b.length && a.every((guide, i) => guide.page === b[i].page && guide.axis === b[i].axis && guide.at === b[i].at)

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
 * once, on release, as one undo step; then everything that moved glides from where it was
 * shown to where the new layout put it.
 *
 * - **Grid mode:** a block dropped on another takes its place (the order of guests or tables).
 *   While dragging, the others already slide to where the drop would leave them (the layout
 *   is recomputed once per change of target, not per frame).
 * - **Free mode:** blocks go where they are dropped, on any page, snapping to the edges and
 *   centres of the blocks around them (Alt turns snapping off). A selection moves together.
 * - **A name inside a table** is dragged on its own: dropped on another table, or on a name
 *   at one, the guest moves there.
 * - **The corner handle** resizes a block: its width (the text re-wraps) and a least height. In
 *   a grid it stays within its column; place cards all take the new card size.
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
  /** The last press on a block or a name: what it was, whether it was already selected, whether it moved. */
  const pressRef = useRef<{ id: string; wasSelected: boolean; moved: boolean } | null>(null)
  /** Where a click opened the text being edited (a character offset). */
  const caretRef = useRef<number | undefined>(undefined)
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

  /** The dragged element, under the pointer and above the rest. */
  const lift = (element: HTMLElement, dx: number, dy: number) => {
    element.style.translate = `${dx}mm ${dy}mm`
    element.style.zIndex = '20'
    element.classList.add('sh-dragging')
  }

  /**
   * Grid mode: the block of the dragged one's kind nearest the pointer, on the page under it.
   * Measured on the layout as it was when the drag began, not on the sliding elements, so a
   * block making room never moves out from under the pointer and back.
   */
  const sortTarget = (drag: BlockDrag, clientX: number, clientY: number): string | null => {
    const at = pageAt(clientX, clientY)
    if (!at) return drag.target
    let best: { id: string; distance: number } | null = null
    for (const block of layoutRef.current.blocks) {
      if (block.page !== at.page || block.type !== drag.primary.type) continue
      const inside = at.x >= block.x && at.x <= block.x + block.w && at.y >= block.y && at.y <= block.y + block.h
      const distance = inside ? 0 : Math.hypot(at.x - (block.x + block.w / 2), at.y - (block.y + block.h / 2))
      if (!best || distance < best.distance) best = { id: block.id, distance }
    }
    return !best || best.id === drag.primary.id ? null : best.id
  }

  /** Slides every other block of the dragged one's kind to where dropping it now would leave them. */
  const shuffle = (drag: BlockDrag) => {
    const root = sheetRef.current
    const doc = useListEditorStoreBase.getState().doc
    if (!root || !doc) return
    root.dataset.sorting = ''
    const sheet = layoutRef.current
    const preview = drag.target ? blockIndex(layoutSheet(reordered(doc, drag.primary, drag.target), measureText)) : null
    const stride = sheet.height + PAGE_GAP_MM
    const elements = new Map<string, HTMLElement[]>()
    for (const element of root.querySelectorAll<HTMLElement>('[data-block-id]')) {
      const id = element.dataset.blockId ?? ''
      elements.set(id, [...(elements.get(id) ?? []), element])
    }
    for (const block of blockIndex(sheet).values()) {
      if (block.id === drag.primary.id || block.type !== drag.primary.type) continue
      const to = preview?.get(block.id)
      const dx = to ? to.x - block.x : 0
      const dy = to ? to.y - block.y + (to.page - block.page) * stride : 0
      const value = Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01 ? '' : `${dx}mm ${dy}mm`
      for (const element of elements.get(block.id) ?? []) element.style.translate = value
    }
  }

  /** Where every block and table name is on screen, before a drop re-renders them. */
  const capture = (): Map<string, DOMRect> => {
    const rects = new Map<string, DOMRect>()
    for (const element of sheetRef.current?.querySelectorAll<HTMLElement>('[data-block-id], [data-guest-id]') ?? [])
      rects.set(flipKey(element), element.getBoundingClientRect())
    return rects
  }

  /**
   * Once the store has re-rendered (synchronously, through `flushSync`): drops every drag-time
   * translate, then moves each element back to where `before` saw it and lets it glide to its
   * new place. Reads and writes are batched — one reflow for the blocks, one for the names
   * (measured inside their already-offset tables).
   */
  const settle = (before: Map<string, DOMRect>) => {
    const root = sheetRef.current
    if (!root) return
    delete root.dataset.sorting
    const k = pxPerMm()
    const blocks = [...root.querySelectorAll<HTMLElement>('[data-block-id]')]
    const names = [...root.querySelectorAll<HTMLElement>('[data-guest-id]')]
    const all = [...blocks, ...names]
    const lifted = all.filter((element) => element.classList.contains('sh-dragging'))
    for (const element of all) {
      element.style.transition = 'none'
      element.style.translate = ''
      element.classList.remove('sh-dragging')
      if (!lifted.includes(element)) element.style.zIndex = ''
    }
    const moving: HTMLElement[] = []
    const offset = (elements: HTMLElement[]) => {
      const deltas = elements.map((element) => {
        const was = before.get(flipKey(element))
        if (!was) return null
        const now = element.getBoundingClientRect()
        return { dx: (was.left - now.left) / k, dy: (was.top - now.top) / k }
      })
      elements.forEach((element, i) => {
        const delta = deltas[i]
        if (!delta || (Math.abs(delta.dx) < 0.05 && Math.abs(delta.dy) < 0.05)) return
        element.style.translate = `${delta.dx}mm ${delta.dy}mm`
        moving.push(element)
      })
    }
    offset(blocks)
    offset(names)
    // The start positions are laid out before the transition is switched on.
    void root.offsetWidth
    for (const element of all) element.style.transition = moving.includes(element) ? SETTLE : ''
    for (const element of moving) element.style.translate = ''
    window.setTimeout(() => {
      for (const element of moving) element.style.transition = ''
      for (const element of lifted) element.style.zIndex = ''
    }, SETTLE_MS + 50)
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

  /** The size the pointer asks for, kept on the page (and in its column, in a grid). */
  const resized = (drag: ResizeDrag, clientX: number, clientY: number): Size => {
    const k = pxPerMm()
    const sheet = layoutRef.current
    const { block } = drag
    const w = block.w + (clientX - drag.startX) / k
    const h = block.h + (clientY - drag.startY) / k
    if (block.type === 'card') return { w: clamp(w, CARD_LIMITS.minW, Math.min(CARD_LIMITS.maxW, sheet.area.w)), h }
    const maxW =
      modeRef.current === 'free' ? sheet.width - block.x : isFreeBlock(block) ? sheet.area.w : sheet.column
    return {
      w: clamp(w, MIN_BLOCK_SIZE.w, maxW),
      h: clamp(h, MIN_BLOCK_SIZE.h, sheet.height - block.y),
    }
  }

  const applySize = (drag: ResizeDrag) => {
    const size = drag.next
    const store = useListEditorStoreBase.getState()
    if (!size || !store.doc) return
    if (drag.block.type === 'card') {
      // Cards are cut from one sheet: they share a size. A tent card's block is two faces.
      const faces = store.doc.design.layout.cardFold ? 2 : 1
      const cardHeight = clamp(size.h / faces, CARD_LIMITS.minH, CARD_LIMITS.maxH)
      store.setLayout({ cardWidth: round(size.w, 0.5), cardHeight: round(cardHeight, 0.5) })
      return
    }
    store.setSize(drag.block.id, { w: round(size.w), h: round(size.h) })
  }

  const onMove = (event: PointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    if (drag.type === 'resize') {
      drag.next = resized(drag, event.clientX, event.clientY)
      // The sheet re-lays out on a size change: at most once a frame, however fast the pointer.
      if (!drag.frame)
        drag.frame = requestAnimationFrame(() => {
          drag.frame = 0
          applySize(drag)
        })
      return
    }
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
    if (pressRef.current) pressRef.current.moved = true
    const k = pxPerMm()
    const dx = (event.clientX - drag.startX) / k
    const dy = (event.clientY - drag.startY) / k

    if (drag.type === 'name') {
      lift(drag.element, dx, dy)
      const under = document.elementsFromPoint(event.clientX, event.clientY)
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
      for (const element of elementsOf(drag.ids)) lift(element, drag.result.dx, visualDy)
      // Only when they change: a new array every frame would re-render the canvas every frame.
      setGuides((current) => (sameGuides(current, placed.guides) ? current : placed.guides))
      return
    }

    for (const element of elementsOf([drag.primary.id])) lift(element, dx, dy)
    const target = sortTarget(drag, event.clientX, event.clientY)
    if (target === drag.target) return
    drag.target = target
    shuffle(drag)
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

    if (drag.type === 'resize') {
      cancelAnimationFrame(drag.frame)
      if (!cancelled) applySize(drag)
      document.documentElement.style.cursor = ''
      for (const element of elementsOf([drag.block.id])) delete element.dataset.resizing
      return
    }

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

    const before = capture()

    if (drag.type === 'name') {
      flushSync(() => {
        if (!drag.moved || cancelled || !target) return
        const targetGuest = doc.content.guests.find((guest) => guest.id === target)
        if (targetGuest) store.seatGuest(drag.guestId, targetGuest.tableId, targetGuest.id)
        else if (doc.content.tables.some((table) => table.id === target)) store.seatGuest(drag.guestId, target, null)
      })
      settle(before)
      return
    }

    if (!drag.moved || cancelled) {
      settle(before)
      return
    }

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
      flushSync(() => store.setPositions(positions))
      settle(before)
      return
    }

    const sortTo = drag.target
    flushSync(() => {
      if (!sortTo) return
      if (drag.primary.type === 'table') {
        store.moveTable(drag.primary.id, beforeFor(doc.content.tables, drag.primary.id, sortTo))
        return
      }
      // A guest or a card: the printed order is the list's own once it is manual.
      if (doc.design.layout.sort !== 'manual') store.sortGuests(doc.design.layout.sort)
      const guests = useListEditorStoreBase.getState().doc?.content.guests ?? []
      store.moveGuest(drag.primary.id, beforeFor(guests, drag.primary.id, sortTo))
    })
    settle(before)
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
    pressRef.current = { id: block.id, wasSelected: store.selection.includes(block.id), moved: false }
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
      target: null,
    }
    startListening()
  }

  const onResizePointerDown = (event: ReactPointerEvent, block: SheetBlock) => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.preventDefault()
    const store = useListEditorStoreBase.getState()
    if (store.selection.length !== 1 || store.selection[0] !== block.id) store.select([block.id])
    // Never a click: the text under the corner must not open for typing.
    pressRef.current = { id: block.id, wasSelected: false, moved: true }
    dragRef.current = { type: 'resize', block, startX: event.clientX, startY: event.clientY, next: null, frame: 0 }
    // A data attribute, not a class: React rewrites `className` when the selection re-renders.
    for (const element of elementsOf([block.id])) element.dataset.resizing = ''
    document.documentElement.style.cursor = 'nwse-resize'
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
    pressRef.current = { id: guestId, wasSelected: store.selection.includes(guestId), moved: false }
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
      onResizePointerDown,
      onEdit: (target, caret) => {
        caretRef.current = caret
        setEditing(target)
      },
      clickOpensEditor: (target) => {
        const press = pressRef.current
        return Boolean(press && press.id === targetBlockId(target) && press.wasSelected && !press.moved)
      },
      renderEditor: (target) => <InlineEditor target={target} caret={caretRef.current} onDone={() => setEditing(null)} />,
    }),
    // The handlers read everything else through refs and the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selection, dropTarget, editing]
  )

  /** Opens a text from outside the sheet (the toolbar): the caret at its end. */
  const openEditor = useCallback((target: EditTarget | null) => {
    caretRef.current = undefined
    setEditing(target)
  }, [])

  return { interaction, guides, marquee, editing, setEditing: openEditor, onBackgroundPointerDown }
}
