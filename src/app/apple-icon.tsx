import { ImageResponse } from 'next/og'
import { INK } from '@styles/tokens'
import { brandMark } from './brandImage'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/**
 * iOS rounds the icon itself and shows transparency as black, so the tile's own colour fills
 * the square under the mark and the mask's corners never show the page.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: INK[900] }}>
        {brandMark(180)}
      </div>
    ),
    size
  )
}
