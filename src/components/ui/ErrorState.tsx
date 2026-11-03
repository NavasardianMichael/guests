'use client'

import type { FC, ReactNode } from 'react'
import { Button, Result } from 'antd'
import { useTranslations } from 'next-intl'
import { classifyError, errorCopyKey, isDevelopment } from '@helpers/error'

type Props = {
  error: unknown
  title?: string
  onRetry?: () => void
  extra?: ReactNode
}

/** A failure that owns the whole panel or page. */
export const ErrorState: FC<Props> = ({ error, title, onRetry, extra }) => {
  const t = useTranslations('Errors')
  const tCommon = useTranslations('Common')
  const classified = classifyError(error)
  const notFound = classified.kind === 'notFound'

  return (
    <Result
      status={notFound ? '404' : 'error'}
      title={title ?? t('pageTitle')}
      subTitle={
        <>
          {t(errorCopyKey(classified))}
          {isDevelopment() && <code className='mt-2 block text-xs break-all'>{classified.message}</code>}
        </>
      }
      extra={
        <div className='flex flex-wrap justify-center gap-2'>
          {onRetry && classified.retryable && (
            <Button type='primary' onClick={onRetry}>
              {tCommon('retry')}
            </Button>
          )}
          {extra}
        </div>
      }
    />
  )
}
