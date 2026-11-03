'use client'

import { type FC, useEffect, useMemo, useState } from 'react'
import type { ListDocument } from '@store/lists/single/types'
import { loadDocumentFonts } from '@hooks/useSheetLayout'
import { SITE_DOMAIN } from '@constants/app'
import { measureText, resetMeasureCache } from '@helpers/measureText'
import { layoutSheet } from '@helpers/sheetLayout'
import { SheetDocument } from '@components/sheet/SheetDocument'

/** Twin of `RenderDocument` in `server/src/services/pdf.ts`. */
type RenderDocument = ListDocument & { watermark?: boolean; watermarkText?: string }

declare global {
  interface Window {
    __SHEET_RENDER__?: RenderDocument
  }
}

/**
 * Prints the document the API's headless Chrome injected as `window.__SHEET_RENDER__`
 * (`server/src/services/pdf.ts`). Opened directly in a browser it shows nothing: there is no
 * id in the URL and no request for one, so this page cannot print anyone's list.
 *
 * Laid out only once every face is loaded — the layout measures text with them — and then
 * marked `data-sheet-ready`, which is what the API waits for before printing.
 */
export const RenderClient: FC = () => {
  const [doc, setDoc] = useState<RenderDocument | null>(null)
  const [fontsReady, setFontsReady] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Read after hydration: the injected global does not exist during the server render.
    const injected = window.__SHEET_RENDER__ ?? null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDoc(injected)
    if (!injected) return
    let active = true
    void loadDocumentFonts(injected)
      .then(() => document.fonts.ready)
      .then(() => {
        if (!active) return
        resetMeasureCache()
        setFontsReady(true)
      })
    return () => {
      active = false
    }
  }, [])

  const layout = useMemo(() => (doc && fontsReady ? layoutSheet(doc, measureText) : null), [doc, fontsReady])

  useEffect(() => {
    if (!doc || !layout) return
    document.title = doc.title
    const page = document.createElement('style')
    page.textContent = `@page { size: ${layout.width}mm ${layout.height}mm; margin: 0; }`
    document.head.appendChild(page)
    let active = true
    // The sheet's own faces settle after it is drawn; print once they have.
    void document.fonts.ready.then(() => active && setReady(true))
    return () => {
      active = false
      page.remove()
    }
  }, [doc, layout])

  if (!doc || !layout) return null
  return (
    <div data-sheet-ready={ready ? 'true' : 'false'}>
      <SheetDocument
        design={doc.design}
        layout={layout}
        pageOverlay={
          doc.watermark ? (
            <a className='sh-watermark' href={`https://${SITE_DOMAIN}/`}>
              {doc.watermarkText ?? SITE_DOMAIN}
            </a>
          ) : undefined
        }
      />
    </div>
  )
}
