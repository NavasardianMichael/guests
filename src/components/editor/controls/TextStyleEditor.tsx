'use client'

import type { FC } from 'react'
import { AlignCenterOutlined, AlignLeftOutlined, AlignRightOutlined, BoldOutlined, FontSizeOutlined, ItalicOutlined } from '@ant-design/icons'
import { Button, ColorPicker, InputNumber, Segmented, Slider, Tooltip } from 'antd'
import { useTranslations } from 'next-intl'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import type { Align, TextRole } from '@store/lists/single/types'
import { FontSelect } from './FontSelect'

/** Point sizes a text may take (before the sheet's text scale). Twin: `TEXT_LIMITS` on the server. */
export const SIZE_MIN = 5
export const SIZE_MAX = 120

type Props = { role: TextRole }

/** One text role's typography: face, size, colour, weight, slant, capitals, spacing, alignment. */
export const TextStyleEditor: FC<Props> = ({ role }) => {
  const t = useTranslations('Editor.design')
  const style = useListEditorStoreBase((state) => state.doc?.design.type[role])
  const setTextStyle = useListEditorStore.use.setTextStyle()
  if (!style) return null
  const set = (patch: Parameters<typeof setTextStyle>[1]) => setTextStyle(role, patch)

  return (
    <div className='flex flex-col gap-2.5'>
      <FontSelect value={style.font} onChange={(font) => set({ font })} ariaLabel={t('font')} />
      <div className='flex items-center gap-2'>
        <InputNumber
          className='w-24'
          size='small'
          min={SIZE_MIN}
          max={SIZE_MAX}
          step={0.5}
          value={style.size}
          suffix='pt'
          aria-label={t('size')}
          prefix={<FontSizeOutlined className='text-muted' />}
          onChange={(size) => typeof size === 'number' && set({ size })}
        />
        <ColorPicker
          size='small'
          disabledAlpha
          value={style.color}
          aria-label={t('color')}
          onChange={(color) => set({ color: color.toHexString().slice(0, 7) })}
        />
        <div className='ml-auto flex gap-0.5'>
          <Tooltip title={t('bold')}>
            <Button
              size='small'
              type={style.bold ? 'primary' : 'text'}
              icon={<BoldOutlined />}
              aria-pressed={style.bold}
              aria-label={t('bold')}
              onClick={() => set({ bold: !style.bold })}
            />
          </Tooltip>
          <Tooltip title={t('italic')}>
            <Button
              size='small'
              type={style.italic ? 'primary' : 'text'}
              icon={<ItalicOutlined />}
              aria-pressed={style.italic}
              aria-label={t('italic')}
              onClick={() => set({ italic: !style.italic })}
            />
          </Tooltip>
          <Tooltip title={t('uppercase')}>
            <Button
              size='small'
              type={style.uppercase ? 'primary' : 'text'}
              aria-pressed={style.uppercase}
              aria-label={t('uppercase')}
              onClick={() => set({ uppercase: !style.uppercase })}
            >
              Աա
            </Button>
          </Tooltip>
        </div>
      </div>
      <div className='flex items-center gap-3'>
        <Segmented<Align>
          size='small'
          value={style.align}
          onChange={(align) => set({ align })}
          options={[
            { value: 'left', icon: <AlignLeftOutlined />, title: t('alignLeft') },
            { value: 'center', icon: <AlignCenterOutlined />, title: t('alignCenter') },
            { value: 'right', icon: <AlignRightOutlined />, title: t('alignRight') },
          ]}
        />
        <span className='shrink-0 text-xs text-muted'>{t('tracking')}</span>
        <Slider
          className='min-w-0 flex-1'
          min={-5}
          max={40}
          value={style.tracking}
          onChange={(tracking) => set({ tracking })}
          aria-label={t('tracking')}
        />
      </div>
    </div>
  )
}
