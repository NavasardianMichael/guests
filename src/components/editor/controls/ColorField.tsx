'use client'

import type { FC } from 'react'
import { ColorPicker } from 'antd'
import { useTranslations } from 'next-intl'
import { useListEditorStoreBase } from '@store/lists/single/store'
import { TEMPLATE_LIST } from '@constants/templates'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
}

const TEMPLATE_ACCENTS = [...new Set(TEMPLATE_LIST.flatMap((template) => [template.palette.accent, template.palette.background]))]

/**
 * A colour, as the document stores it: `#rrggbb` (the API accepts six-digit hex only, so any
 * alpha is dropped). Presets: the sheet's own colours first, then every template's.
 */
export const ColorField: FC<Props> = ({ label, value, onChange }) => {
  const t = useTranslations('Editor.design')
  const palette = useListEditorStoreBase((state) => state.doc?.design.palette)

  const presets = [
    ...(palette ? [{ label: t('sheetColors'), colors: Object.values(palette), defaultOpen: true }] : []),
    { label: t('templateColors'), colors: TEMPLATE_ACCENTS, defaultOpen: false },
  ]

  return (
    <label className='flex items-center justify-between gap-3 py-1 text-sm'>
      <span className='text-muted'>{label}</span>
      <ColorPicker
        value={value}
        disabledAlpha
        presets={presets}
        size='small'
        showText={(color) => color.toHexString().slice(0, 7).toUpperCase()}
        onChange={(color) => onChange(color.toHexString().slice(0, 7))}
      />
    </label>
  )
}
