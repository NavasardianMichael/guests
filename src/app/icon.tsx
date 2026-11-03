import { ImageResponse } from 'next/og'
import { brandMark } from './brandImage'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(brandMark(512), size)
}
