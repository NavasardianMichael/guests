import { PLAN_ARRANGEMENTS, type PlanArrangement, PRINT_KINDS, type PrintKind } from '@store/lists/single/types'
import { ARRANGEMENT_QUERY, KIND_QUERY } from '@constants/routes'

const one = (value: string | string[] | undefined): string | null => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null))

const isKind = (value: string | null): value is PrintKind => !!value && (PRINT_KINDS as readonly string[]).includes(value)

const isArrangement = (value: string | null): value is PlanArrangement =>
  !!value && (PLAN_ARRANGEMENTS as readonly string[]).includes(value)

/** `?kind=` and `?arrangement=` from a gallery URL, or the defaults when they are absent or unknown. */
export const viewFromQuery = (query: Record<string, string | string[] | undefined>): { kind: PrintKind; arrangement: PlanArrangement } => {
  const kind = one(query[KIND_QUERY])
  const arrangement = one(query[ARRANGEMENT_QUERY])
  return {
    kind: isKind(kind) ? kind : 'seating',
    arrangement: isArrangement(arrangement) ? arrangement : 'rows',
  }
}
