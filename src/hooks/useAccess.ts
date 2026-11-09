'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { useAuthStore } from '@store/auth/store'
import { usePurchasesStore, usePurchasesStoreBase } from '@store/purchases/store'
import { isAccessActive } from '@constants/pricing'

/**
 * When the visitor's access pass ends — the account's once signed in, else this browser's (its
 * guest key): epoch ms, in the past once it ran out, null if never bought. Undefined until
 * known: callers treat that as "not yet", never as "none".
 */
export const useAccessUntil = (): number | null | undefined => {
  const user = useAuthStore.use.user()
  const isResolved = useAuthStore.use.isResolved()
  const until = usePurchasesStore.use.until()
  const loadedFor = usePurchasesStore.use.loadedFor()
  const owner = isResolved ? (user?.id ?? 'guest') : null

  useEffect(() => {
    if (owner) void usePurchasesStoreBase.getState().load(owner)
  }, [owner])

  return owner && loadedFor === owner ? until : undefined
}

const MINUTE_MS = 60 * 1000

const subscribeMinutes = (onTick: () => void): (() => void) => {
  const timer = setInterval(onTick, MINUTE_MS)
  return () => clearInterval(timer)
}

/** The time to the minute: stable between ticks, so it is a valid external-store snapshot. */
const minuteNow = (): number => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS

/**
 * The current time for rendering, to the minute, re-rendering as minutes pass — so "days left"
 * and "running" move on in a page left open. 0 on the server (nothing time-bound renders there).
 */
export const useNow = (): number => useSyncExternalStore(subscribeMinutes, minuteNow, () => 0)

/** Whether the pass is running now; false while unknown. Event handlers ask the store with `Date.now()` instead. */
export const useAccessActive = (): boolean => {
  const until = useAccessUntil()
  const now = useNow()
  return until !== undefined && isAccessActive(until, now)
}

/** For event handlers: whether the pass runs at this moment, or null while unknown. */
export const accessActiveNow = (): boolean | null => {
  const { until } = usePurchasesStoreBase.getState()
  return until === undefined ? null : isAccessActive(until, Date.now())
}
