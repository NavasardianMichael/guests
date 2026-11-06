/**
 * The print preview's view: where the pages sit in the frame and at what scale, in screen
 * pixels. Pure, so the zoom/pan hook (`hooks/useZoomPan`) only applies it.
 *
 * `x`/`y` are the content's top-left corner in the frame, `scale` multiplies its true size.
 */

export type Size = { width: number; height: number }
export type Point = { x: number; y: number }
export type View = { scale: number; x: number; y: number }
/** Kept clear around the content, px: the same left and right, more below for the zoom buttons. */
export type Pad = { x: number; top: number; bottom: number }

/** The furthest zoom in, as a multiple of the printed size; never less than twice the fit. */
const MAX_SCALE = 4

/** The grid of pages, `columns` across, with `gap` between them both ways. */
export const gridSize = (pages: number, columns: number, page: Size, gap: number): Size => {
  const rows = Math.ceil(pages / columns)
  return { width: columns * page.width + (columns - 1) * gap, height: rows * page.height + (rows - 1) * gap }
}

const fitScaleOf = (content: Size, frame: Size, pad: Pad): number =>
  Math.max(
    0,
    Math.min((frame.width - 2 * pad.x) / content.width, (frame.height - pad.top - pad.bottom) / content.height)
  )

/**
 * How many pages side by side show them largest in the frame: one column on a tall screen,
 * a row on a wide one. The fewest columns win a tie, so pages read top to bottom.
 */
export const bestColumns = (pages: number, page: Size, gap: number, frame: Size, pad: Pad): number => {
  let best = 1
  let bestScale = -1
  for (let columns = 1; columns <= Math.max(1, pages); columns += 1) {
    const scale = fitScaleOf(gridSize(pages, columns, page, gap), frame, pad)
    if (scale > bestScale + 1e-9) {
      best = columns
      bestScale = scale
    }
  }
  return best
}

/** The whole content inside the frame, `pad` clear around it, centred in the room left. */
export const fitView = (content: Size, frame: Size, pad: Pad): View => {
  const scale = fitScaleOf(content, frame, pad)
  return {
    scale,
    x: (frame.width - content.width * scale) / 2,
    y: pad.top + (frame.height - pad.top - pad.bottom - content.height * scale) / 2,
  }
}

/** Zoom never goes below the fit (no point: the content is already whole) nor past the cap. */
export const scaleLimits = (fitScale: number): { min: number; max: number } => ({
  min: fitScale,
  max: Math.max(MAX_SCALE, fitScale * 2),
})

/** To `scale`, keeping the content under `point` (frame pixels) where it is. */
export const zoomAt = (view: View, scale: number, point: Point): View => {
  const ratio = scale / view.scale
  return { scale, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio }
}

/**
 * Keeps the content in view: along an axis where it fits (padding included) it is centred in
 * the room left; where it is larger it may move only until its edge reaches the padding.
 */
export const clampView = (view: View, content: Size, frame: Size, pad: Pad): View => {
  const axis = (position: number, length: number, room: number, before: number, after: number): number => {
    const scaled = length * view.scale
    if (scaled + before + after <= room) return before + (room - before - after - scaled) / 2
    return Math.min(before, Math.max(room - scaled - after, position))
  }
  return {
    scale: view.scale,
    x: axis(view.x, content.width, frame.width, pad.x, pad.x),
    y: axis(view.y, content.height, frame.height, pad.top, pad.bottom),
  }
}

/** Whether the content at this view is larger than the room, so a drag can move it. */
export const canPanAt = (view: View, content: Size, frame: Size, pad: Pad): boolean =>
  content.width * view.scale + 2 * pad.x > frame.width + 1 ||
  content.height * view.scale + pad.top + pad.bottom > frame.height + 1
