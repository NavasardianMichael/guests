import localFont from 'next/font/local'

/**
 * The app's own type: GHEA Grapalat for every text, headings included (`font-display` is the
 * same face). It is from the self-hosted CV set in `public/fonts/`, so a visitor who opens the
 * editor already has it cached. next/font preloads the faces and inlines the @font-face.
 *
 * next/font arguments must be literals — do not DRY these into a loop.
 */
export const fontUi = localFont({
  src: [
    { path: '../../public/fonts/ghea-grapalat/400.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/ghea-grapalat/400-italic.woff2', weight: '400', style: 'italic' },
    { path: '../../public/fonts/ghea-grapalat/700.woff2', weight: '700', style: 'normal' },
    { path: '../../public/fonts/ghea-grapalat/700-italic.woff2', weight: '700', style: 'italic' },
  ],
  variable: '--font-ui',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})
