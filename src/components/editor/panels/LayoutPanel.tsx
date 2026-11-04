'use client'

import type { FC, ReactNode } from 'react'
import {
  AppstoreOutlined,
  BarsOutlined,
  ColumnHeightOutlined,
  DragOutlined,
  IdcardOutlined,
  RollbackOutlined,
  TableOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { Alert, Button, InputNumber, Segmented, Slider, Switch } from 'antd'
import { useTranslations } from 'next-intl'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import type { Flow, LayoutMode, PrintKind, SortOrder } from '@store/lists/single/types'
import { TileButton } from '@components/ui/TileButton'

export const PanelSection: FC<{ title: string; children: ReactNode; hint?: string }> = ({ title, children, hint }) => (
  <section className='border-b border-line py-4 first:pt-1 last:border-b-0'>
    <h3 className='m-0 mb-3 text-xs font-semibold tracking-wide text-muted uppercase'>{title}</h3>
    <div className='flex flex-col gap-3'>{children}</div>
    {hint && <p className='m-0 mt-2 text-xs leading-relaxed text-muted'>{hint}</p>}
  </section>
)

export const Row: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div className='flex items-center justify-between gap-3 text-sm'>
    <span className='min-w-0 leading-snug text-text'>{label}</span>
    <span className='flex shrink-0'>{children}</span>
  </div>
)

const KIND_ICONS: Record<PrintKind, ReactNode> = {
  seating: <TableOutlined />,
  list: <UnorderedListOutlined />,
  cards: <IdcardOutlined />,
}

/** Common place-card faces, mm. */
const CARD_PRESETS: { width: number; height: number }[] = [
  { width: 90, height: 50 },
  { width: 85, height: 55 },
  { width: 100, height: 70 },
  { width: 120, height: 60 },
]

/** What the sheet is, and how its blocks are arranged. */
export const LayoutPanel: FC = () => {
  const t = useTranslations('Editor.layout')
  const design = useListEditorStoreBase((state) => state.doc?.design)
  const setDesign = useListEditorStore.use.setDesign()
  const setLayout = useListEditorStore.use.setLayout()
  const resetPositions = useListEditorStore.use.resetPositions()
  if (!design) return null
  const { layout, kind } = design
  const pinned = Object.keys(layout.positions).length

  return (
    <div>
      <PanelSection title={t('kind')} hint={t(`kindHint.${kind}`)}>
        <div className='grid grid-cols-3 gap-2' role='radiogroup' aria-label={t('kind')}>
          {(['seating', 'list', 'cards'] as const).map((value) => (
            <TileButton
              key={value}
              role='radio'
              aria-checked={kind === value}
              active={kind === value}
              icon={KIND_ICONS[value]}
              onClick={() => setDesign({ kind: value })}
            >
              {t(`kinds.${value}`)}
            </TileButton>
          ))}
        </div>
      </PanelSection>

      <PanelSection title={t('arrangement')} hint={t(layout.mode === 'free' ? 'freeHint' : 'gridHint')}>
        <Segmented<LayoutMode>
          block
          value={layout.mode}
          onChange={(mode) => setLayout({ mode })}
          options={[
            { value: 'grid', label: t('grid'), icon: <AppstoreOutlined /> },
            { value: 'free', label: t('free'), icon: <DragOutlined /> },
          ]}
        />
        {pinned > 0 && (
          <Button icon={<RollbackOutlined />} onClick={() => resetPositions()}>
            {t('resetPositions', { count: pinned })}
          </Button>
        )}
      </PanelSection>

      {kind !== 'cards' && (
        <PanelSection title={t('grid')}>
          <Row label={t('columns')}>
            <InputNumber
              size='small'
              className='w-20'
              min={1}
              max={12}
              value={layout.columns}
              onChange={(columns) => columns && setLayout({ columns })}
              aria-label={t('columns')}
            />
          </Row>
          <Slider min={1} max={8} value={Math.min(8, layout.columns)} onChange={(columns) => setLayout({ columns })} aria-label={t('columns')} />
          <Row label={t('flow')}>
            <Segmented<Flow>
              size='small'
              value={layout.flow}
              onChange={(flow) => setLayout({ flow })}
              options={[
                { value: 'rows', label: t('flowRows'), icon: <BarsOutlined /> },
                { value: 'columns', label: t('flowColumns'), icon: <ColumnHeightOutlined /> },
              ]}
            />
          </Row>
          {layout.flow === 'columns' && (
            <Row label={t('balance')}>
              <Switch size='small' checked={layout.balance} onChange={(balance) => setLayout({ balance })} />
            </Row>
          )}
          <Row label={t('gapX')}>
            <InputNumber size='small' className='w-24' min={0} max={60} step={0.5} value={layout.gapX} suffix='mm' onChange={(gapX) => gapX !== null && setLayout({ gapX })} />
          </Row>
          <Row label={t('gapY')}>
            <InputNumber size='small' className='w-24' min={0} max={60} step={0.5} value={layout.gapY} suffix='mm' onChange={(gapY) => gapY !== null && setLayout({ gapY })} />
          </Row>
        </PanelSection>
      )}

      {kind === 'cards' && (
        <PanelSection title={t('cards')} hint={t('cardsHint')}>
          <div className='flex flex-wrap gap-1.5'>
            {CARD_PRESETS.map((preset) => (
              <Button
                key={`${preset.width}x${preset.height}`}
                size='small'
                type={layout.cardWidth === preset.width && layout.cardHeight === preset.height ? 'primary' : 'default'}
                onClick={() => setLayout({ cardWidth: preset.width, cardHeight: preset.height })}
              >
                {preset.width}×{preset.height}
              </Button>
            ))}
          </div>
          <Row label={t('cardWidth')}>
            <InputNumber size='small' className='w-24' min={30} max={300} value={layout.cardWidth} suffix='mm' onChange={(cardWidth) => cardWidth && setLayout({ cardWidth })} />
          </Row>
          <Row label={t('cardHeight')}>
            <InputNumber size='small' className='w-24' min={20} max={300} value={layout.cardHeight} suffix='mm' onChange={(cardHeight) => cardHeight && setLayout({ cardHeight })} />
          </Row>
          <Row label={t('cardFold')}>
            <Switch size='small' checked={layout.cardFold} onChange={(cardFold) => setLayout({ cardFold })} />
          </Row>
          <Row label={t('cutMarks')}>
            <Switch size='small' checked={layout.cutMarks} onChange={(cutMarks) => setLayout({ cutMarks })} />
          </Row>
          <Row label={t('gapX')}>
            <InputNumber size='small' className='w-24' min={0} max={30} step={0.5} value={layout.gapX} suffix='mm' onChange={(gapX) => gapX !== null && setLayout({ gapX })} />
          </Row>
          <Row label={t('gapY')}>
            <InputNumber size='small' className='w-24' min={0} max={30} step={0.5} value={layout.gapY} suffix='mm' onChange={(gapY) => gapY !== null && setLayout({ gapY })} />
          </Row>
        </PanelSection>
      )}

      <PanelSection title={t('content')}>
        <Row label={t('sort')}>
          <Segmented<SortOrder>
            size='small'
            value={layout.sort}
            onChange={(sort) => setLayout({ sort })}
            options={[
              { value: 'manual', label: t('sortManual') },
              { value: 'az', label: 'Ա→Ֆ' },
              { value: 'za', label: 'Ֆ→Ա' },
            ]}
          />
        </Row>
        {kind === 'list' && (
          <Row label={t('numbering')}>
            <Switch size='small' checked={layout.numbering} onChange={(numbering) => setLayout({ numbering })} />
          </Row>
        )}
        {kind !== 'seating' && (
          <Row label={t('showTable')}>
            <Switch size='small' checked={layout.showTable} onChange={(showTable) => setLayout({ showTable })} />
          </Row>
        )}
        {kind === 'cards' && (
          <Row label={t('showNote')}>
            <Switch size='small' checked={layout.showNote} onChange={(showNote) => setLayout({ showNote })} />
          </Row>
        )}
        {kind !== 'cards' && (
          <Row label={t('headerOnEveryPage')}>
            <Switch size='small' checked={layout.headerOnEveryPage} onChange={(headerOnEveryPage) => setLayout({ headerOnEveryPage })} />
          </Row>
        )}
      </PanelSection>

      {layout.mode === 'free' && <Alert type='info' showIcon className='mt-2 text-xs' title={t('freeTips')} />}
    </div>
  )
}
