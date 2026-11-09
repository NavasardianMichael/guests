'use client'

import { type FC, useEffect } from 'react'
import { App } from 'antd'
import { useTranslations } from 'next-intl'

/**
 * Ctrl/Cmd+P (and Ctrl+Shift+P, Chrome's system dialog) say where printing is instead of
 * opening the browser's print: lists print as the API's PDF. The browser's menu still prints,
 * and gets only the note (globals.css). `code`, not `key`: on an Armenian or Russian layout
 * the key is `պ` or `з`.
 */
export const PrintGuard: FC = () => {
  const t = useTranslations('Common')
  const { message } = App.useApp()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.code !== 'KeyP') return
      event.preventDefault()
      void message.info({ content: t('printBlocked'), key: 'print-blocked' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [message, t])

  return null
}
