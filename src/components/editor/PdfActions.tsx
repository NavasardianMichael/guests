'use client'

import type { FC } from 'react'
import { DownloadOutlined } from '@ant-design/icons'
import { App, Button } from 'antd'
import { useTranslations } from 'next-intl'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import { DRAFT_ID } from '@store/lists/single/types'
import { usePdfDownload } from '@hooks/usePdfDownload'
import { FREE_TEMPLATE_ID, isPrintable } from '@constants/templates'
import { flushSave } from './useAutosave'

/**
 * Download PDF. It goes through the API's PDF (headless Chrome printing `/render`), so the
 * file is exactly what the venue's printer will print — sized to the chosen paper, fonts
 * embedded. A saved list is saved first: the server prints its copy. A premium template does
 * not download until paid for; the dialog offers the free one instead.
 */
type Props = {
  /** The word beside the icon at every width; the editor's top bar hides it on phones. */
  label?: boolean
}

export const PdfActions: FC<Props> = ({ label = false }) => {
  const t = useTranslations('Editor.download')
  const tTemplates = useTranslations('Templates')
  const tCommon = useTranslations('Common')
  const tErrors = useTranslations('Errors')
  const { message, modal } = App.useApp()
  const applyTemplate = useListEditorStore.use.applyTemplate()
  const { run, isWorking } = usePdfDownload()

  const download = async () => {
    const { listId, doc, paidAt } = useListEditorStoreBase.getState()
    if (!listId || !doc) return
    if (!isPrintable(doc.design.templateId, paidAt)) {
      const free = tTemplates(`names.${FREE_TEMPLATE_ID}`)
      modal.confirm({
        title: t('premiumTitle', { template: tTemplates(`names.${doc.design.templateId}`) }),
        content: t('premiumText', { free }),
        okText: t('premiumSwitch', { free }),
        cancelText: tCommon('cancel'),
        centered: true,
        onOk: () => applyTemplate(FREE_TEMPLATE_ID),
      })
      return
    }
    if (listId !== DRAFT_ID && !(await flushSave())) {
      void message.error(tErrors('kinds.server'))
      return
    }
    const saved = useListEditorStoreBase.getState()
    if (saved.doc) await run(listId, saved.doc, saved.paidAt)
  }

  return (
    <Button type='primary' icon={<DownloadOutlined />} loading={isWorking} onClick={() => void download()} aria-label={t('button')}>
      <span className={label ? undefined : 'hidden sm:inline'}>{t('button')}</span>
    </Button>
  )
}
