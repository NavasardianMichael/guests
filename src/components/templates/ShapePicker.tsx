'use client'

import type { FC } from 'react'
import { useTranslations } from 'next-intl'
import { SHEET_SHAPES, type SheetShape } from '@store/lists/single/types'
import { outlinePath, shapeBox, shapeOutline } from '@helpers/sheetShape'
import { TileButton } from '@components/ui/TileButton'

/**
 * Each shape drawn once on a portrait sheet, the tiles' icons: 60 × 80 mm, big enough for the
 * waves and scallops (sized in mm) to read as such, small enough for them to show at 28px.
 */
const ICONS: Record<SheetShape, string> = Object.fromEntries(
  SHEET_SHAPES.map((shape) => [shape, outlinePath(shapeOutline(shape, shapeBox(shape, 60, 80), 2))])
) as Record<SheetShape, string>

export const ShapeIcon: FC<{ shape: SheetShape; className?: string }> = ({ shape, className }) => (
  <svg viewBox='0 0 60 80' className={className} aria-hidden='true'>
    <path d={ICONS[shape]} fill='currentColor' fillOpacity={0.14} stroke='currentColor' strokeWidth={3.2} strokeLinejoin='round' />
  </svg>
)

type Props = { value: SheetShape; onChange: (shape: SheetShape) => void }

/**
 * The sheet's outline, as tiles. The editor's template step, the templates gallery and a template's page use it;
 * picking one redraws every template in that shape.
 */
export const ShapePicker: FC<Props> = ({ value, onChange }) => {
  const t = useTranslations('Shapes')
  return (
    <div role='radiogroup' aria-label={t('label')} className='grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-1.5'>
      {SHEET_SHAPES.map((shape) => (
        <TileButton
          key={shape}
          role='radio'
          aria-checked={value === shape}
          active={value === shape}
          icon={<ShapeIcon shape={shape} className='block h-7 w-auto' />}
          className='font-medium'
          onClick={() => onChange(shape)}
        >
          {t(`names.${shape}`)}
        </TileButton>
      ))}
    </div>
  )
}
