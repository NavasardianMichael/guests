import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createThrottle } from '@hooks/useThrottledDraft'

describe('createThrottle', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const setup = () => {
    const writes: number[] = []
    const settle = vi.fn()
    const throttle = createThrottle<number>(80, (value) => writes.push(value), settle)
    return { writes, settle, throttle }
  }

  it('writes the first value at once and the latest one per window', () => {
    const { writes, settle, throttle } = setup()
    for (let value = 1; value <= 10; value += 1) throttle.push(value)
    expect(writes).toEqual([1])
    vi.advanceTimersByTime(80)
    expect(writes).toEqual([1, 10])
    expect(settle).not.toHaveBeenCalled()
    vi.advanceTimersByTime(80)
    expect(writes).toEqual([1, 10])
    expect(settle).toHaveBeenCalledOnce()
  })

  it('writes what is waiting at once on flush, and settles', () => {
    const { writes, settle, throttle } = setup()
    throttle.push(1)
    throttle.push(2)
    throttle.push(3)
    throttle.flush()
    expect(writes).toEqual([1, 3])
    expect(settle).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(500)
    expect(writes).toEqual([1, 3])
  })

  it('still writes the last value when the control goes away', () => {
    const { writes, settle, throttle } = setup()
    throttle.push(1)
    throttle.push(2)
    throttle.dispose()
    expect(writes).toEqual([1, 2])
    vi.advanceTimersByTime(500)
    expect(settle).not.toHaveBeenCalled()
  })
})
