import type { ReactElement } from 'react'
import { APRICOT, INK } from '@styles/tokens'

/**
 * The brand mark as plain JSX for `next/og` (satori), which renders a subset of CSS and no
 * Tailwind. Shared by the favicon, the Apple icon and the OpenGraph card.
 */
export const brandMark = (size: number): ReactElement => {
  const unit = size / 32
  return (
    <div style={{ display: 'flex', position: 'relative', width: size, height: size }}>
      <div
        style={{
          position: 'absolute',
          left: 5 * unit,
          top: 3 * unit,
          width: 22 * unit,
          height: 26 * unit,
          borderRadius: 4 * unit,
          background: INK[900],
          display: 'flex',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 19 * unit,
          top: 3 * unit,
          width: 8 * unit,
          height: 8 * unit,
          borderTopRightRadius: 4 * unit,
          background: `linear-gradient(225deg, ${APRICOT[500]} 50%, transparent 50%)`,
          display: 'flex',
        }}
      />
      <div style={{ position: 'absolute', left: 9 * unit, top: 10 * unit, width: 9 * unit, height: 2.4 * unit, borderRadius: unit, background: APRICOT[500], display: 'flex' }} />
      {[15, 19, 23].map((top, index) => (
        <div
          key={top}
          style={{
            position: 'absolute',
            left: 9 * unit,
            top: top * unit,
            width: (index === 0 ? 14 : 12) * unit,
            height: 1.8 * unit,
            borderRadius: unit,
            background: 'white',
            opacity: index === 0 ? 0.85 : 0.6,
            display: 'flex',
          }}
        />
      ))}
    </div>
  )
}
