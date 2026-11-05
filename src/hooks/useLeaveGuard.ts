import { useEffect, useId } from 'react'
import { useLeaveGuardStoreBase } from '@store/navigation/guard/store'
import type { LeaveReason } from '@store/navigation/guard/types'

/**
 * Asks before the page is left while `reason` is set — edits not saved yet. Closing the tab
 * or reloading gets the browser's own dialog; links and the back button get ours
 * (`LeaveGuard`). Pass `null` (or `false`) when there is nothing to lose.
 */
export const useLeaveGuard = (reason: LeaveReason | null | false): void => {
  const id = useId()
  const setGuard = useLeaveGuardStoreBase((state) => state.setGuard)

  useEffect(() => {
    setGuard(id, reason || null)
    return () => setGuard(id, null)
  }, [id, reason, setGuard])
}

/**
 * For a navigation that is not a link (a router call behind a button): asks the question of
 * the guard that is up, if any. True when there is nothing to ask or the user agreed.
 */
export const confirmLeave = (): Promise<boolean> => useLeaveGuardStoreBase.getState().ask()
