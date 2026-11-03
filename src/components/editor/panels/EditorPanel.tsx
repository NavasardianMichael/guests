'use client'

import type { FC, ReactNode } from 'react'
import { BgColorsOutlined, FileOutlined, LayoutOutlined, TeamOutlined } from '@ant-design/icons'
import { Tabs } from 'antd'
import { useTranslations } from 'next-intl'
import { type EditorTab, useEditorUiStore } from '@store/editorUi/store'
import { DesignPanel } from './DesignPanel'
import { GuestsPanel } from './GuestsPanel'
import { LayoutPanel } from './LayoutPanel'
import { PaperPanel } from './PaperPanel'

export const EDITOR_TABS: EditorTab[] = ['guests', 'layout', 'design', 'paper']

export const TAB_ICONS: Record<EditorTab, ReactNode> = {
  guests: <TeamOutlined />,
  layout: <LayoutOutlined />,
  design: <BgColorsOutlined />,
  paper: <FileOutlined />,
}

export const PanelBody: FC<{ tab: EditorTab }> = ({ tab }) => {
  if (tab === 'guests') return <GuestsPanel />
  if (tab === 'layout') return <LayoutPanel />
  if (tab === 'design') return <DesignPanel />
  return <PaperPanel />
}

/** The desktop settings column. Unmounts inactive tabs (the design tab draws sixteen previews). */
export const EditorPanel: FC = () => {
  const t = useTranslations('Editor.tabs')
  const tab = useEditorUiStore.use.tab()
  const openTab = useEditorUiStore.use.openTab()
  return (
    <Tabs
      activeKey={tab}
      onChange={(key) => openTab(key as EditorTab)}
      destroyOnHidden
      size='small'
      tabBarGutter={4}
      tabBarStyle={{ paddingInline: 8 }}
      items={EDITOR_TABS.map((key) => ({
        key,
        label: (
          <span className='flex flex-col items-center gap-0.5 px-1.5 text-xs leading-tight'>
            <span className='text-base'>{TAB_ICONS[key]}</span>
            {t(key)}
          </span>
        ),
        children: (
          <div className='px-4 pb-8'>
            <PanelBody tab={key} />
          </div>
        ),
      }))}
    />
  )
}
