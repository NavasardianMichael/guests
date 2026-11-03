'use client'

import { useCallback, useSyncExternalStore } from 'react'

/** Phones and tablets: under antd's `lg`, where the editor drops its settings column. */
export const COMPACT_QUERY = '(max-width: 991.98px)'
/** A mouse or trackpad: hover exists, so tooltips and hover-revealed controls work. */
export const HOVER_QUERY = '(hover: hover) and (pointer: fine)'

/** Whether a media query matches, live. `serverValue` is what the first render assumes. */
export const useMediaQuery = (query: string, serverValue = false): boolean => {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query]
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => serverValue
  )
}
