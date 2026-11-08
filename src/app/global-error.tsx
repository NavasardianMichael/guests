'use client'

import { useEffect } from 'react'
import { DEFAULT_LOCALE } from '@constants/app'
import { reportError } from '@helpers/reportError'
import { fontUi } from '@styles/fonts'

/**
 * The root layout itself failed, so there are no providers (no translations, no antd): plain
 * markup and literal Armenian copy only.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError(error, 'global'), [error])

  return (
    <html lang={DEFAULT_LOCALE} className={fontUi.className}>
      <body style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', margin: 0 }}>
        <div style={{ textAlign: 'center' }}>
          <h1>Ինչ-որ բան սխալ գնաց</h1>
          <button type='button' onClick={reset} style={{ padding: '10px 20px', cursor: 'pointer' }}>
            Կրկին փորձել
          </button>
        </div>
      </body>
    </html>
  )
}
