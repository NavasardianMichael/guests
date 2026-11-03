'use client'

import type { FC } from 'react'
import { Button, InputNumber, Segmented, Slider } from 'antd'
import { useTranslations } from 'next-intl'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import { type Orientation, PAPER_FORMATS, PAPER_LIMITS, PAPER_SIZES, type PaperFormat } from '@constants/paper'
import { pageSize } from '@helpers/sheetLayout'
import { PanelSection, Row } from './LayoutPanel'

const formatLabel = (format: PaperFormat): string =>
  format === 'letter' ? 'Letter' : format === 'legal' ? 'Legal' : format === 'custom' ? '' : format

/** The paper: a named size or any size, its orientation, its margins. */
export const PaperPanel: FC = () => {
  const t = useTranslations('Editor.paper')
  const paper = useListEditorStoreBase((state) => state.doc?.design.paper)
  const setPaper = useListEditorStore.use.setPaper()
  if (!paper) return null
  const size = pageSize(paper)

  return (
    <div>
      <PanelSection title={t('format')} hint={t('formatHint')}>
        <div className='grid grid-cols-3 gap-1.5'>
          {PAPER_FORMATS.map((format) => (
            <Button
              key={format}
              type={paper.format === format ? 'primary' : 'default'}
              className='h-auto flex-col gap-0 py-1.5'
              onClick={() => setPaper({ format })}
            >
              <span className='text-sm font-semibold'>{format === 'custom' ? t('custom') : formatLabel(format)}</span>
              <span className='text-[10px] opacity-70'>
                {format === 'custom' ? t('anySize') : `${PAPER_SIZES[format].width}×${PAPER_SIZES[format].height}`}
              </span>
            </Button>
          ))}
        </div>
        {paper.format === 'custom' && (
          <div className='flex items-center gap-2'>
            <InputNumber
              className='flex-1'
              size='small'
              min={PAPER_LIMITS.minSide}
              max={PAPER_LIMITS.maxSide}
              value={paper.width}
              suffix='mm'
              aria-label={t('width')}
              prefix={<span className='text-xs text-muted'>{t('widthShort')}</span>}
              onChange={(width) => width && setPaper({ width })}
            />
            <span className='text-muted'>×</span>
            <InputNumber
              className='flex-1'
              size='small'
              min={PAPER_LIMITS.minSide}
              max={PAPER_LIMITS.maxSide}
              value={paper.height}
              suffix='mm'
              aria-label={t('height')}
              prefix={<span className='text-xs text-muted'>{t('heightShort')}</span>}
              onChange={(height) => height && setPaper({ height })}
            />
          </div>
        )}
        <Row label={t('orientation')}>
          <Segmented<Orientation>
            size='small'
            value={paper.format === 'custom' ? (size.width > size.height ? 'landscape' : 'portrait') : paper.orientation}
            onChange={(orientation) => setPaper({ orientation })}
            options={[
              { value: 'portrait', label: t('portrait') },
              { value: 'landscape', label: t('landscape') },
            ]}
          />
        </Row>
        <p className='m-0 text-xs text-muted'>{t('size', { width: Math.round(size.width * 10) / 10, height: Math.round(size.height * 10) / 10 })}</p>
      </PanelSection>

      <PanelSection title={t('margin')} hint={t('marginHint')}>
        <Row label={t('margin')}>
          <InputNumber
            size='small'
            className='w-24'
            min={PAPER_LIMITS.minMargin}
            max={PAPER_LIMITS.maxMargin}
            value={paper.margin}
            suffix='mm'
            onChange={(margin) => margin !== null && setPaper({ margin })}
          />
        </Row>
        <Slider min={PAPER_LIMITS.minMargin} max={40} value={Math.min(40, paper.margin)} onChange={(margin) => setPaper({ margin })} aria-label={t('margin')} />
      </PanelSection>
    </div>
  )
}
