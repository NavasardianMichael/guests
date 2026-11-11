'use client'

import {
  type FC,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { type PlanArrangement, PRINT_KINDS, type PrintKind } from '@store/lists/single/types'
import { useSampleTexts } from '@hooks/useSampleTexts'
import { newListPath } from '@constants/routes'
import type { TemplateId } from '@constants/templates'
import { cn } from '@helpers/cn'
import { previewDocument } from '@helpers/listFactory'
import { ShapedSheetPreview, useTemplateShape } from './TemplateShape'

/** How long one result stays before the next swipes in. */
const SLIDE_MS = 3000
/** A full swipe, one sheet out and the next in; a shorter way left (after a drag) takes less. */
const SWIPE_MS = 650
const SWIPE_MIN_MS = 220
const SWIPE_EASE = 'cubic-bezier(0.22,1,0.36,1)'
/** Room between two sheets while they pass, px. */
const GAP_PX = 28
/** A sheet one place to the side: a little smaller and faded, so the swipe has depth. */
const SIDE_SCALE = 0.9
const SIDE_OPACITY = 0.3
/** A drag past this share of the width, or a flick faster than this (px/ms), moves on. */
const COMMIT_SHARE = 0.22
const FLICK_SPEED = 0.35
/** How far the pointer goes before it counts as a drag (or as a scroll, if vertical), px. */
const DRAG_SLOP = 8

const subscribeReduced = (onChange: () => void): (() => void) => {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

const subscribeHidden = (onChange: () => void): (() => void) => {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

const prefersReduced = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/**
 * A sheet `offset` widths from the centre (0 centred, 1 just off to the right, -1 to the
 * left). Only transform and opacity change, so the compositor moves the sheets without layout.
 */
const pose = (offset: number, step: number): { transform: string; opacity: number } => {
  const away = Math.min(1, Math.abs(offset))
  return {
    transform: `translate3d(${(offset * step).toFixed(2)}px,0,0) scale(${(1 - (1 - SIDE_SCALE) * away).toFixed(4)})`,
    opacity: Number((1 - (1 - SIDE_OPACITY) * away * away).toFixed(3)),
  }
}

/** Keyframes between two offsets, sampled so the fade follows its curve and not a straight line. */
const KEYFRAME_AT = [0, 0.25, 0.5, 0.75, 1]
const keyframes = (from: number, to: number, step: number): Keyframe[] =>
  KEYFRAME_AT.map((at) => ({ offset: at, ...pose(from + (to - from) * at, step) }))

const setPose = (node: HTMLElement, offset: number, step: number): void => {
  const { transform, opacity } = pose(offset, step)
  node.style.transform = transform
  node.style.opacity = String(opacity)
}

const resetNode = (node: HTMLElement): void => {
  for (const animation of node.getAnimations()) animation.cancel()
  node.style.transform = ''
  node.style.opacity = ''
  node.style.visibility = ''
  node.style.willChange = ''
}

/** Whether a sheet is mid-move (animating, or held by a drag) rather than at rest. */
const isMoving = (node: HTMLElement): boolean => node.style.transform !== '' || node.getAnimations().length > 0

/** Where a moving sheet is right now, in widths from the centre. */
const offsetOf = (node: HTMLElement, step: number): number => {
  if (step <= 0) return 0
  const transform = getComputedStyle(node).transform
  if (!transform || transform === 'none') return 0
  return new DOMMatrixReadOnly(transform).m41 / step
}

type Move = { node: HTMLElement; from: number; to: number }

type Drag = {
  id: number
  x: number
  y: number
  axis: 'x' | null
  /** Where the centred sheet was when the drag took it (mid-swipe it may not be at 0). */
  base: number
  step: number
  dx: number
  samples: { x: number; t: number }[]
  frame: number
}

type Props = { templateId: TemplateId; kind?: PrintKind; arrangement?: PlanArrangement }

/**
 * The four things one template prints — seating board, guest list, hall plan, place cards —
 * one at a time. It advances on its own, and the arrows, dots and a swipe move it by
 * hand; a drag carries the sheet under the finger and a flick throws it. Autoplay stops while the
 * pointer is on it, while it is dragged, off screen, in a background tab, or when motion is
 * reduced. A click on the sheet opens the editor on the result showing at that moment.
 *
 * The sheets share one grid cell, so the stage is as tall as the tallest and never animates its
 * height; every move is transform + opacity on the Web Animations API, started from wherever the
 * sheet is, so an interrupted swipe carries on instead of jumping.
 */
export const KindSlider: FC<Props> = ({ templateId, kind: initialKind = 'seating', arrangement = 'rows' }) => {
  const t = useTranslations('Templates.slider')
  const tTemplates = useTranslations('Templates')
  const tKinds = useTranslations('Editor.layout.kinds')
  const tHint = useTranslations('Editor.layout.kindHint')
  const texts = useSampleTexts()
  const reduced = useSyncExternalStore(subscribeReduced, prefersReduced, () => false)
  const hidden = useSyncExternalStore(subscribeHidden, () => document.hidden, () => false)
  const shape = useTemplateShape()
  const count = PRINT_KINDS.length
  const [index, setIndex] = useState(() => Math.max(0, PRINT_KINDS.indexOf(initialKind)))
  const [hover, setHover] = useState(false)
  const [holding, setHolding] = useState(false)
  const [onScreen, setOnScreen] = useState(true)
  const sectionRef = useRef<HTMLElement>(null)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  /** The slide the stage last came to rest on; the layout effect swipes from it to `index`. */
  const shown = useRef(index)
  /** 1: the next sheet comes in from the right. -1: from the left. */
  const direction = useRef<1 | -1>(1)
  /** Bumped by every new move, so a finished older one does not tidy up after the newer. */
  const motion = useRef(0)
  const drag = useRef<Drag | null>(null)
  const swiped = useRef(false)
  const kind = PRINT_KINDS[index]
  const docs = useMemo(
    () => PRINT_KINDS.map((value) => previewDocument(texts, templateId, value, value === 'plan' ? arrangement : 'rows')),
    [arrangement, templateId, texts]
  )
  const paused = reduced || hidden || hover || holding || !onScreen

  const slides = (): HTMLDivElement[] => slideRefs.current.filter((node): node is HTMLDivElement => !!node)

  /** One sheet's width plus the gap: how far a sheet travels to leave the stage. */
  const stepPx = (): number => (slideRefs.current[shown.current]?.offsetWidth ?? 0) + GAP_PX

  const clearMotion = (): void => {
    motion.current += 1
    for (const node of slides()) resetNode(node)
  }

  /** Runs the moves together; when they end, the sheets go back to their resting classes. */
  const play = (moves: Move[], step: number): void => {
    clearMotion()
    if (!moves.length || step <= GAP_PX || prefersReduced()) return
    const generation = motion.current
    const distance = Math.max(...moves.map((move) => Math.abs(move.to - move.from)))
    const duration = Math.round(Math.max(SWIPE_MIN_MS, SWIPE_MS * Math.min(1, distance)))
    const animations = moves.map(({ node, from, to }) => {
      node.style.visibility = 'visible'
      return node.animate(keyframes(from, to, step), { duration, easing: SWIPE_EASE, fill: 'forwards' })
    })
    Promise.all(animations.map((animation) => animation.finished)).then(
      () => {
        if (motion.current === generation) clearMotion()
      },
      () => undefined
    )
  }

  /** Every moving sheet heads home: the current one to the centre, the others off to their side. */
  const settleBack = (): void => {
    const step = stepPx()
    const moves: Move[] = []
    slideRefs.current.forEach((node, slide) => {
      if (!node || !isMoving(node)) return
      const from = offsetOf(node, step)
      moves.push({ node, from, to: slide === index ? 0 : from < 0 ? -1 : 1 })
    })
    play(moves, step)
  }

  const go = useCallback(
    (next: number, side?: 1 | -1): void => {
      const target = ((next % count) + count) % count
      if (target === index) return
      const forward = (target - index + count) % count
      direction.current = side ?? (forward <= count - forward ? 1 : -1)
      setIndex(target)
    },
    [count, index]
  )

  // The swipe itself, before the browser paints the new classes: the leaving sheet is held
  // visible and both sheets start from where they are (mid-drag or mid-swipe) or from the side.
  useLayoutEffect(() => {
    const from = shown.current
    if (from === index) return
    shown.current = index
    const outgoing = slideRefs.current[from]
    const incoming = slideRefs.current[index]
    if (!outgoing || !incoming) return
    const step = stepPx()
    const side = direction.current
    const moves: Move[] = [
      { node: outgoing, from: isMoving(outgoing) ? offsetOf(outgoing, step) : 0, to: -side },
      { node: incoming, from: isMoving(incoming) ? offsetOf(incoming, step) : side, to: 0 },
    ]
    // A third sheet still on its way (a drag towards the other side, a fast double click) leaves too.
    for (const node of slides()) {
      if (node === outgoing || node === incoming || !isMoving(node)) continue
      const at = offsetOf(node, step)
      moves.push({ node, from: at, to: at < 0 ? -1 : 1 })
    }
    play(moves, step)
    // `play` and `stepPx` only read refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  useEffect(() => {
    if (paused) return
    const id = window.setTimeout(() => go(index + 1, 1), SLIDE_MS)
    return () => window.clearTimeout(id)
  }, [go, index, paused])

  // Off screen it does not move: no timers, no animations nobody sees.
  useEffect(() => {
    const node = sectionRef.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry?.isIntersecting ?? true), { threshold: 0.2 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const paintDrag = (): void => {
    const current = drag.current
    if (!current) return
    current.frame = 0
    const offset = clamp(current.base + current.dx / current.step, -1, 1)
    // Dragged left, the next sheet follows in from the right; dragged right, the previous one.
    const side: 1 | -1 = offset < 0 ? 1 : -1
    const active = slideRefs.current[index]
    const near = slideRefs.current[(index + side + count) % count]
    const far = slideRefs.current[(index - side + count) % count]
    if (active) setPose(active, offset, current.step)
    if (near) {
      near.style.visibility = 'visible'
      near.style.willChange = 'transform, opacity'
      setPose(near, offset + side, current.step)
    }
    if (far && far !== near) resetNode(far)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLAnchorElement>): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null, base: 0, step: 0, dx: 0, samples: [], frame: 0 }
    swiped.current = false
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLAnchorElement>): void => {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    if (current.axis === null) {
      const dx = event.clientX - current.x
      const dy = event.clientY - current.y
      if (Math.hypot(dx, dy) < DRAG_SLOP) return
      // Mostly vertical: the page scrolls, the slider stays out of it.
      if (Math.abs(dy) > Math.abs(dx)) {
        drag.current = null
        return
      }
      current.axis = 'x'
      current.x = event.clientX
      current.step = stepPx()
      const active = slideRefs.current[index]
      current.base = active && isMoving(active) ? offsetOf(active, current.step) : 0
      clearMotion()
      if (active) active.style.willChange = 'transform, opacity'
      event.currentTarget.setPointerCapture(event.pointerId)
      swiped.current = true
      setHolding(true)
    }
    current.dx = event.clientX - current.x
    current.samples.push({ x: event.clientX, t: event.timeStamp })
    while (current.samples.length > 2 && event.timeStamp - current.samples[0].t > 100) current.samples.shift()
    if (!current.frame) current.frame = requestAnimationFrame(paintDrag)
  }

  const endDrag = (event: ReactPointerEvent<HTMLAnchorElement>, cancelled: boolean): void => {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    drag.current = null
    if (current.axis !== 'x') return
    if (current.frame) {
      cancelAnimationFrame(current.frame)
      paintDrag()
    }
    setHolding(false)
    const offset = clamp(current.base + current.dx / current.step, -1, 1)
    const first = current.samples[0]
    const last = current.samples[current.samples.length - 1]
    const speed = first && last && last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0
    const flick: 0 | 1 | -1 = Math.abs(speed) > FLICK_SPEED ? (speed < 0 ? 1 : -1) : 0
    const far: 0 | 1 | -1 = Math.abs(offset) > COMMIT_SHARE ? (offset < 0 ? 1 : -1) : 0
    // A throw back against the drag keeps the sheet; otherwise the drag or the flick decides.
    const side = cancelled ? 0 : far && flick && far !== flick ? 0 : far || flick
    if (side) go(index + side, side)
    else settleBack()
  }

  const arrowClass =
    'absolute top-1/2 z-20 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-surface/95 text-ink shadow-lg ring-1 ring-black/10 transition-[transform,background-color] duration-200 hover:scale-105 hover:bg-surface active:scale-95'

  return (
    <section
      ref={sectionRef}
      aria-roledescription='carousel'
      aria-label={t('label')}
      className='min-w-0'
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className='relative'>
        {/* Clipped only sideways, a few px outside the sheet, so the shadows below still show. */}
        <div className='-mx-3 grid overflow-x-clip px-3'>
          {PRINT_KINDS.map((value, slide) => {
            const active = slide === index
            return (
              <div
                key={value}
                ref={(node) => {
                  slideRefs.current[slide] = node
                }}
                className={cn('col-start-1 row-start-1 self-center', active ? 'visible' : 'invisible')}
                aria-hidden={!active}
              >
                <div className='overflow-hidden rounded-xl shadow-[0_30px_70px_-25px_rgba(20,24,45,0.45)] ring-1 ring-black/5'>
                  <ShapedSheetPreview doc={docs[slide]} />
                </div>
              </div>
            )
          })}
        </div>
        {/* The sheet is inert, so this layer takes the click (opening the editor on the result
            showing now) and the drag. Vertical moves stay the page's scroll. */}
        <Link
          href={newListPath({ template: templateId, kind, shape })}
          aria-label={`${tTemplates('useThis')}: ${tKinds(kind)}`}
          draggable={false}
          className={cn('absolute inset-0 z-10 touch-pan-y select-none', holding ? 'cursor-grabbing' : 'cursor-pointer')}
          onDragStart={(event) => event.preventDefault()}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(event) => endDrag(event, false)}
          onPointerCancel={(event) => endDrag(event, true)}
          onClick={(event) => {
            if (!swiped.current) return
            event.preventDefault()
            swiped.current = false
          }}
        />
        <button type='button' aria-label={t('previous')} onClick={() => go(index - 1, -1)} className={cn(arrowClass, 'left-3')}>
          <LeftOutlined />
        </button>
        <button type='button' aria-label={t('next')} onClick={() => go(index + 1, 1)} className={cn(arrowClass, 'right-3')}>
          <RightOutlined />
        </button>
      </div>

      <div key={kind} className='mt-5 px-1 text-center motion-safe:animate-[kind-caption_0.65s_cubic-bezier(0.22,1,0.36,1)_both]'>
        <p className='m-0 font-display text-lg font-bold text-ink'>{tKinds(kind)}</p>
        <p className='m-0 mt-1 text-sm leading-relaxed text-muted'>{tHint(kind)}</p>
      </div>

      <div className='mt-4 flex items-center justify-center gap-2.5'>
        {PRINT_KINDS.map((value, slide) => {
          const active = slide === index
          return (
            <button
              key={value}
              type='button'
              aria-label={tKinds(value)}
              aria-current={active ? 'true' : undefined}
              onClick={() => go(slide)}
              className={cn(
                'relative h-2 cursor-pointer overflow-hidden rounded-full transition-[width,background-color] duration-300',
                active ? 'w-8 bg-ink/20' : 'w-2 bg-line hover:bg-ink/40'
              )}
            >
              {/* The active dot fills while the sheet waits, then the next one swipes in. */}
              {active && (
                <span
                  key={paused ? 'held' : 'running'}
                  className='absolute inset-0 origin-left rounded-full bg-ink'
                  style={paused ? undefined : { animation: `slider-progress ${SLIDE_MS}ms linear both` }}
                />
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
