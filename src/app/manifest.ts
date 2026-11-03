import type { MetadataRoute } from 'next'
import { APP_DESCRIPTION, APP_NAME, LOCALE } from '@constants/app'
import { ROUTES } from '@constants/routes'
import { CANVAS, INK } from '@styles/tokens'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — Հայերեն ինքնակենսագրականի կառուցիչ`,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    lang: LOCALE,
    start_url: ROUTES.home,
    display: 'standalone',
    background_color: CANVAS.base,
    theme_color: INK[900],
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
