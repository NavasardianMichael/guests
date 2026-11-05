const inFlight = new Map<string, Promise<unknown>>()

/**
 * Runs a create-type request once per key, however many times it is asked for while running.
 * An effect that creates something (a CV from a draft, a new CV) runs twice under React's
 * StrictMode and again on a fast re-render; both calls must get the same result rather than
 * two rows. The key is held a little past settling, so a call racing the navigation that
 * follows still finds it.
 */
export const dedupe = <T>(key: string, run: () => Promise<T>, holdMs = 5000): Promise<T> => {
  const existing = inFlight.get(key)
  if (existing) return existing as Promise<T>
  const promise = run().finally(() => {
    setTimeout(() => inFlight.delete(key), holdMs)
  })
  inFlight.set(key, promise)
  return promise
}
