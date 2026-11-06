import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  canPanAt,
  clampView,
  fitView,
  type Pad,
  type Point,
  scaleLimits,
  type Size,
  type View,
  zoomAt,
} from '@helpers/previewView'

/**
 * Zoom and pan for content shown whole in a frame (the print preview): the wheel zooms at the
 * cursor, a drag pans, two fingers pinch, and the buttons step or go back to the fit.
 *
 * As regionify's map viewer: the view lives in a ref and reaches the DOM as one `transform`
 * per animation frame, so a gesture never re-renders React; the buttons' state is synced once
 * the gesture settles. Pointer events cover mouse, pen and touch alike.
 */

const BUTTON_FACTOR = 1.25
/** Per pixel of wheel travel; a trackpad pinch (a wheel event with `ctrlKey`) sends small deltas. */
const WHEEL_SENSITIVITY = 0.0015
const PINCH_WHEEL_SENSITIVITY = 0.01
const EASE_MS = 180
/** After the last wheel tick or pointer, sync the buttons and drop `will-change`. */
const SETTLE_MS = 140
const EPSILON = 1e-3

type Gesture =
  { kind: 'pan'; start: Point; view: View } | { kind: 'pinch'; distance: number; mid: Point; view: View } | null

type Status = { canZoomIn: boolean; canZoomOut: boolean; fitted: boolean; canPan: boolean }

type Params = {
  frameRef: RefObject<HTMLDivElement | null>
  contentRef: RefObject<HTMLDivElement | null>
  /** The frame's size, px (`useElementSize`); zero until measured. */
  frame: Size
  /** The content's true size, px. */
  content: Size
  /** Kept clear around the content, px. */
  pad: Pad
}

type Result = Status & {
  zoomIn: () => void
  zoomOut: () => void
  fit: () => void
}

/** An element's client size, measured before the first paint and on every resize. */
export const useElementSize = (ref: RefObject<HTMLElement | null>): Size => {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => {
      const width = element.clientWidth
      const height = element.clientHeight
      setSize((previous) => (previous.width === width && previous.height === height ? previous : { width, height }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return size
}

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y)
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export const useZoomPan = ({ frameRef, contentRef, frame, content, pad }: Params): Result => {
  const [status, setStatus] = useState<Status>({ canZoomIn: false, canZoomOut: false, fitted: true, canPan: false })

  const viewRef = useRef<View>({ scale: 1, x: 0, y: 0 })
  /** At the fit: a resize or a content change re-fits rather than keeping the zoom. */
  const fittedRef = useRef(true)
  /** The latest sizes, for listeners attached once. */
  const sizesRef = useRef({ content, frame, pad })
  const frameRafRef = useRef<number | null>(null)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const easeRef = useRef<{ from: View; to: View; start: number; fitted: boolean } | null>(null)
  const easeRafRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    sizesRef.current = { content, frame, pad }
  })

  const limits = useCallback(() => {
    const { content: c, frame: f, pad: p } = sizesRef.current
    return scaleLimits(fitView(c, f, p).scale)
  }, [])

  const apply = useCallback(() => {
    const element = contentRef.current
    if (!element) return
    const { scale, x, y } = viewRef.current
    element.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`
  }, [contentRef])

  const schedule = useCallback(() => {
    if (frameRafRef.current !== null) return
    frameRafRef.current = requestAnimationFrame(() => {
      frameRafRef.current = null
      apply()
    })
  }, [apply])

  /** Syncs the buttons with the view; `will-change` goes so the text re-renders sharp at the new scale. */
  const settle = useCallback(() => {
    const { content: c, frame: f, pad: p } = sizesRef.current
    const { scale } = viewRef.current
    const { min, max } = limits()
    const next: Status = {
      canZoomIn: scale < max - EPSILON,
      canZoomOut: scale > min + EPSILON,
      fitted: fittedRef.current,
      canPan: canPanAt(viewRef.current, c, f, p),
    }
    setStatus((previous) =>
      previous.canZoomIn === next.canZoomIn &&
      previous.canZoomOut === next.canZoomOut &&
      previous.fitted === next.fitted &&
      previous.canPan === next.canPan
        ? previous
        : next
    )
    if (contentRef.current) contentRef.current.style.willChange = 'auto'
  }, [contentRef, limits])

  const settleSoon = useCallback(() => {
    if (contentRef.current) contentRef.current.style.willChange = 'transform'
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null
      settle()
    }, SETTLE_MS)
  }, [contentRef, settle])

  /** The view as given, its scale held within the limits and the content kept in the frame. */
  const commit = useCallback(
    (view: View) => {
      const { content: c, frame: f, pad: p } = sizesRef.current
      const { min } = limits()
      viewRef.current = clampView(view, c, f, p)
      fittedRef.current = view.scale <= min + EPSILON
      schedule()
    },
    [limits, schedule]
  )

  const cancelEase = useCallback(() => {
    if (easeRafRef.current !== null) cancelAnimationFrame(easeRafRef.current)
    easeRafRef.current = null
    easeRef.current = null
  }, [])

  /**
   * Eases to `to` (ease-out cubic). A click during an ease re-targets from where the view is
   * now, so quick clicks chain instead of snapping back.
   */
  const animateTo = useCallback(
    (to: View, fitted: boolean) => {
      easeRef.current = { from: { ...viewRef.current }, to, start: performance.now(), fitted }
      if (contentRef.current) contentRef.current.style.willChange = 'transform'
      if (easeRafRef.current !== null) return
      const tick = (): void => {
        const ease = easeRef.current
        if (!ease) return
        const t = Math.min(1, (performance.now() - ease.start) / EASE_MS)
        const k = 1 - (1 - t) ** 3
        viewRef.current = {
          scale: ease.from.scale + (ease.to.scale - ease.from.scale) * k,
          x: ease.from.x + (ease.to.x - ease.from.x) * k,
          y: ease.from.y + (ease.to.y - ease.from.y) * k,
        }
        apply()
        if (t < 1) {
          easeRafRef.current = requestAnimationFrame(tick)
          return
        }
        easeRafRef.current = null
        easeRef.current = null
        fittedRef.current = ease.fitted
        settle()
      }
      easeRafRef.current = requestAnimationFrame(tick)
    },
    [apply, contentRef, settle]
  )

  /** A button step, centred on the frame, from where an ease in flight is heading. */
  const step = useCallback(
    (factor: number) => {
      const { content: c, frame: f, pad: p } = sizesRef.current
      const { min, max } = limits()
      const from = easeRef.current?.to ?? viewRef.current
      const scale = clamp(from.scale * factor, min, max)
      const target = clampView(zoomAt(from, scale, { x: f.width / 2, y: f.height / 2 }), c, f, p)
      animateTo(target, scale <= min + EPSILON)
    },
    [animateTo, limits]
  )

  const zoomIn = useCallback(() => step(BUTTON_FACTOR), [step])
  const zoomOut = useCallback(() => step(1 / BUTTON_FACTOR), [step])
  const fit = useCallback(() => {
    const { content: c, frame: f, pad: p } = sizesRef.current
    animateTo(fitView(c, f, p), true)
  }, [animateTo])

  // A new frame or content size: back to the fit if the view was there, else the same zoom kept in bounds.
  useLayoutEffect(() => {
    if (!frame.width || !frame.height || !content.width || !content.height) return
    cancelEase()
    const fitted = fitView(content, frame, pad)
    if (fittedRef.current) {
      viewRef.current = fitted
    } else {
      const { min, max } = scaleLimits(fitted.scale)
      const view = viewRef.current
      viewRef.current = clampView({ ...view, scale: clamp(view.scale, min, max) }, content, frame, pad)
    }
    apply()
    settle()
  }, [apply, cancelEase, content, frame, pad, settle])

  // Wheel and pointers, attached once; they read the view and sizes through refs.
  useEffect(() => {
    const element = frameRef.current
    if (!element) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      cancelEase()
      const rect = element.getBoundingClientRect()
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1
      const sensitivity = event.ctrlKey ? PINCH_WHEEL_SENSITIVITY : WHEEL_SENSITIVITY
      const view = viewRef.current
      const { min, max } = limits()
      const scale = clamp(view.scale * Math.exp(-event.deltaY * unit * sensitivity), min, max)
      if (Math.abs(scale - view.scale) < EPSILON * view.scale) return
      commit(zoomAt(view, scale, { x: event.clientX - rect.left, y: event.clientY - rect.top }))
      settleSoon()
    }

    const pointers = new Map<number, Point>()
    let gesture: Gesture = null
    let rect = element.getBoundingClientRect()
    const local = (event: PointerEvent): Point => ({ x: event.clientX - rect.left, y: event.clientY - rect.top })

    /** (Re)starts from the pointers now down, so lifting one finger of a pinch carries on as a pan. */
    const begin = () => {
      const [a, b] = [...pointers.values()]
      const view = { ...viewRef.current }
      if (a && b) gesture = { kind: 'pinch', distance: Math.max(1, distance(a, b)), mid: midpoint(a, b), view }
      else if (a) gesture = { kind: 'pan', start: a, view }
      else gesture = null
    }

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      cancelEase()
      if (!pointers.size) rect = element.getBoundingClientRect()
      element.setPointerCapture(event.pointerId)
      pointers.set(event.pointerId, local(event))
      if (event.pointerType === 'mouse') element.style.cursor = 'grabbing'
      if (contentRef.current) contentRef.current.style.willChange = 'transform'
      begin()
    }

    const onMove = (event: PointerEvent) => {
      if (!pointers.has(event.pointerId) || !gesture) return
      pointers.set(event.pointerId, local(event))
      if (gesture.kind === 'pan') {
        const point = pointers.get(event.pointerId) as Point
        const { view, start } = gesture
        commit({ scale: view.scale, x: view.x + point.x - start.x, y: view.y + point.y - start.y })
        return
      }
      const [a, b] = [...pointers.values()]
      if (!a || !b) return
      const { view, mid: startMid } = gesture
      const { min, max } = limits()
      const scale = clamp((view.scale * distance(a, b)) / gesture.distance, min, max)
      // The content point that was under the fingers' midpoint stays under it as they move.
      const mid = midpoint(a, b)
      const anchor = { x: (startMid.x - view.x) / view.scale, y: (startMid.y - view.y) / view.scale }
      commit({ scale, x: mid.x - anchor.x * scale, y: mid.y - anchor.y * scale })
    }

    const onUp = (event: PointerEvent) => {
      if (!pointers.delete(event.pointerId)) return
      if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId)
      begin()
      if (!pointers.size) {
        element.style.cursor = ''
        settleSoon()
      }
    }

    // A pinch must not also zoom the page: iOS does not honour `touch-action` for that.
    const onTouchMove = (event: TouchEvent) => event.preventDefault()

    element.addEventListener('wheel', onWheel, { passive: false })
    element.addEventListener('pointerdown', onDown)
    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerup', onUp)
    element.addEventListener('pointercancel', onUp)
    element.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      element.removeEventListener('wheel', onWheel)
      element.removeEventListener('pointerdown', onDown)
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerup', onUp)
      element.removeEventListener('pointercancel', onUp)
      element.removeEventListener('touchmove', onTouchMove)
    }
  }, [cancelEase, commit, contentRef, frameRef, limits, settleSoon])

  useEffect(
    () => () => {
      if (frameRafRef.current !== null) cancelAnimationFrame(frameRafRef.current)
      if (easeRafRef.current !== null) cancelAnimationFrame(easeRafRef.current)
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
    },
    []
  )

  return { ...status, zoomIn, zoomOut, fit }
}
