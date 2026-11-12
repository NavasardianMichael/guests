/**
 * What this browser says about its device, sent with a checkout so the admin's "checkout
 * started" mail can tell who is buying on what (`server/src/lib/request-info.ts`, which keeps
 * only these keys). Nothing here identifies the person; it is never used for a decision.
 */
export type ClientInfo = {
  timezone?: string
  languages?: string
  platform?: string
  mobile?: boolean
  screen?: string
  viewport?: string
  pixelRatio?: number
  touchPoints?: number
  cores?: number
  memoryGb?: number
  connection?: string
  colorScheme?: 'dark' | 'light'
  standalone?: boolean
}

/** Chromium-only navigator fields, absent from TypeScript's DOM lib. */
type ExtendedNavigator = Navigator & {
  userAgentData?: { platform?: string; mobile?: boolean }
  deviceMemory?: number
  connection?: { effectiveType?: string; downlink?: number }
}

/** Every read is optional: a field one browser lacks is simply left out. */
export const collectClientInfo = (): ClientInfo => {
  if (typeof window === 'undefined') return {}
  try {
    const nav = navigator as ExtendedNavigator
    const connection = nav.connection
    return {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      languages: nav.languages?.join(', ') || nav.language,
      platform: nav.userAgentData?.platform || nav.platform || undefined,
      mobile: nav.userAgentData?.mobile,
      screen: `${window.screen.width}×${window.screen.height}`,
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      pixelRatio: window.devicePixelRatio,
      touchPoints: nav.maxTouchPoints,
      cores: nav.hardwareConcurrency || undefined,
      memoryGb: nav.deviceMemory,
      connection: connection?.effectiveType
        ? `${connection.effectiveType}${connection.downlink ? `, ~${connection.downlink} Mbps` : ''}`
        : undefined,
      colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      standalone: window.matchMedia('(display-mode: standalone)').matches,
    }
  } catch {
    return {}
  }
}
