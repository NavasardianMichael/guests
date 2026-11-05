import type { ReactElement } from 'react'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { APP_NAME } from '@constants/app'
import { type TemplateId, TEMPLATES } from '@constants/templates'
import { getSiteUrl } from '@helpers/url'
import { APRICOT, CANVAS, INK } from '@styles/tokens'
import { brandMark } from './brandImage'

/** The size every share preview expects (Facebook, LinkedIn, Telegram, X large card). */
export const SOCIAL_CARD_SIZE = { width: 1200, height: 630 }

type CardFont = { name: string; data: Buffer; weight: 500 | 700; style: 'normal' }

/**
 * Satori reads TTF/OTF/WOFF but not woff2, hence the two Mardoto TTFs (fonter.am's own files)
 * kept in src/assets/og. Read at build time: every card is prerendered.
 */
export const loadCardFonts = async (): Promise<CardFont[]> => {
  const [medium, bold] = await Promise.all([
    readFile(path.join(process.cwd(), 'src/assets/og/Mardoto-Medium.ttf')),
    readFile(path.join(process.cwd(), 'src/assets/og/Mardoto-Bold.ttf')),
  ])
  return [
    { name: 'Mardoto', data: medium, weight: 500, style: 'normal' },
    { name: 'Mardoto', data: bold, weight: 700, style: 'normal' },
  ]
}

type Sheet = { id: TemplateId; left: number; top: number; width: number; tilt: number }

const bar = (width: number | string, height: number, color: string, opacity = 1): ReactElement => (
  <div style={{ display: 'flex', width, height, borderRadius: height, background: color, opacity }} />
)

/** A seating board in miniature, in the template's own colours: a title, then tables. No text. */
const miniBoard = ({ id, left, top, width, tilt }: Sheet): ReactElement => {
  const { palette, heading, group, name } = TEMPLATES[id]
  const unit = width / 100
  const height = width * 1.414
  const table = (key: number, lines: number): ReactElement => (
    <div
      key={key}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2.2 * unit,
        width: 26 * unit,
        padding: 2.6 * unit,
        borderRadius: 1.6 * unit,
        border: `${0.5 * unit}px solid ${palette.accent}`,
        background: palette.panel,
      }}
    >
      {bar(14 * unit, 2 * unit, group.color)}
      {Array.from({ length: lines }, (_, index) => bar(`${70 + ((index * 13) % 25)}%`, 1.3 * unit, name.color, 0.55))}
    </div>
  )
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6 * unit,
        width,
        height,
        padding: 8 * unit,
        overflow: 'hidden',
        borderRadius: 1.6 * unit,
        background: palette.background,
        border: `${0.8 * unit}px solid ${palette.background}`,
        outline: `${0.4 * unit}px solid ${palette.accent}`,
        boxShadow: '0 28px 56px -18px rgba(20, 24, 45, 0.45)',
        transform: `rotate(${tilt}deg)`,
      }}
    >
      {bar(52 * unit, 5 * unit, heading.color)}
      {bar(30 * unit, 1.8 * unit, palette.accent, 0.8)}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 3.5 * unit }}>
        {[5, 6, 4, 6, 5, 4].map((lines, index) => table(index, lines))}
      </div>
    </div>
  )
}

type CardProps = {
  heading: string
  subheading: string
  /** Small facts along the bottom, as pills. */
  facts: string[]
  sheets: Sheet[]
}

/** The share preview: brand, heading and facts on the left, sheets on the right. */
export const socialCard = ({ heading, subheading, facts, sheets }: CardProps): ReactElement => (
  <div
    style={{
      position: 'relative',
      display: 'flex',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: `radial-gradient(760px 520px at 88% 30%, ${APRICOT[100]}, ${CANVAS.base} 72%)`,
      fontFamily: 'Mardoto',
      color: INK[900],
    }}
  >
    {sheets.map(miniBoard)}
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 660, padding: '60px 0 56px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {brandMark(60)}
        <span style={{ fontSize: 38, fontWeight: 700 }}>{APP_NAME}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <span style={{ fontSize: 58, fontWeight: 700, lineHeight: 1.1 }}>{heading}</span>
        <span style={{ fontSize: 30, fontWeight: 500, lineHeight: 1.3, color: INK[500] }}>{subheading}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {facts.map((fact) => (
            <span
              key={fact}
              style={{
                display: 'flex',
                padding: '8px 18px',
                borderRadius: 999,
                background: 'white',
                border: `1.5px solid ${INK[100]}`,
                fontSize: 22,
                fontWeight: 500,
                color: INK[700],
              }}
            >
              {fact}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {bar(44, 6, APRICOT[500])}
          <span style={{ fontSize: 22, fontWeight: 500, color: INK[500] }}>{getSiteUrl().replace(/^https?:\/\//, '')}</span>
        </div>
      </div>
    </div>
  </div>
)
