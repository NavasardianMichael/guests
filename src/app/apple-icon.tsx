import { ImageResponse } from 'next/og'
import { CANVAS } from '@styles/tokens'
import { brandMark } from './brandImage'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/** iOS masks the icon itself and shows transparency as black, so it gets a solid ground. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: CANVAS.base }}>
        {brandMark(140)}
      </div>
    ),
    size
  )
}
