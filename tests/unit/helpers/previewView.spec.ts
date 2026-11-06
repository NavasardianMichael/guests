import { describe, expect, it } from 'vitest'
import { bestColumns, canPanAt, clampView, fitView, gridSize, scaleLimits, zoomAt } from '@helpers/previewView'

const A4 = { width: 210, height: 297 }
/** Even all round, so the maths reads simply; `BUTTONS` is the preview's own, more below. */
const PAD = { x: 20, top: 20, bottom: 20 }
const BUTTONS = { x: 20, top: 20, bottom: 80 }

describe('gridSize', () => {
  it('lays pages out in rows of `columns` with the gap between them', () => {
    expect(gridSize(1, 1, A4, 12)).toEqual({ width: 210, height: 297 })
    expect(gridSize(3, 1, A4, 12)).toEqual({ width: 210, height: 3 * 297 + 2 * 12 })
    expect(gridSize(3, 2, A4, 12)).toEqual({ width: 2 * 210 + 12, height: 2 * 297 + 12 })
  })
})

describe('bestColumns', () => {
  it('puts pages side by side on a wide frame and stacks them on a tall one', () => {
    expect(bestColumns(3, A4, 12, { width: 1800, height: 700 }, PAD)).toBe(3)
    expect(bestColumns(3, A4, 12, { width: 400, height: 2000 }, PAD)).toBe(1)
  })

  it('is one column for a single page', () => {
    expect(bestColumns(1, A4, 12, { width: 1800, height: 700 }, PAD)).toBe(1)
  })
})

describe('fitView', () => {
  it('shows the whole content, centred, with the padding clear', () => {
    const frame = { width: 1000, height: 800 }
    const view = fitView(A4, frame, PAD)
    expect(view.scale).toBeCloseTo((800 - 40) / 297)
    expect(view.y).toBeCloseTo(20)
    expect(view.x + (A4.width * view.scale) / 2).toBeCloseTo(500)
  })

  it('keeps the bottom padding clear for the zoom buttons', () => {
    const frame = { width: 1000, height: 800 }
    const view = fitView(A4, frame, BUTTONS)
    expect(view.scale).toBeCloseTo((800 - 20 - 80) / 297)
    expect(view.y).toBeCloseTo(20)
    expect(view.y + A4.height * view.scale).toBeCloseTo(800 - 80)
  })
})

describe('zoomAt', () => {
  it('keeps the point under the cursor in place', () => {
    const view = { scale: 1, x: 100, y: 50 }
    const point = { x: 300, y: 250 }
    const next = zoomAt(view, 2, point)
    const before = { x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale }
    const after = { x: (point.x - next.x) / next.scale, y: (point.y - next.y) / next.scale }
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })
})

describe('clampView', () => {
  const frame = { width: 1000, height: 800 }

  it('centres the content along an axis where it fits', () => {
    expect(clampView({ scale: 1, x: -500, y: 900 }, A4, frame, PAD)).toEqual({ scale: 1, x: 395, y: 251.5 })
  })

  it('lets larger content move only until its edge reaches the padding', () => {
    const big = { width: 2000, height: 3000 }
    expect(clampView({ scale: 1, x: 300, y: 300 }, big, frame, BUTTONS)).toMatchObject({ x: 20, y: 20 })
    expect(clampView({ scale: 1, x: -5000, y: -5000 }, big, frame, BUTTONS)).toMatchObject({
      x: 1000 - 2000 - 20,
      y: 800 - 3000 - 80,
    })
    expect(clampView({ scale: 1, x: -400, y: -900 }, big, frame, PAD)).toMatchObject({ x: -400, y: -900 })
  })
})

describe('canPanAt', () => {
  const frame = { width: 1000, height: 800 }

  it('is false at the fit and true once the content outgrows the room', () => {
    expect(canPanAt(fitView(A4, frame, BUTTONS), A4, frame, BUTTONS)).toBe(false)
    expect(canPanAt({ scale: 4, x: 0, y: 0 }, A4, frame, BUTTONS)).toBe(true)
  })
})

describe('scaleLimits', () => {
  it('stops at the fit going out and at least twice the fit going in', () => {
    expect(scaleLimits(0.5)).toEqual({ min: 0.5, max: 4 })
    expect(scaleLimits(3)).toEqual({ min: 3, max: 6 })
  })
})
