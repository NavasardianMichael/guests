'use client'

import type { FC } from 'react'
import { DownloadOutlined } from '@ant-design/icons'
import { App, Button } from 'antd'
import { useTranslations } from 'next-intl'
import { useEditorUiStore } from '@store/editorUi/store'
import { useListEditorStoreBase } from '@store/lists/single/store'
import { DRAFT_ID } from '@store/lists/single/types'
import { accessActiveNow, useAccessUntil } from '@hooks/useAccess'
import { usePdfDownload } from '@hooks/usePdfDownload'
import { isPrintable } from '@constants/templates'
import { flushSave } from './useAutosave'

/**
 * Download PDF. It goes through the API's PDF (headless Chrome printing `/render`), so the
 * file is exactly what the venue's printer will print — sized to the chosen paper, fonts
 * embedded. A saved list is saved first: the server prints its copy. A premium template without
 * a running access pass opens the checkout (`CheckoutModal`), which also offers the free template.
 */
type Props = {
  /** The word beside the icon at every width; the editor's top bar hides it on phones. */
  label?: boolean
}

export const PdfActions: FC<Props> = ({ label = false }) => {
  const t = useTranslations('Editor.download')
  const tErrors = useTranslations('Errors')
  const { message } = App.useApp()
  const setCheckoutOpen = useEditorUiStore.use.setCheckoutOpen()
  // Loads the access pass for whoever is signed in, so the check below is ready by the click.
  useAccessUntil()
  const { run, isWorking } = usePdfDownload()

  const download = async () => {
    const { listId, doc } = useListEditorStoreBase.getState()
    if (!listId || !doc) return
    const active = accessActiveNow()
    if (active !== null && !isPrintable(doc.design.templateId, active)) return setCheckoutOpen(true)
    if (listId !== DRAFT_ID && !(await flushSave())) {
      void message.error(tErrors('kinds.server'))
      return
    }
    const saved = useListEditorStoreBase.getState()
    if (saved.doc && (await run(listId, saved.doc)) === 'locked') setCheckoutOpen(true)
  }

  return (
    <Button type='primary' icon={<DownloadOutlined />} loading={isWorking} onClick={() => void download()} aria-label={t('button')}>
      <span className={label ? undefined : 'hidden sm:inline'}>{t('button')}</span>
    </Button>
  )
}
