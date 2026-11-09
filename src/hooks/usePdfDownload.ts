'use client'

import { useCallback, useState } from 'react'
import { App } from 'antd'
import { useTranslations } from 'next-intl'
import { downloadDraftPdfAPI, downloadListPdfAPI } from '@api/lists/main'
import { DRAFT_ID, type ListDocument } from '@store/lists/single/types'
import { usePurchasesStoreBase } from '@store/purchases/store'
import { ERROR_CODES } from '@constants/errors'
import { isPrintable } from '@constants/templates'
import { trackEvent } from '@helpers/analytics'
import { classifyError, errorCopyKey } from '@helpers/error'
import { saveBlob } from '@helpers/image'

/**
 * - `done`: saved as a file.
 * - `locked`: the list is in a premium template its owner has not bought — the caller offers
 *   the checkout. Nothing was shown.
 * - `failed`: the failure was shown.
 */
export type PdfDownloadResult = 'done' | 'locked' | 'failed'

/**
 * The list's PDF — a saved list printed from the server's copy, a guest's draft sent along —
 * saved as a file. Rendering takes a few seconds, so a loading toast stays up until it lands.
 * A premium template not bought is stopped before printing when the bought templates are
 * known, and by the API's 402 otherwise (a refund since, a stale page) — which also refreshes
 * them. Rejections are shown here, never rethrown.
 */
export const usePdfDownload = (): {
  run: (listId: string, doc: ListDocument) => Promise<PdfDownloadResult>
  isWorking: boolean
} => {
  const t = useTranslations('Editor.download')
  const tErrors = useTranslations('Errors')
  const { message } = App.useApp()
  const [isWorking, setIsWorking] = useState(false)

  const run = useCallback(
    async (listId: string, doc: ListDocument): Promise<PdfDownloadResult> => {
      const owned = usePurchasesStoreBase.getState().templates
      if (owned !== null && !isPrintable(doc.design.templateId, owned)) return 'locked'
      const key = `pdf-${listId}`
      setIsWorking(true)
      message.loading({ key, content: t('preparing'), duration: 0 })
      try {
        const blob = listId === DRAFT_ID ? await downloadDraftPdfAPI(doc) : await downloadListPdfAPI({ id: listId })
        saveBlob(blob, `${doc.title.trim() || 'guests'}.pdf`)
        message.success({ key, content: t('done') })
        trackEvent('list_pdf', { kind: doc.design.kind, template: doc.design.templateId })
        return 'done'
      } catch (error) {
        const failure = classifyError(error)
        if (failure.code === ERROR_CODES.listNotPaid) {
          message.destroy(key)
          void usePurchasesStoreBase.getState().refresh()
          return 'locked'
        }
        message.error({ key, content: tErrors(errorCopyKey(failure)) })
        return 'failed'
      } finally {
        setIsWorking(false)
      }
    },
    [message, t, tErrors]
  )

  return { run, isWorking }
}
