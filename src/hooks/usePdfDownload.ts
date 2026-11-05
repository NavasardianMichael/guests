'use client'

import { useCallback, useState } from 'react'
import { App } from 'antd'
import { useTranslations } from 'next-intl'
import { downloadDraftPdfAPI, downloadListPdfAPI } from '@api/lists/main'
import { DRAFT_ID, type ListDocument } from '@store/lists/single/types'
import { trackEvent } from '@helpers/analytics'
import { classifyError, errorCopyKey } from '@helpers/error'
import { saveBlob } from '@helpers/image'
import { reportError } from '@helpers/reportError'

/**
 * Prints a PDF through a hidden frame: the browser's own print dialog, for the printer at the
 * venue. Where a frame cannot print a PDF (some mobile browsers), the PDF opens in a tab,
 * where the browser's own print button is.
 */
const printBlob = (blob: Blob): void => {
  const url = URL.createObjectURL(blob)
  const frame = document.createElement('iframe')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  frame.src = url
  const cleanup = () => {
    frame.remove()
    URL.revokeObjectURL(url)
  }
  frame.onload = () => {
    try {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
      // The dialog blocks in most browsers; leave the frame long enough for those that do not.
      setTimeout(cleanup, 60_000)
    } catch (error) {
      reportError(error, 'print:frame')
      window.open(url, '_blank', 'noopener')
      setTimeout(cleanup, 60_000)
    }
  }
  document.body.appendChild(frame)
}

export type PdfAction = 'download' | 'print'

/**
 * The list's PDF — a saved list printed from the server's copy, a guest's draft sent along —
 * handed to the browser as a file or straight to its print dialog. Rendering takes a few
 * seconds, so a loading toast stays up until it lands. Rejections are shown here, never rethrown.
 */
export const usePdfDownload = (): {
  run: (listId: string, doc: ListDocument, action: PdfAction) => Promise<boolean>
  isWorking: boolean
} => {
  const t = useTranslations('Editor.download')
  const tErrors = useTranslations('Errors')
  const { message } = App.useApp()
  const [isWorking, setIsWorking] = useState(false)

  const run = useCallback(
    async (listId: string, doc: ListDocument, action: PdfAction): Promise<boolean> => {
      const key = `pdf-${listId}`
      setIsWorking(true)
      message.loading({ key, content: t('preparing'), duration: 0 })
      try {
        const blob = listId === DRAFT_ID ? await downloadDraftPdfAPI(doc) : await downloadListPdfAPI({ id: listId })
        if (action === 'print') {
          printBlob(blob)
          message.success({ key, content: t('printing') })
        } else {
          saveBlob(blob, `${doc.title.trim() || 'guests'}.pdf`)
          message.success({ key, content: t('done') })
        }
        trackEvent('list_pdf', { action, kind: doc.design.kind, template: doc.design.templateId })
        return true
      } catch (error) {
        message.error({ key, content: tErrors(errorCopyKey(classifyError(error))) })
        return false
      } finally {
        setIsWorking(false)
      }
    },
    [message, t, tErrors]
  )

  return { run, isWorking }
}
