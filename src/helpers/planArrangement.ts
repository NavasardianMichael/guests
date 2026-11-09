import type { PlanArrangement, VenueKind } from '@store/lists/single/types'
import type { ShapeRegion } from '@helpers/sheetShape'

/** A table or hall item to set out, mm; `venue` names a hall item's kind. */
export type HallItem = { id: string; w: number; h: number; venue?: VenueKind }

/** The room the hall is set out in (the body of the first page), mm, and the space kept between blocks. */
export type HallRoom = { x: number; y: number; w: number; h: number; gap: number; region: ShapeRegion | null }

type Spot = { x: number; y: number }

/** Points around an ellipse at equal distances along it, the first half a step clockwise from its top. */
const aroundEllipse = (cx: number, cy: number, rx: number, ry: number, count: number): Spot[] => {
  const SAMPLES = 720
  const points: Spot[] = []
  const lengths: number[] = [0]
  for (let i = 0; i <= SAMPLES; i += 1) {
    const angle = -Math.PI / 2 + (i / SAMPLES) * Math.PI * 2
    points.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) })
    if (i > 0) lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  }
  const total = lengths[SAMPLES]
  const spots: Spot[] = []
  let at = 0
  for (let n = 0; n < count; n += 1) {
    const want = ((n + 0.5) * total) / count
    while (at < SAMPLES && lengths[at + 1] < want) at += 1
    spots.push(points[at])
  }
  return spots
}

/** The length round an ellipse (Ramanujan's approximation). */
const perimeter = (rx: number, ry: number): number => Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)))

/**
 * The hall set out by a preset (not `rows`, which `placePlan` lays out itself): the first stage
 * at the top in the middle, the first entrance at the bottom in the middle, and between them
 *
 * - `around`: the dance floor in the middle, the tables round it on one ring — or more, when
 *   one round the room cannot seat them all;
 * - `sides`: the dance floor in the middle, the tables in columns down both sides of it;
 * - `banquet`: the dance floor under the stage, the (long) tables in rows below it.
 *
 * Everything goes on the first page. Whatever does not fit there — a block across the room's
 * edge or the shape's outline, or two blocks on top of each other — sets `overflow`, which
 * "fit to the page" answers with smaller letters (and so smaller tables).
 */
export const arrangeHall = (
  arrangement: Exclude<PlanArrangement, 'rows'>,
  items: HallItem[],
  room: HallRoom
): { placed: Map<string, Spot>; overflow: boolean } => {
  const placed = new Map<string, Spot>()
  const { gap } = room
  const cx = room.x + room.w / 2
  const top = room.y
  const bottom = room.y + room.h
  const first = (kind: VenueKind) => items.find((item) => item.venue === kind)
  const stage = first('stage')
  const floor = first('dancefloor')
  const entrance = first('entrance')
  const anchors = new Set([stage, floor, entrance].filter(Boolean))
  const seats = items.filter((item) => !anchors.has(item))
  /** A block centred on a point. */
  const centreOn = (item: HallItem, x: number, y: number) => placed.set(item.id, { x: x - item.w / 2, y: y - item.h / 2 })

  if (stage) placed.set(stage.id, { x: cx - stage.w / 2, y: top })
  if (entrance) placed.set(entrance.id, { x: cx - entrance.w / 2, y: bottom - entrance.h })
  const innerTop = stage ? top + stage.h + gap : top
  const innerBottom = entrance ? bottom - entrance.h - gap : bottom
  const innerH = Math.max(0, innerBottom - innerTop)
  // Every table gets the room of the largest, so rows and rings line up.
  const cellW = Math.max(0, ...seats.map((item) => item.w))
  const cellH = Math.max(0, ...seats.map((item) => item.h))

  if (arrangement === 'around') {
    const cy = innerTop + innerH / 2
    if (floor) centreOn(floor, cx, cy)
    const floorW = floor?.w ?? 0
    const floorH = floor?.h ?? 0
    const step = Math.max(cellW, cellH) + gap
    // The ring closest to the floor, and the widest the room takes.
    const inner = { rx: floorW / 2 + gap + cellW / 2, ry: floorH / 2 + gap + cellH / 2 }
    const outer = { rx: Math.max(inner.rx, room.w / 2 - cellW / 2), ry: Math.max(inner.ry, innerH / 2 - cellH / 2) }
    const fits = (rx: number, ry: number) => Math.max(1, Math.floor(perimeter(rx, ry) / step))
    let rings: { rx: number; ry: number }[] = []
    if (seats.length) {
      // One ring, as close to the floor as seats them all.
      for (let t = 0; t <= 1.0001 && !rings.length; t += 0.05) {
        const rx = inner.rx + (outer.rx - inner.rx) * t
        const ry = inner.ry + (outer.ry - inner.ry) * t
        if (fits(rx, ry) >= seats.length) rings = [{ rx, ry }]
      }
      // Or more, from the floor to the walls, as many as it takes.
      for (let count = 2; !rings.length && count <= 6; count += 1) {
        const set = Array.from({ length: count }, (_, k) => ({
          rx: inner.rx + ((outer.rx - inner.rx) * k) / (count - 1),
          ry: inner.ry + ((outer.ry - inner.ry) * k) / (count - 1),
        }))
        if (set.reduce((sum, ring) => sum + fits(ring.rx, ring.ry), 0) >= seats.length || count === 6) rings = set
      }
    }
    // The tables shared out by each ring's length.
    const capacity = rings.map((ring) => fits(ring.rx, ring.ry))
    const all = capacity.reduce((sum, n) => sum + n, 0)
    let left = seats.length
    let index = 0
    rings.forEach((ring, k) => {
      const count = k === rings.length - 1 ? left : Math.min(left, Math.round((seats.length * capacity[k]) / all))
      for (const spot of aroundEllipse(cx, cy, ring.rx, ring.ry, count)) centreOn(seats[index++], spot.x, spot.y)
      left -= count
    })
  } else if (arrangement === 'sides') {
    const floorW = floor?.w ?? 0
    if (floor) centreOn(floor, cx, innerTop + innerH / 2)
    const aisle = floor ? floorW / 2 + gap : gap
    const rows = Math.max(1, Math.floor((innerH + gap) / (cellH + gap)))
    const leftCount = Math.ceil(seats.length / 2)
    const sides: [HallItem[], 1 | -1][] = [
      [seats.slice(0, leftCount), -1],
      [seats.slice(leftCount), 1],
    ]
    for (const [group, side] of sides) {
      if (!group.length) continue
      const columns = Math.ceil(group.length / rows)
      const used = Math.ceil(group.length / columns)
      const y0 = innerTop + (innerH - (used * cellH + (used - 1) * gap)) / 2
      // Down the column by the dance floor first, then the next one out.
      group.forEach((item, n) => {
        const column = Math.floor(n / used)
        const row = n % used
        const middle = cx + side * (aisle + cellW / 2 + column * (cellW + gap))
        centreOn(item, middle, y0 + row * (cellH + gap) + cellH / 2)
      })
    }
  } else {
    let tablesTop = innerTop
    if (floor) {
      placed.set(floor.id, { x: cx - floor.w / 2, y: innerTop })
      tablesTop = innerTop + floor.h + gap
    }
    if (seats.length) {
      const bandH = Math.max(0, innerBottom - tablesTop)
      const most = Math.max(1, Math.floor((room.w + gap) / (cellW + gap)))
      const rows = Math.ceil(seats.length / most)
      const columns = Math.ceil(seats.length / rows)
      const gridW = columns * cellW + (columns - 1) * gap
      const gridH = rows * cellH + (rows - 1) * gap
      const x0 = cx - gridW / 2
      const y0 = tablesTop + Math.max(0, (bandH - gridH) / 2)
      seats.forEach((item, n) => {
        const row = Math.floor(n / columns)
        // The last row, when shorter, centred under the others.
        const inRow = row === rows - 1 ? seats.length - row * columns : columns
        const rowX = x0 + ((columns - inRow) * (cellW + gap)) / 2
        centreOn(item, rowX + (n % columns) * (cellW + gap) + cellW / 2, y0 + row * (cellH + gap) + cellH / 2)
      })
    }
  }

  // Across the room's edge, outside the outline, or on top of another: not set out in full.
  const boxes = items.flatMap((item) => {
    const at = placed.get(item.id)
    return at ? [{ ...at, w: item.w, h: item.h }] : []
  })
  const outside = boxes.some((box) => {
    if (box.x < room.x - 0.01 || box.y < top - 0.01 || box.x + box.w > room.x + room.w + 0.01 || box.y + box.h > bottom + 0.01) return true
    const span = room.region?.span(box.y, box.y + box.h)
    return room.region ? !span || box.x < span[0] - 0.01 || box.x + box.w > span[1] + 0.01 : false
  })
  const crossing = boxes.some((a, i) =>
    boxes.slice(i + 1).some((b) => a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01)
  )
  return { placed, overflow: outside || crossing }
}
