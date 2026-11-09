'use client'

import { useEffect, useState } from 'react'
import { getCapabilitiesAPI } from '@api/app/main'
import type { AppCapabilities } from '@api/app/types'
import { reportError } from '@helpers/reportError'

/** One request per page load, shared by every caller. */
let pending: Promise<AppCapabilities | null> | null = null

const load = (): Promise<AppCapabilities | null> => {
  pending ??= getCapabilitiesAPI().catch((error: unknown) => {
    reportError(error, 'capabilities')
    pending = null
    return null
  })
  return pending
}

/** What the API offers right now (Google, AI import, payments); null while loading or unreachable. */
export const useCapabilities = (): AppCapabilities | null => {
  const [capabilities, setCapabilities] = useState<AppCapabilities | null>(null)
  useEffect(() => {
    let active = true
    void load().then((value) => active && setCapabilities(value))
    return () => {
      active = false
    }
  }, [])
  return capabilities
}
