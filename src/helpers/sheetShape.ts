import { type ListDesign, SHEET_SHAPES, type SheetShape } from '@store/lists/single/types'
import type { ShapeFrame } from '@constants/templateFrames'

/**
 * A sheet's outline, in millimetres on its page — what the shape picker offers.
 *
 * The paper stays a rectangle. A shaped sheet prints its design inside the outline and a cut
 * line along it; `layoutSheet` keeps every block inside the outline drawn at the margin
 * (`shapeRegion`), so names follow the curve of an arch or an oval instead of a rectangle
 * inside it. One function draws every use of an outline at any inset: the cut line (0), the
 * background's bleed (negative), the template's frame (its own insets), the content (the margin).
 *
 * Outlines are polygons — curves sampled about every millimetre — wound clockwise on the
 * page (y down), and symmetric left to right.
 */

export type Point = { x: number; y: number }
export type Rect = { x: number; y: number; w: number; h: number }

/** The background runs this far past the cut line: a cut a little off leaves no paper edge. */
export const SHAPE_BLEED = 1.5

/** Shapes whose corners are square, by corner (`.sh-d1`…`.sh-d4`: top left, top right, bottom left, bottom right). */
export const SQUARE_CORNERS: Record<SheetShape, readonly [boolean, boolean, boolean, boolean]> = {
  rectangle: [true, true, true, true],
  rounded: [false, false, false, false],
  ticket: [false, false, false, false],
  arch: [false, false, true, true],
  pointed: [false, false, true, true],
  oval: [false, false, false, false],
  circle: [false, false, false, false],
  hexagon: [false, false, false, false],
  octagon: [false, false, false, false],
  wavy: [false, false, false, false],
  scalloped: [false, false, false, false],
}

/** The shape a sheet prints in: place cards are always rectangles, and so is a draft saved before shapes. */
export const sheetShapeOf = (design: Pick<ListDesign, 'kind' | 'shape'>): SheetShape =>
  design.kind === 'cards' || !(SHEET_SHAPES as readonly string[]).includes(design.shape) ? 'rectangle' : design.shape

/** Between two points of a sampled curve, mm. */
const STEP = 1.2

const arc = (out: Point[], cx: number, cy: number, rx: number, ry: number, from: number, to: number): void => {
  const count = Math.max(4, Math.ceil((Math.abs(to - from) * Math.max(rx, ry)) / STEP))
  for (let index = 0; index <= count; index += 1) {
    const angle = from + ((to - from) * index) / count
    out.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) })
  }
}

const shrink = (box: Rect, by: number): Rect => ({
  x: box.x + by,
  y: box.y + by,
  w: Math.max(0.2, box.w - by * 2),
  h: Math.max(0.2, box.h - by * 2),
})

const corners = (box: Rect): Point[] => [
  { x: box.x, y: box.y },
  { x: box.x + box.w, y: box.y },
  { x: box.x + box.w, y: box.y + box.h },
  { x: box.x, y: box.y + box.h },
]

/** A convex polygon (clockwise) moved `by` mm inwards, every edge parallel to its own. */
const offsetConvex = (points: Point[], by: number): Point[] => {
  const count = points.length
  const lines = points.map((point, index) => {
    const next = points[(index + 1) % count]
    const length = Math.hypot(next.x - point.x, next.y - point.y) || 1
    const dx = (next.x - point.x) / length
    const dy = (next.y - point.y) / length
    // Inwards, for a clockwise outline with y down.
    return { x: point.x - dy * by, y: point.y + dx * by, dx, dy }
  })
  return lines.map((line, index) => {
    const previous = lines[(index - 1 + count) % count]
    const cross = previous.dx * line.dy - previous.dy * line.dx
    if (Math.abs(cross) < 1e-9) return { x: line.x, y: line.y }
    const t = ((line.x - previous.x) * line.dy - (line.y - previous.y) * line.dx) / cross
    return { x: previous.x + previous.dx * t, y: previous.y + previous.dy * t }
  })
}

const boundsOf = (points: Point[]): Rect => {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

/** `points` stretched to fill `box` exactly. */
const fitInto = (points: Point[], box: Rect): Point[] => {
  const from = boundsOf(points)
  return points.map((point) => ({
    x: box.x + ((point.x - from.x) / (from.w || 1)) * box.w,
    y: box.y + ((point.y - from.y) / (from.h || 1)) * box.h,
  }))
}

/** The page area a shape is drawn in: the page, or for a circle the largest centred square. */
export const shapeBox = (shape: SheetShape, width: number, height: number): Rect => {
  if (shape !== 'circle') return { x: 0, y: 0, w: width, h: height }
  const side = Math.min(width, height)
  return { x: (width - side) / 2, y: (height - side) / 2, w: side, h: side }
}

/** A sheet's outline drawn `inset` mm inside its edge (outside it when negative). */
export const shapeOutline = (shape: SheetShape, box: Rect, inset: number): Point[] => {
  const inner = shrink(box, inset)
  const short = Math.min(box.w, box.h)
  const points: Point[] = []
  switch (shape) {
    case 'rectangle':
      return corners(inner)
    case 'rounded': {
      const radius = short * 0.09 - inset
      if (radius < 0.05) return corners(inner)
      const { x, y, w, h } = inner
      arc(points, x + radius, y + radius, radius, radius, Math.PI, Math.PI * 1.5)
      arc(points, x + w - radius, y + radius, radius, radius, Math.PI * 1.5, Math.PI * 2)
      arc(points, x + w - radius, y + h - radius, radius, radius, 0, Math.PI / 2)
      arc(points, x + radius, y + h - radius, radius, radius, Math.PI / 2, Math.PI)
      return points
    }
    case 'ticket': {
      // A quarter circle cut out of each corner, centred on the corner itself.
      const radius = Math.max(short * 0.09 + inset, Math.abs(inset) + 0.5)
      const along = Math.sqrt(radius * radius - inset * inset)
      const d = inset
      const { x, y, w, h } = box
      // The short way round each corner, whichever side of ±π the angles fall.
      const notch = (cx: number, cy: number, from: number, to: number) => {
        let end = to
        while (end - from > Math.PI) end -= Math.PI * 2
        while (from - end > Math.PI) end += Math.PI * 2
        arc(points, cx, cy, radius, radius, from, end)
      }
      notch(x, y, Math.atan2(along, d), Math.atan2(d, along))
      notch(x + w, y, Math.atan2(d, -along), Math.atan2(along, -d))
      notch(x + w, y + h, Math.atan2(-along, -d), Math.atan2(-d, -along))
      notch(x, y + h, Math.atan2(-d, along), Math.atan2(-along, d))
      return points
    }
    case 'arch': {
      // A round top on straight sides; a sheet much wider than tall gets a flatter, elliptic top.
      const rx = box.w / 2
      const ry = Math.min(rx, box.h * 0.72)
      const cx = box.x + rx
      const cy = box.y + ry
      points.push({ x: inner.x, y: inner.y + inner.h })
      arc(points, cx, cy, rx - inset, ry - inset, Math.PI, Math.PI * 2)
      points.push({ x: inner.x + inner.w, y: inner.y + inner.h })
      return points
    }
    case 'pointed': {
      // A pointed (lancet) arch, as in Armenian church windows: two arcs meeting at the top.
      const radius = box.w * 0.66
      const half = box.w / 2
      const rise = Math.sqrt(radius * radius - (radius - half) ** 2)
      const squash = Math.min(1, (box.h * 0.72) / rise)
      const spring = box.y + rise * squash
      const r = radius - inset
      const offset = (radius - half) / r
      const leftCx = box.x + radius
      const rightCx = box.x + box.w - radius
      const along = (cx: number, from: number, to: number) => {
        const count = Math.max(8, Math.ceil((Math.abs(to - from) * r) / STEP))
        for (let index = 0; index <= count; index += 1) {
          const angle = from + ((to - from) * index) / count
          points.push({ x: cx + r * Math.cos(angle), y: spring + r * Math.sin(angle) * squash })
        }
      }
      points.push({ x: inner.x, y: inner.y + inner.h })
      along(leftCx, Math.PI, Math.PI * 2 - Math.acos(-offset))
      along(rightCx, Math.PI * 2 - Math.acos(offset), Math.PI * 2)
      points.push({ x: inner.x + inner.w, y: inner.y + inner.h })
      return points
    }
    case 'oval':
    case 'circle':
      arc(points, inner.x + inner.w / 2, inner.y + inner.h / 2, inner.w / 2, inner.h / 2, Math.PI, Math.PI * 3)
      points.pop()
      return points
    case 'hexagon': {
      // Pointed along the sheet's long side, so a poster keeps its long straight edges.
      const { x, y, w, h } = box
      const tall = h >= w
      const tip = ((tall ? w : h) / 2) * Math.tan(Math.PI / 6)
      const outline = tall
        ? [
            { x: x + w / 2, y },
            { x: x + w, y: y + tip },
            { x: x + w, y: y + h - tip },
            { x: x + w / 2, y: y + h },
            { x, y: y + h - tip },
            { x, y: y + tip },
          ]
        : [
            { x: x + tip, y },
            { x: x + w - tip, y },
            { x: x + w, y: y + h / 2 },
            { x: x + w - tip, y: y + h },
            { x: x + tip, y: y + h },
            { x, y: y + h / 2 },
          ]
      return offsetConvex(outline, inset)
    }
    case 'octagon': {
      const { x, y, w, h } = box
      const cut = short * 0.29
      return offsetConvex(
        [
          { x: x + cut, y },
          { x: x + w - cut, y },
          { x: x + w, y: y + cut },
          { x: x + w, y: y + h - cut },
          { x: x + w - cut, y: y + h },
          { x: x + cut, y: y + h },
          { x, y: y + h - cut },
          { x, y: y + cut },
        ],
        inset
      )
    }
    case 'wavy': {
      // Every edge a gentle wave with a crest at each end; the crests meet round each corner.
      // Waves are counted on the outer edge, so every inset line runs parallel to it.
      const amplitude = 2.5
      const base = shrink(box, amplitude + inset)
      const outer = shrink(box, amplitude)
      const edges = corners(base)
      edges.forEach((start, index) => {
        const end = edges[(index + 1) % 4]
        const length = Math.hypot(end.x - start.x, end.y - start.y)
        const dx = (end.x - start.x) / length
        const dy = (end.y - start.y) / length
        const waves = Math.max(2, Math.round((index % 2 === 0 ? outer.w : outer.h) / 26))
        const count = waves * 14
        for (let step = 0; step <= count; step += 1) {
          const t = step / count
          const out = amplitude * Math.cos(Math.PI * 2 * waves * t)
          points.push({ x: start.x + dx * length * t + dy * out, y: start.y + dy * length * t - dx * out })
        }
        // Round the corner onto the next edge's first crest.
        const outAngle = Math.atan2(-dx, dy)
        arc(points, end.x, end.y, amplitude, amplitude, outAngle, outAngle + Math.PI / 2)
      })
      return points
    }
    case 'scalloped': {
      // Half circles along every edge, about 11 mm across.
      // Counted on the outer edge, so the scallops of an inset line sit inside the outer ones.
      const bump = 5.5
      const base = shrink(box, bump + inset)
      const outer = shrink(box, bump)
      const edges = corners(base)
      edges.forEach((start, index) => {
        const end = edges[(index + 1) % 4]
        const length = Math.hypot(end.x - start.x, end.y - start.y)
        const dx = (end.x - start.x) / length
        const dy = (end.y - start.y) / length
        const bumps = Math.max(2, Math.round((index % 2 === 0 ? outer.w : outer.h) / (bump * 2)))
        const radius = length / (bumps * 2)
        const angle = Math.atan2(dy, dx)
        for (let k = 0; k < bumps; k += 1) {
          const along = radius * (k * 2 + 1)
          arc(points, start.x + dx * along, start.y + dy * along, radius, radius, angle + Math.PI, angle + Math.PI * 2)
        }
      })
      return fitInto(points, inner)
    }
  }
}

/** A polygon as an SVG path. */
export const outlinePath = (points: Point[]): string =>
  `M${points.map((point) => `${round(point.x)} ${round(point.y)}`).join('L')}Z`

/** A polygon as a CSS `clip-path`, in percent of `box`. */
export const outlineClipPath = (points: Point[], box: Rect): string =>
  `polygon(${points.map((point) => `${round(((point.x - box.x) / box.w) * 100)}% ${round(((point.y - box.y) / box.h) * 100)}%`).join(',')})`

const round = (value: number): number => Math.round(value * 100) / 100

/** The outline's box: where the shaped background sits on the page. */
export const outlineBounds = boundsOf

/** One stroke of a template's frame along the outline (`ShapeFrame` rings, a double line as two). */
export type FrameStroke = { d: string; width: number; dash?: string; round?: boolean; opacity?: number; color?: string }

/** What a shaped page draws: its background's box and clip, the cut line, the frame. */
export type ShapeArt = { face: Rect; clipPath: string; cut: string; frame: FrameStroke[] }

/** Everything `SheetDocument` draws for a shaped sheet, in page millimetres. */
export const shapeArt = (shape: SheetShape, width: number, height: number, frame: ShapeFrame | undefined): ShapeArt => {
  const box = shapeBox(shape, width, height)
  const bleed = shapeOutline(shape, box, -SHAPE_BLEED)
  const face = boundsOf(bleed)
  const strokes: FrameStroke[] = []
  for (const ring of frame?.rings ?? []) {
    const line = ring.line ?? 'solid'
    const common = { opacity: ring.opacity, color: ring.color }
    // The CSS border box starts at the inset; the stroke is centred on its line.
    const at = (inset: number, strokeWidth: number) => outlinePath(shapeOutline(shape, box, inset + strokeWidth / 2))
    if (line === 'double') {
      const third = ring.width / 3
      strokes.push({ d: at(ring.inset, third), width: third, ...common })
      strokes.push({ d: at(ring.inset + third * 2, third), width: third, ...common })
    } else
      strokes.push({
        d: at(ring.inset, ring.width),
        width: ring.width,
        dash:
          line === 'dashed'
            ? `${round(Math.max(1.2, ring.width * 3))} ${round(Math.max(0.8, ring.width * 2))}`
            : line === 'dotted'
              ? `0 ${round(ring.width * 1.8)}`
              : undefined,
        round: line === 'dotted',
        ...common,
      })
  }
  return { face, clipPath: outlineClipPath(bleed, face), cut: outlinePath(shapeOutline(shape, box, 0)), frame: strokes }
}

/** Rows of the content table, mm apart. */
const ROW = 0.5

/**
 * Where content may sit on a shaped sheet: inside the outline drawn at the margin. Built once
 * per shape, page size and margin (`shapeRegion` keeps the last few), as a table of the room
 * across every half millimetre down the sheet.
 */
export type ShapeRegion = {
  /** The region's box. */
  bounds: Rect
  /** The centre line every shape is symmetric about. */
  cx: number
  /** The room across the whole band from `y0` to `y1` (left, right), or null. */
  span: (y0: number, y1: number) => [number, number] | null
  /**
   * The first top at or below `y` where a box from `x0` to `x1`, `h` tall, lies inside the
   * region and ends by `limit`; null when there is none.
   */
  fitFrom: (x0: number, x1: number, y: number, h: number, limit: number) => number | null
}

const buildRegion = (outline: Point[]): ShapeRegion => {
  const bounds = boundsOf(outline)
  const cx = bounds.x + bounds.w / 2
  const rows = Math.max(1, Math.ceil(bounds.h / ROW))
  const left = new Float64Array(rows + 1)
  const right = new Float64Array(rows + 1)
  for (let row = 0; row <= rows; row += 1) {
    // Just inside the very top and bottom, where a horizontal line touches a single point.
    const y = Math.min(bounds.y + bounds.h - 0.01, Math.max(bounds.y + 0.01, bounds.y + row * ROW))
    let l = -Infinity
    let r = Infinity
    let before = 0
    for (let index = 0; index < outline.length; index += 1) {
      const a = outline[index]
      const b = outline[(index + 1) % outline.length]
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        const x = a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y)
        if (x <= cx) {
          before += 1
          l = Math.max(l, x)
        } else r = Math.min(r, x)
      }
    }
    // The centre line outside the shape here (between two scallops): no room on this row.
    const inside = before % 2 === 1 && Number.isFinite(l) && Number.isFinite(r)
    left[row] = inside ? l : Infinity
    right[row] = inside ? r : -Infinity
  }

  const index = (y: number) => (y - bounds.y) / ROW
  // Between two rows the edge is straight but for the outline's own points — a scallop's cusp
  // juts in sharply between rows. Each point bounds the rows either side of it, so a band
  // that reaches a point sees it.
  for (const point of outline) {
    const at = index(point.y)
    for (const row of [Math.floor(at), Math.ceil(at)]) {
      if (row < 0 || row > rows) continue
      if (point.x <= cx) left[row] = Math.max(left[row], point.x)
      else right[row] = Math.min(right[row], point.x)
    }
  }

  const span = (y0: number, y1: number): [number, number] | null => {
    if (y0 < bounds.y - 0.01 || y1 > bounds.y + bounds.h + 0.01) return null
    const from = Math.max(0, Math.floor(index(y0)))
    const to = Math.min(rows, Math.ceil(index(y1)))
    let l = -Infinity
    let r = Infinity
    for (let row = from; row <= to; row += 1) {
      l = Math.max(l, left[row])
      r = Math.min(r, right[row])
    }
    return r - l > 0 ? [l, r] : null
  }

  // Per column (left and right edge): how many rows from each one down a box that wide fits.
  const runs = new Map<string, Int32Array>()
  const runsFor = (x0: number, x1: number): Int32Array => {
    const key = `${round(x0)}:${round(x1)}`
    let run = runs.get(key)
    if (!run) {
      run = new Int32Array(rows + 2)
      for (let row = rows; row >= 0; row -= 1) run[row] = left[row] <= x0 + 0.01 && right[row] >= x1 - 0.01 ? run[row + 1] + 1 : 0
      runs.set(key, run)
    }
    return run
  }

  const fitFrom = (x0: number, x1: number, y: number, h: number, limit: number): number | null => {
    const top = Math.max(y, bounds.y)
    const end = Math.min(limit, bounds.y + bounds.h)
    if (top + h > end + 0.01) return null
    const fits = (at: number) => {
      const room = span(at, at + h)
      return room !== null && room[0] <= x0 + 0.01 && room[1] >= x1 - 0.01
    }
    if (fits(top)) return top
    const run = runsFor(x0, x1)
    const need = Math.ceil(h / ROW) + 1
    for (let row = Math.ceil(index(top)); row <= rows; row += 1) {
      const at = bounds.y + row * ROW
      if (at + h > end + 0.01) return null
      if (run[row] >= need) return at
    }
    return null
  }

  return { bounds, cx, span, fitFrom }
}

const regions = new Map<string, ShapeRegion>()

/** The region a shaped sheet's content fits in: inside the outline drawn at `margin`. */
export const shapeRegion = (shape: SheetShape, width: number, height: number, margin: number): ShapeRegion => {
  const key = `${shape}:${width}:${height}:${margin}`
  let region = regions.get(key)
  if (!region) {
    region = buildRegion(shapeOutline(shape, shapeBox(shape, width, height), margin))
    // A few sheets at a time: the editor's, and the template previews'.
    if (regions.size >= 24) regions.delete(regions.keys().next().value as string)
    regions.set(key, region)
  }
  return region
}
