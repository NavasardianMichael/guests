/** Why leaving would cost something. One reason today: edits not saved yet. */
export type LeaveReason = 'unsaved'

export type LeaveGuardState = {
  /** Every active guard by its owner's id; the page is guarded while any exist. */
  guards: Record<string, LeaveReason>
  /** The open "leave this page?" question; `resolve` gets the user's answer. */
  question: { resolve: (leave: boolean) => void } | null
  /** The user agreed to leave: let the navigation through without asking again. */
  leaving: boolean
}

export type LeaveGuardActions = {
  setGuard: (id: string, reason: LeaveReason | null) => void
  /** Resolves true at once while nothing is guarded, otherwise once the user answers. */
  ask: () => Promise<boolean>
  answer: (leave: boolean) => void
}
