import { describe, expect, it } from 'vitest'
import { clampZoom, stepZoom, ZOOM_MAX, ZOOM_MIN } from '@helpers/canvasZoom'

describe('stepZoom', () => {
  it('goes to the next tenth from a fitted zoom', () => {
    expect(stepZoom(0.46, 1)).toBe(0.5)
    expect(stepZoom(0.46, -1)).toBe(0.4)
  })

  it('moves a whole tenth from a round zoom', () => {
    expect(stepZoom(1, 1)).toBe(1.1)
    expect(stepZoom(1, -1)).toBe(0.9)
    expect(stepZoom(0.7, 1)).toBe(0.8)
  })

  it('stops at the bounds', () => {
    expect(stepZoom(ZOOM_MAX, 1)).toBe(ZOOM_MAX)
    expect(stepZoom(ZOOM_MIN, -1)).toBe(ZOOM_MIN)
  })
})

describe('clampZoom', () => {
  it('keeps a pinch inside the bounds', () => {
    expect(clampZoom(5)).toBe(ZOOM_MAX)
    expect(clampZoom(0.01)).toBe(ZOOM_MIN)
    expect(clampZoom(0.8)).toBe(0.8)
  })
})
