'use client'

import { type FC, useEffect } from 'react'
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons'
import { Button, Tooltip } from 'antd'
import { useTranslations } from 'next-intl'
import { useEditorUiStore } from '@store/editorUi/store'
import { cn } from '@helpers/cn'
import { EditorPanel } from './panels/EditorPanel'

/** Whether this browser last left the column folded. */
const COLLAPSED_KEY = 'guests:panel-collapsed'

const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

const writeCollapsed = (collapsed: boolean): void => {
  try {
    if (collapsed) localStorage.setItem(COLLAPSED_KEY, '1')
    else localStorage.removeItem(COLLAPSED_KEY)
  } catch {
    // Storage blocked: the column is folded for this visit only.
  }
}

/**
 * The desktop settings column. The button pinned at its top-right corner folds it to a narrow
 * rail (the canvas takes the room and refits) and unfolds it again; opening a step from the
 * steps bar unfolds it too. The choice is remembered by this browser.
 */
export const EditorSidebar: FC = () => {
  const t = useTranslations('Editor')
  const collapsed = useEditorUiStore.use.panelCollapsed()
  const setCollapsed = useEditorUiStore.use.setPanelCollapsed()

  // Read after mounting: the server renders the column open.
  useEffect(() => {
    if (readCollapsed()) setCollapsed(true)
  }, [setCollapsed])

  const toggle = () => {
    writeCollapsed(!collapsed)
    setCollapsed(!collapsed)
  }
  const label = collapsed ? t('panelShow') : t('panelHide')

  return (
    <aside
      className={cn(
        'relative hidden shrink-0 border-r border-line bg-surface lg:flex lg:flex-col',
        collapsed ? 'w-12' : 'w-96'
      )}
      aria-label={t('panelOpen')}
    >
      {/* Placed by a native wrapper: antd's own `position: relative` would beat `absolute`. */}
      <span className={cn('absolute top-3 z-10 flex', collapsed ? 'left-1/2 -translate-x-1/2' : 'right-3')}>
        <Tooltip title={label} placement='right'>
          <Button
            type='text'
            size='small'
            className='text-muted'
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            aria-label={label}
            aria-expanded={!collapsed}
            onClick={toggle}
          />
        </Tooltip>
      </span>
      {!collapsed && <EditorPanel />}
    </aside>
  )
}
