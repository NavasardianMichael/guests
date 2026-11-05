'use client'

import type { FC } from 'react'
import { DownloadOutlined, PrinterOutlined } from '@ant-design/icons'
import { App, Button } from 'antd'
import { useTranslations } from 'next-intl'
import { useListEditorStoreBase } from '@store/lists/single/store'
import { DRAFT_ID } from '@store/lists/single/types'
import { type PdfAction, usePdfDownload } from '@hooks/usePdfDownload'
import { HintTooltip } from '@components/ui/HintTooltip'
import { flushSave } from './useAutosave'

/**
 * Print and Download. Both go through the API's PDF (headless Chrome printing `/render`), so
 * what comes out of the venue's printer is exactly the file a user would download — sized to
 * the chosen paper, fonts embedded. A saved list is saved first: the server prints its copy.
 */
type Props = {
  /** Print with its word beside the icon; the editor's top bar shows the icon alone. */
  printLabel?: boolean
}

export const PdfActions: FC<Props> = ({ printLabel = false }) => {
  const t = useTranslations('Editor.download')
  const tErrors = useTranslations('Errors')
  const { message } = App.useApp()
  const { run, isWorking } = usePdfDownload()

  const go = async (action: PdfAction) => {
    const { listId } = useListEditorStoreBase.getState()
    if (!listId) return
    if (listId !== DRAFT_ID && !(await flushSave())) {
      void message.error(tErrors('kinds.server'))
      return
    }
    const doc = useListEditorStoreBase.getState().doc
    if (doc) await run(listId, doc, action)
  }

  return (
    <div className='flex items-center gap-1'>
      <HintTooltip title={t('printHint')}>
        <Button icon={<PrinterOutlined />} loading={isWorking} onClick={() => void go('print')} aria-label={t('print')}>
          {printLabel && t('print')}
        </Button>
      </HintTooltip>
      <Button type='primary' icon={<DownloadOutlined />} loading={isWorking} onClick={() => void go('download')} aria-label={t('button')}>
        <span className='hidden sm:inline'>{t('button')}</span>
      </Button>
    </div>
  )
}
