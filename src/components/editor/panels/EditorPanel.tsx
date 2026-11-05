'use client'

import type { FC, ReactNode } from 'react'
import { AppstoreAddOutlined, ArrowLeftOutlined, ArrowRightOutlined, BgColorsOutlined, FileOutlined, LayoutOutlined, TeamOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useTranslations } from 'next-intl'
import { type EditorTab, useEditorUiStore } from '@store/editorUi/store'
import { DesignPanel } from './DesignPanel'
import { GuestsPanel } from './GuestsPanel'
import { KindPanel } from './KindPanel'
import { LayoutPanel } from './LayoutPanel'
import { PaperPanel } from './PaperPanel'
import { ResetButton } from '../controls/ResetButton'
import { PdfActions } from '../PdfActions'

/**
 * The steps, in order: what is being made, how it looks (on sample guests until there are real
 * ones), the guests, how they are arranged, and the paper.
 */
export const EDITOR_TABS: EditorTab[] = ['kind', 'design', 'guests', 'layout', 'paper']

export const TAB_ICONS: Record<EditorTab, ReactNode> = {
  kind: <AppstoreAddOutlined />,
  guests: <TeamOutlined />,
  layout: <LayoutOutlined />,
  design: <BgColorsOutlined />,
  paper: <FileOutlined />,
}

export const PanelBody: FC<{ tab: EditorTab }> = ({ tab }) => {
  if (tab === 'kind') return <KindPanel />
  if (tab === 'guests') return <GuestsPanel />
  if (tab === 'layout') return <LayoutPanel />
  if (tab === 'design') return <DesignPanel />
  return <PaperPanel />
}

/** A tab's reset: every settings tab has one; the guests and the kind are content and a choice, not settings. */
export const TabResetButton: FC<{ tab: EditorTab }> = ({ tab }) => {
  const t = useTranslations('Editor.tabs')
  if (tab === 'guests' || tab === 'kind') return null
  return <ResetButton scope={tab} name={t(tab)} variant='tab' />
}

/**
 * The desktop settings column: the current step only (the steps themselves run across the top,
 * `EditorSteps`), with Back / Next at its foot and printing after the last step. Only the open
 * step is mounted — the design step draws sixteen previews.
 */
export const EditorPanel: FC = () => {
  const t = useTranslations('Editor')
  const tCommon = useTranslations('Common')
  const tab = useEditorUiStore.use.tab()
  const openTab = useEditorUiStore.use.openTab()
  const index = EDITOR_TABS.indexOf(tab)
  const previous = EDITOR_TABS[index - 1]
  const next = EDITOR_TABS[index + 1]

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      {/* Keyed by step, so a new step opens scrolled to its top. */}
      <div key={tab} className='min-h-0 flex-1 scrollbar-thin overflow-y-auto px-4 pt-4 pb-8'>
        <header className='mb-4'>
          <div className='flex items-center justify-between gap-2'>
            <p className='m-0 text-[11px] font-semibold tracking-wider text-accent-strong uppercase'>
              {t('steps.step', { number: index + 1, count: EDITOR_TABS.length })}
            </p>
            <TabResetButton tab={tab} />
          </div>
          <h2 className='m-0 mt-0.5 text-lg leading-snug font-semibold text-ink'>{t(`tabs.${tab}`)}</h2>
          <p className='m-0 mt-0.5 text-xs leading-snug text-muted'>{t(`steps.hints.${tab}`)}</p>
        </header>
        <PanelBody tab={tab} />
      </div>
      <footer className='flex shrink-0 items-center gap-2 border-t border-line bg-surface px-4 py-3'>
        {previous && (
          <Button icon={<ArrowLeftOutlined />} onClick={() => openTab(previous)}>
            {tCommon('back')}
          </Button>
        )}
        <div className='ml-auto'>
          {next ? (
            <Button type='primary' icon={<ArrowRightOutlined />} iconPlacement='end' onClick={() => openTab(next)}>
              {t('steps.next', { step: t(`tabs.${next}`) })}
            </Button>
          ) : (
            <PdfActions printLabel />
          )}
        </div>
      </footer>
    </div>
  )
}
