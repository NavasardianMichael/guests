'use client'

import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@store/auth/store'
import { ROUTES } from '@constants/routes'
import { isSafeReturnPath } from '@helpers/url'

/**
 * Where an auth page sends the user once signed in: `returnTo` when it is a same-site path,
 * the dashboard otherwise. Also leaves the page at once if a session already exists.
 */
export const useAuthRedirect = (returnTo: string | undefined): (() => void) => {
  const router = useRouter()
  const user = useAuthStore.use.user()
  const destination = isSafeReturnPath(returnTo) ? returnTo : ROUTES.dashboard

  const go = useCallback(() => router.replace(destination), [destination, router])

  useEffect(() => {
    if (user) go()
  }, [user, go])

  return go
}
