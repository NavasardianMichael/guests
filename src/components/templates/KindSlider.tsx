'use client'

import { type FC, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
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

/** How long one result stays before the next slides in. */
const SLIDE_MS = 2200
/** The sheet's cross-slide: long enough to read as a move, short enough to finish before the next one. */
const SLIDE_EASE = 'cubic-bezier(0.22,1,0.36,1)'

const subscribeReduced = (onChange: () => void): (() => void) => {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

const subscribeHidden = (onChange: () => void): (() => void) => {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

type Props = { templateId: TemplateId; kind?: PrintKind; arrangement?: PlanArrangement }

/**
 * The four things one template prints — seating board, guest list, hall plan, place cards —
 * one at a time. It advances on its own, and the arrows, dots and a swipe move it by hand.
 * Autoplay stops while the pointer is on it (and while the tab is in the background, or motion
 * is reduced). A click on the sheet opens the editor on the result showing at that moment.
 */
export const KindSlider: FC<Props> = ({ templateId, kind: initialKind = 'seating', arrangement = 'rows' }) => {
  const t = useTranslations('Templates.slider')
  const tTemplates = useTranslations('Templates')
  const tKinds = useTranslations('Editor.layout.kinds')
  const tHint = useTranslations('Editor.layout.kindHint')
  const texts = useSampleTexts()
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia('(prefers-reduced-motion: reduce)').matches, () => false)
  const hidden = useSyncExternalStore(subscribeHidden, () => document.hidden, () => false)
  const shape = useTemplateShape()
  const [index, setIndex] = useState(Math.max(0, PRINT_KINDS.indexOf(initialKind)))
  const [previous, setPrevious] = useState<number | null>(null)
  /** 1: the next sheet arrives from the right. -1: from the left. */
  const [direction, setDirection] = useState<1 | -1>(1)
  const [hover, setHover] = useState(false)
  const [frameHeight, setFrameHeight] = useState<number>()
  const [easeHeight, setEaseHeight] = useState(false)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])
  const count = PRINT_KINDS.length
  const kind = PRINT_KINDS[index]
  const docs = useMemo(
    () => PRINT_KINDS.map((value) => previewDocument(texts, templateId, value, value === 'plan' ? arrangement : 'rows')),
    [arrangement, templateId, texts]
  )
  const paused = reduced || hidden || hover

  const go = useCallback(
    (next: number): void => {
      const normalized = (next + count) % count
      setIndex((current) => {
        if (normalized === current) return current
        const forward = (normalized - current + count) % count
        const backward = (current - normalized + count) % count
        setDirection(forward <= backward ? 1 : -1)
        setPrevious(current)
        return normalized
      })
    },
    [count]
  )

  useEffect(() => {
    if (paused) return
    const id = window.setTimeout(() => go(index + 1), SLIDE_MS)
    return () => window.clearTimeout(id)
  }, [go, index, paused])

  // The frame follows the sheet on show, so a landscape hall eases into the portrait board instead of jumping.
  useLayoutEffect(() => {
    const node = slideRefs.current[index]
    if (!node) return
    const apply = () => setFrameHeight(node.offsetHeight)
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(node)
    const frame = requestAnimationFrame(() => setEaseHeight(true))
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [index])

  return (
    <section
      aria-roledescription='carousel'
      aria-label={t('label')}
      className='min-w-0'
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className='relative'>
        <div
          className={cn(
            'relative overflow-hidden rounded-xl shadow-[0_30px_70px_-25px_rgba(20,24,45,0.45)] ring-1 ring-black/5',
            easeHeight && 'transition-[height] duration-700 motion-reduce:transition-none'
          )}
          style={{ height: frameHeight, transitionTimingFunction: easeHeight ? SLIDE_EASE : undefined }}
        >
          {PRINT_KINDS.map((value, slide) => {
            const active = slide === index
            const leaving = slide === previous
            const fromRight = direction === 1
            return (
              <div
                key={value}
                ref={(node) => {
                  slideRefs.current[slide] = node
                }}
                className={cn(
                  'absolute inset-x-0 top-0 w-full transition-[transform,opacity] duration-700 motion-reduce:transition-none',
                  active && 'z-10 translate-x-0 scale-100 opacity-100',
                  !active && leaving && (fromRight ? 'z-0 -translate-x-[16%] scale-[0.96] opacity-0' : 'z-0 translate-x-[16%] scale-[0.96] opacity-0'),
                  !active && !leaving && (fromRight ? 'z-0 translate-x-[16%] scale-[0.98] opacity-0' : 'z-0 -translate-x-[16%] scale-[0.98] opacity-0')
                )}
                style={{ transitionTimingFunction: SLIDE_EASE }}
                aria-hidden={!active}
              >
                <ShapedSheetPreview doc={docs[slide]} />
              </div>
            )
          })}
        </div>
        {/* The sheet is inert, so this layer takes the click and opens the editor on the result showing now. */}
        <Link
          href={newListPath({ template: templateId, kind, shape })}
          aria-label={`${tTemplates('useThis')}: ${tKinds(kind)}`}
          className='absolute inset-0 z-10 cursor-pointer'
          onPointerDown={(event) => {
            if (event.button !== 0) return
            origin.current = { x: event.clientX, y: event.clientY }
            swiped.current = false
          }}
          onPointerUp={(event) => {
            const start = origin.current
            origin.current = null
            if (!start) return
            const dx = event.clientX - start.x
            const dy = event.clientY - start.y
            if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return
            swiped.current = true
            go(index + (dx < 0 ? 1 : -1))
          }}
          onPointerCancel={() => {
            origin.current = null
          }}
          onClick={(event) => {
            if (!swiped.current) return
            event.preventDefault()
            swiped.current = false
          }}
        />
        <button
          type='button'
          aria-label={t('previous')}
          onClick={() => go(index - 1)}
          className='absolute top-1/2 left-3 z-20 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-surface/90 text-ink shadow-lg ring-1 ring-black/10 backdrop-blur-sm transition hover:bg-surface'
        >
          <LeftOutlined />
        </button>
        <button
          type='button'
          aria-label={t('next')}
          onClick={() => go(index + 1)}
          className='absolute top-1/2 right-3 z-20 grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-surface/90 text-ink shadow-lg ring-1 ring-black/10 backdrop-blur-sm transition hover:bg-surface'
        >
          <RightOutlined />
        </button>
      </div>

      <div key={kind} className='mt-4 px-1 text-center motion-safe:animate-[kind-caption_0.65s_cubic-bezier(0.22,1,0.36,1)_both]'>
        <p className='m-0 font-display text-lg font-bold text-ink'>{tKinds(kind)}</p>
        <p className='m-0 mt-1 text-sm leading-relaxed text-muted'>{tHint(kind)}</p>
      </div>

      <div className='mt-4 flex items-center justify-center gap-2.5'>
        {PRINT_KINDS.map((value, slide) => (
          <button
            key={value}
            type='button'
            aria-label={tKinds(value)}
            aria-current={slide === index ? 'true' : undefined}
            onClick={() => go(slide)}
            className={cn(
              'h-2 cursor-pointer rounded-full transition-all',
              slide === index ? 'w-8 bg-ink' : 'w-2 bg-line hover:bg-ink/40'
            )}
          />
        ))}
      </div>
    </section>
  )
}
