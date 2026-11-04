'use client'

import { type FC, memo, useMemo } from 'react'
import { CheckCircleFilled } from '@ant-design/icons'
import { Collapse, Input, Segmented, Slider, Switch } from 'antd'
import { useTranslations } from 'next-intl'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import { TEXT_ROLES, type TextRole } from '@store/lists/single/types'
import { TABLE_STYLES, type TableStyle, TEMPLATE_LIST, type TemplateId } from '@constants/templates'
import { cn } from '@helpers/cn'
import { sampleContent, templateDesign } from '@helpers/listFactory'
import { SheetPreview } from '@components/sheet/SheetPreview'
import { PanelSection, Row } from './LayoutPanel'
import { ColorField } from '../controls/ColorField'
import { TextStyleEditor } from '../controls/TextStyleEditor'

/** A template's card: its look on a short sample list, in the sheet's own kind. */
const TemplateThumb: FC<{ id: TemplateId; kind: Parameters<typeof templateDesign>[1]; active: boolean; onPick: () => void }> = memo(
  function TemplateThumb({ id, kind, active, onPick }) {
    const t = useTranslations('Templates')
    const tSamples = useTranslations('Samples')
    const doc = useMemo(
      () => ({
        title: '',
        content: sampleContent(
          {
            heading: tSamples('heading'),
            subheading: tSamples('subheading'),
            footer: tSamples('footer'),
            table: (number) => tSamples('table', { number }),
          },
          kind === 'cards' ? 2 : 6
        ),
        design: templateDesign(id, kind),
      }),
      [id, kind, tSamples]
    )
    const free = TEMPLATE_LIST.find((template) => template.id === id)?.free
    return (
      <button
        type='button'
        onClick={onPick}
        aria-pressed={active}
        className={cn(
          'group relative cursor-pointer overflow-hidden rounded-lg border-2 bg-surface p-0 text-left transition',
          active ? 'border-accent' : 'border-transparent ring-1 ring-line hover:ring-ink/30'
        )}
      >
        <SheetPreview doc={doc} />
        {free && (
          <span className='absolute top-1 left-1 rounded-full bg-ink/85 px-1.5 py-0.5 text-[9px] leading-none font-semibold text-white shadow-sm'>
            {t('free')}
          </span>
        )}
        <span className='block truncate px-1.5 py-1 text-center text-[11px] font-medium' title={t(`names.${id}`)}>
          {t(`names.${id}`)}
        </span>
        {active && <CheckCircleFilled className='absolute top-1.5 right-1.5 text-accent' />}
      </button>
    )
  }
)

/** The sheet's look: template, texts, colours, decor, typography. */
export const DesignPanel: FC = () => {
  const t = useTranslations('Editor.design')
  const design = useListEditorStoreBase((state) => state.doc?.design)
  const texts = useListEditorStoreBase((state) => state.doc?.content)
  const applyTemplate = useListEditorStore.use.applyTemplate()
  const setDesign = useListEditorStore.use.setDesign()
  const setPalette = useListEditorStore.use.setPalette()
  const setHeaderText = useListEditorStore.use.setHeaderText()
  if (!design || !texts) return null
  const roles: TextRole[] = design.kind === 'cards' ? ['name', 'group', 'subheading'] : [...TEXT_ROLES]

  return (
    <div>
      <PanelSection title={t('templates')} hint={t('templatesHint')}>
        <div className='grid grid-cols-3 gap-2'>
          {TEMPLATE_LIST.map((template) => (
            <TemplateThumb
              key={template.id}
              id={template.id}
              kind={design.kind}
              active={design.templateId === template.id}
              onPick={() => applyTemplate(template.id)}
            />
          ))}
        </div>
      </PanelSection>

      {design.kind !== 'cards' && (
        <PanelSection title={t('texts')} hint={t('textsHint')}>
          <Input value={texts.heading} onChange={(event) => setHeaderText('heading', event.target.value)} placeholder={t('heading')} aria-label={t('heading')} maxLength={200} />
          <Input
            value={texts.subheading}
            onChange={(event) => setHeaderText('subheading', event.target.value)}
            placeholder={t('subheading')}
            aria-label={t('subheading')}
            maxLength={200}
          />
          <Input value={texts.footer} onChange={(event) => setHeaderText('footer', event.target.value)} placeholder={t('footer')} aria-label={t('footer')} maxLength={200} />
        </PanelSection>
      )}

      <PanelSection title={t('colors')}>
        <ColorField label={t('background')} value={design.palette.background} onChange={(background) => setPalette({ background })} />
        <ColorField label={t('accent')} value={design.palette.accent} onChange={(accent) => setPalette({ accent })} />
        <ColorField label={t('panel')} value={design.palette.panel} onChange={(panel) => setPalette({ panel })} />
        <Row label={t('decor')}>
          <Switch size='small' checked={design.decor} onChange={(decor) => setDesign({ decor })} />
        </Row>
      </PanelSection>

      {design.kind === 'seating' && (
        <PanelSection title={t('tableStyle')}>
          <Segmented<TableStyle>
            block
            size='small'
            className='flex-wrap'
            value={design.tableStyle}
            onChange={(tableStyle) => setDesign({ tableStyle })}
            options={TABLE_STYLES.map((value) => ({ value, label: t(`tableStyles.${value}`) }))}
          />
        </PanelSection>
      )}

      <PanelSection title={t('typography')}>
        <Row label={t('textScale')}>
          <span className='text-xs text-muted tabular-nums'>{Math.round(design.textScale * 100)}%</span>
        </Row>
        <Slider
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
