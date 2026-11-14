'use client'

import type { FC } from 'react'
import { TableOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useTranslations } from 'next-intl'
import { useEditorUiStore } from '@store/editorUi/store'
import { useGuestSheetStoreBase } from '@store/guestSheet/store'
import { useListEditorStoreBase } from '@store/lists/single/store'

/**
 * Opens the spreadsheet on a draft of the list's guests: in the guests step and the layout step.
 * Apart from `SpreadsheetModal`, which the editor loads only once it is first opened.
 */
export const SpreadsheetButton: FC = () => {
  const t = useTranslations('Editor.spreadsheet')
  const setOpen = useEditorUiStore.use.setSpreadsheetOpen()
  const openSheet = () => {
    const doc = useListEditorStoreBase.getState().doc
    if (!doc) return
    useGuestSheetStoreBase.getState().start({ guests: doc.content.guests, tables: doc.content.tables })
    setOpen(true)
  }
  return (
    <Button
      block
      icon={<TableOutlined />}
      onClick={openSheet}
      // antd fixes a button's height and forbids wrapping: a long label would overflow.
      style={{ height: 'auto', minHeight: 36, whiteSpace: 'normal', paddingBlock: 6 }}
    >
      {t('open')}
    </Button>
  )
}
