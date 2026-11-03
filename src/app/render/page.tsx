import type { Metadata } from 'next'
import { sheetFontFamily } from '@constants/fonts'
import { SheetFontsLink } from '@components/sheet/SheetFontsLink'
import { RenderClient } from './RenderClient'

export const metadata: Metadata = {
  title: 'Print',
  robots: { index: false, follow: false },
}

/**
 * The PDF print target (see RenderClient). `@page` gets the sheet's own size from the client
 * (any paper, custom included) with no margin: the sheet carries its margins itself. Next's
 * dev-tools badge is hidden so it never lands in a development PDF.
 */
const PRINT_CSS = `
html, body { margin: 0; padding: 0; }
nextjs-portal { display: none !important; }
.sh-watermark {
  position: absolute;
  right: 4mm;
  bottom: 2.5mm;
  font: 6.5pt/1 ${sheetFontFamily('ghea-grapalat')}, sans-serif;
  color: #808080;
  text-decoration: none;
  z-index: 50;
}
`

export default function RenderPage() {
  return (
    <>
      <SheetFontsLink />
      <style>{PRINT_CSS}</style>
      <RenderClient />
    </>
  )
}
