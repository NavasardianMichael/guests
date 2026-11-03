import type { ReactNode } from 'react'
import type { Viewport } from 'next'

/**
 * The editor is an app screen, so the page itself does not zoom: the canvas pinches its own
 * zoom (EditorCanvas), and iOS would otherwise zoom the whole page in on every tap into a
 * field whose text is under 16px — every field on a CV sheet — and leave it zoomed.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function EditorLayout({ children }: { children: ReactNode }) {
  return children
}
