'use client'

import { type FC, useMemo } from 'react'
import { Select } from 'antd'
import { useTranslations } from 'next-intl'
import { FONT_CATEGORY_ORDER, FONT_SLUGS, FONTS, type FontSlug, sheetFontStack } from '@constants/fonts'

type Props = {
  value: FontSlug
  onChange: (value: FontSlug) => void
  ariaLabel: string
}

const SAMPLE = 'Աբգդ Аб Ab'

/** Every option is drawn in its own face, with an Armenian sample beside the name. */
export const FontSelect: FC<Props> = ({ value, onChange, ariaLabel }) => {
  const t = useTranslations('Editor.design')

  const options = useMemo(
    () =>
      FONT_CATEGORY_ORDER.map((category) => ({
        label: t(`fontCategories.${category}`),
        options: FONT_SLUGS.filter((slug) => FONTS[slug].category === category).map((slug) => ({
          value: slug,
          name: FONTS[slug].name,
          label: (
            <span className='flex items-baseline justify-between gap-3' style={{ fontFamily: sheetFontStack(slug) }}>
              <span className='truncate text-[15px]'>{FONTS[slug].name}</span>
              <span className='shrink-0 text-[15px] opacity-60'>{SAMPLE}</span>
            </span>
          ),
        })),
      })),
    [t]
  )

  return (
    <Select<FontSlug>
      className='w-full'
      value={value}
      onChange={onChange}
      options={options}
      aria-label={ariaLabel}
      showSearch={{
        filterOption: (input, option) =>
          Boolean(option && 'name' in option && String(option.name).toLowerCase().includes(input.toLowerCase())),
      }}
      listHeight={360}
      popupMatchSelectWidth={320}
    />
  )
}
