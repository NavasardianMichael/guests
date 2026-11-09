'use client'

import type { FC } from 'react'
import { Collapse, Switch } from 'antd'
import { useTranslations } from 'next-intl'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import { TEXT_ROLES, type TextRole } from '@store/lists/single/types'
import { TABLE_STYLES, type TableStyle } from '@constants/templates'
import { TileButton } from '@components/ui/TileButton'
import { PanelSection, Row } from './LayoutPanel'
import { ColorField } from '../controls/ColorField'
import { LiveInput, LiveSlider } from '../controls/LiveFields'
import { TextStyleEditor } from '../controls/TextStyleEditor'

/** The sheet's look, after its template (`TemplatePanel`): texts, colours, decor, typography. */
export const DesignPanel: FC = () => {
  const t = useTranslations('Editor.design')
  const design = useListEditorStoreBase((state) => state.doc?.design)
  const texts = useListEditorStoreBase((state) => state.doc?.content)
  const setDesign = useListEditorStore.use.setDesign()
  const setPalette = useListEditorStore.use.setPalette()
  const setHeaderText = useListEditorStore.use.setHeaderText()
  if (!design || !texts) return null
  const roles: TextRole[] = design.kind === 'cards' ? ['name', 'group', 'subheading'] : [...TEXT_ROLES]

  return (
    <div>
      {design.kind !== 'cards' && (
        <PanelSection title={t('texts')} hint={t('textsHint')}>
          <LiveInput value={texts.heading} onChange={(text) => setHeaderText('heading', text)} placeholder={t('heading')} aria-label={t('heading')} maxLength={200} />
          <LiveInput
            value={texts.subheading}
            onChange={(text) => setHeaderText('subheading', text)}
            placeholder={t('subheading')}
            aria-label={t('subheading')}
            maxLength={200}
          />
          <LiveInput value={texts.footer} onChange={(text) => setHeaderText('footer', text)} placeholder={t('footer')} aria-label={t('footer')} maxLength={200} />
        </PanelSection>
      )}

      <PanelSection title={t('colors')} reset='design.colors'>
        <ColorField label={t('background')} value={design.palette.background} onChange={(background) => setPalette({ background })} />
        <ColorField label={t('accent')} value={design.palette.accent} onChange={(accent) => setPalette({ accent })} />
        <ColorField label={t('panel')} value={design.palette.panel} onChange={(panel) => setPalette({ panel })} />
        <Row label={t('decor')}>
          <Switch size='small' checked={design.decor} onChange={(decor) => setDesign({ decor })} />
        </Row>
      </PanelSection>

      {design.kind === 'seating' && (
        <PanelSection title={t('tableStyle')} reset='design.tableStyle'>
          {/* Tiles, not antd's Segmented: its items never wrap, so long names were cut to "Ընդ…". */}
          <div role='radiogroup' aria-label={t('tableStyle')} className='grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1.5'>
            {TABLE_STYLES.map((value: TableStyle) => (
              <TileButton
                key={value}
                role='radio'
                aria-checked={design.tableStyle === value}
                active={design.tableStyle === value}
                className='min-h-9 py-1.5 font-medium'
                onClick={() => setDesign({ tableStyle: value })}
              >
                {t(`tableStyles.${value}`)}
              </TileButton>
            ))}
          </div>
        </PanelSection>
      )}

      <PanelSection title={t('typography')} reset='design.typography'>
        <Row label={t('textScale')}>
          <span className='text-xs text-muted tabular-nums'>{Math.round(design.textScale * 100)}%</span>
        </Row>
        <LiveSlider
          min={0.4}
          max={4}
          step={0.05}
          value={design.textScale}
          onChange={(textScale) => setDesign({ textScale })}
          aria-label={t('textScale')}
          tooltip={{ formatter: (value) => `${Math.round((value ?? 1) * 100)}%` }}
        />
        <Collapse
          size='small'
          accordion
          defaultActiveKey={['name']}
          items={roles.map((role) => ({ key: role, label: t(`roles.${role}`), children: <TextStyleEditor role={role} /> }))}
        />
      </PanelSection>
    </div>
  )
}
