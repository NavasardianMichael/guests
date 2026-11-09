'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/** How often a control dragged or typed into writes to the document, ms. */
export const DRAFT_THROTTLE_MS = 200

type Draft<T> = { value: T } | null

type Throttle<T> = { push: (next: T) => void; flush: () => void; dispose: () => void }

/**
 * Writes the first value at once, then at most one per `wait` ms, the latest; `settle` runs
 * once a window passes with nothing left to write.
 */
export const createThrottle = <T>(wait: number, write: (next: T) => void, settle: () => void): Throttle<T> => {
  let pending: Draft<T> = null
  let timer: ReturnType<typeof setTimeout> | null = null
  const writePending = () => {
    if (!pending) return false
    const { value } = pending
    pending = null
    write(value)
    return true
  }
  const tick = () => {
    timer = writePending() ? setTimeout(tick, wait) : null
    if (!timer) settle()
  }
  const stop = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }
  return {
    push: (next) => {
      if (timer) {
        pending = { value: next }
        return
      }
      write(next)
      timer = setTimeout(tick, wait)
    },
    flush: () => {
      stop()
      writePending()
      settle()
    },
    dispose: () => {
      stop()
      writePending()
    },
  }
}

/**
 * A control's value while it is being changed: what it shows follows every event at once
 * (`shown`), the document gets it at most every `wait` ms (the first change at once, the last
 * one always). A colour dragged across the picker fires on every pixel and a slider on every
 * step; each write re-renders the sheet, so this keeps the drag smooth and the sheet following
 * five times a second instead of the whole page stalling.
 *
 * Call `flush` when the change is complete (pointer up, blur, Enter) to write the last value now.
 * Once nothing is pending the draft is dropped and the control shows the document again, so an
 * undo, a reset or a template change shows up in it.
 */
export const useThrottledDraft = <T>(
  value: T,
  commit: (next: T) => void,
  wait = DRAFT_THROTTLE_MS
): { shown: T; change: (next: T) => void; flush: () => void } => {
  const [draft, setDraft] = useState<Draft<T>>(null)
  const commitRef = useRef(commit)
  useLayoutEffect(() => {
    commitRef.current = commit
  })
  // Made on the first change, in a handler: it holds the timer and the value waiting, which no
  // render needs to see.
  const throttleRef = useRef<Throttle<T> | null>(null)
  const throttle = useCallback((): Throttle<T> => {
    throttleRef.current ??= createThrottle<T>(
      wait,
      (next) => commitRef.current(next),
      () => setDraft(null)
    )
    return throttleRef.current
  }, [wait])

  const change = useCallback(
    (next: T) => {
      setDraft({ value: next })
      throttle().push(next)
    },
    [throttle]
  )
  const flush = useCallback(() => throttle().flush(), [throttle])

  // Closed mid-drag (the panel switched, the drawer shut): the last value still lands.
  useEffect(() => () => throttleRef.current?.dispose(), [])

  return { shown: draft ? draft.value : value, change, flush }
}
