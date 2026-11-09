'use client'

import type { FC } from 'react'
import { Segmented } from 'antd'
import { useTranslations } from 'next-intl'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import { type Orientation, PAPER_FORMATS, PAPER_LIMITS, PAPER_SIZES, type PaperFormat } from '@constants/paper'
import { pageSize } from '@helpers/sheetLayout'
import { TileButton } from '@components/ui/TileButton'
import { PanelSection, Row } from './LayoutPanel'
import { LiveInputNumber, LiveSlider } from '../controls/LiveFields'

const formatLabel = (format: PaperFormat): string =>
  format === 'letter' ? 'Letter' : format === 'custom' ? '' : format

/** The paper: a named size or any size, its orientation, its margins. */
export const PaperPanel: FC = () => {
  const t = useTranslations('Editor.paper')
  const tEditor = useTranslations('Editor')
  const paper = useListEditorStoreBase((state) => state.doc?.design.paper)
  const setPaper = useListEditorStore.use.setPaper()
  if (!paper) return null
  const size = pageSize(paper)

  return (
    <div>
      <PanelSection title={t('format')} hint={t('formatHint')} reset='paper.format'>
        <div className='grid grid-cols-3 gap-2' role='radiogroup' aria-label={t('format')}>
          {PAPER_FORMATS.map((format) => (
            <TileButton
              key={format}
              role='radio'
              aria-checked={paper.format === format}
              active={paper.format === format}
              caption={format === 'custom' ? t('anySize') : `${PAPER_SIZES[format].width}×${PAPER_SIZES[format].height}`}
              onClick={() => setPaper({ format })}
            >
              <span className='text-sm'>{format === 'custom' ? t('custom') : formatLabel(format)}</span>
            </TileButton>
          ))}
        </div>
        {paper.format === 'custom' && (
          <div className='flex items-end gap-2'>
            <label className='flex min-w-0 flex-1 flex-col gap-1'>
              <span className='text-xs text-muted'>{t('width')}</span>
              <LiveInputNumber
                style={{ width: '100%' }}
                size='small'
                min={PAPER_LIMITS.minSide}
                max={PAPER_LIMITS.maxSide}
                value={paper.width}
                suffix={tEditor('mm')}
                onChange={(width) => width && setPaper({ width })}
              />
            </label>
            <span className='pb-0.5 text-muted'>×</span>
            <label className='flex min-w-0 flex-1 flex-col gap-1'>
              <span className='text-xs text-muted'>{t('height')}</span>
              <LiveInputNumber
                style={{ width: '100%' }}
                size='small'
                min={PAPER_LIMITS.minSide}
                max={PAPER_LIMITS.maxSide}
                value={paper.height}
                suffix={tEditor('mm')}
                onChange={(height) => height && setPaper({ height })}
              />
            </label>
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

      <PanelSection title={t('margin')} hint={t('marginHint')} reset='paper.margin'>
        <Row label={t('margin')}>
          <LiveInputNumber
            size='small'
            className='w-36'
            min={PAPER_LIMITS.minMargin}
            max={PAPER_LIMITS.maxMargin}
            value={paper.margin}
            suffix={tEditor('mm')}
            onChange={(margin) => margin !== null && setPaper({ margin })}
          />
        </Row>
        <LiveSlider min={PAPER_LIMITS.minMargin} max={40} value={Math.min(40, paper.margin)} onChange={(margin) => setPaper({ margin })} aria-label={t('margin')} />
      </PanelSection>
    </div>
  )
}
