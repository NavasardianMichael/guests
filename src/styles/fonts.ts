import localFont from 'next/font/local'

/**
 * The app's own type: GHEA Grapalat for every text, headings included (`font-display` is the
 * same face). The files are those of the sheet font in `public/fonts/`, but next/font copies
 * and renames them, so they are cached apart from the sheets' copy. next/font preloads the
 * faces and inlines the @font-face.
 *
 * Upright only: nothing in the interface is set in italic, and every face here is preloaded on
 * every page. A sheet's italic comes from the sheet fonts (`sheet-fonts.css`), not from here.
 *
 * next/font arguments must be literals — do not DRY these into a loop.
 */
export const fontUi = localFont({
  src: [
    { path: '../../public/fonts/ghea-grapalat/400.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/ghea-grapalat/700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-ui',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})
