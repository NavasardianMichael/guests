'use client'

import { useCallback, useState } from 'react'
import { App } from 'antd'
import { useTranslations } from 'next-intl'
import { downloadDraftPdfAPI, downloadListPdfAPI } from '@api/lists/main'
import { DRAFT_ID, type ListDocument } from '@store/lists/single/types'
import { FREE_TEMPLATE_ID, isPrintable } from '@constants/templates'
import { trackEvent } from '@helpers/analytics'
import { classifyError, errorCopyKey } from '@helpers/error'
import { saveBlob } from '@helpers/image'

/**
 * The list's PDF — a saved list printed from the server's copy, a guest's draft sent along —
 * saved as a file. Rendering takes a few seconds, so a loading toast stays up until it lands.
 * A premium template not paid for is stopped here with a note (the API refuses it too).
 * Rejections are shown here, never rethrown.
 */
export const usePdfDownload = (): {
  run: (listId: string, doc: ListDocument, paidAt: string | null) => Promise<boolean>
  isWorking: boolean
} => {
  const t = useTranslations('Editor.download')
  const tTemplates = useTranslations('Templates')
  const tErrors = useTranslations('Errors')
  const { message } = App.useApp()
  const [isWorking, setIsWorking] = useState(false)

  const run = useCallback(
    async (listId: string, doc: ListDocument, paidAt: string | null): Promise<boolean> => {
      if (!isPrintable(doc.design.templateId, paidAt)) {
        void message.warning(
          t('premiumShort', {
            template: tTemplates(`names.${doc.design.templateId}`),
            free: tTemplates(`names.${FREE_TEMPLATE_ID}`),
          })
        )
        return false
      }
      const key = `pdf-${listId}`
      setIsWorking(true)
      message.loading({ key, content: t('preparing'), duration: 0 })
      try {
        const blob = listId === DRAFT_ID ? await downloadDraftPdfAPI(doc) : await downloadListPdfAPI({ id: listId })
        saveBlob(blob, `${doc.title.trim() || 'guests'}.pdf`)
        message.success({ key, content: t('done') })
        trackEvent('list_pdf', { kind: doc.design.kind, template: doc.design.templateId })
        return true
      } catch (error) {
        message.error({ key, content: tErrors(errorCopyKey(classifyError(error))) })
        return false
      } finally {
        setIsWorking(false)
      }
    },
    [message, t, tErrors, tTemplates]
  )

  return { run, isWorking }
}
