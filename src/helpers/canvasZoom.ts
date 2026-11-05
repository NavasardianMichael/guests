/** The canvas zoom: what the buttons, the percentage and a pinch can reach. */
export const ZOOM_MIN = 0.3
export const ZOOM_MAX = 2
const ZOOM_STEP = 0.1

export const clampZoom = (zoom: number): number => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))

/** One button press: to the next tenth, so 46% goes to 50%, not 56%. */
export const stepZoom = (zoom: number, direction: 1 | -1): number => {
  const next = direction === 1 ? Math.floor(zoom * 10 + 1e-6) / 10 + ZOOM_STEP : Math.ceil(zoom * 10 - 1e-6) / 10 - ZOOM_STEP
  return clampZoom(Math.round(next * 10) / 10)
}
