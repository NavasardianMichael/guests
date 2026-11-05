'use client'

import type { FC, ReactNode } from 'react'
import { Alert, Button } from 'antd'
import { useTranslations } from 'next-intl'
import { classifyError, errorCopyKey, isDevelopment } from '@helpers/error'

type Props = {
  error: unknown
  onRetry?: () => void
  className?: string
}

/**
 * A failure, inline. Production shows the Armenian copy chosen by code or kind; development
 * adds the original message underneath, so a developer sees which request failed.
 */
export const ErrorAlert: FC<Props> = ({ error, onRetry, className }) => {
  const t = useTranslations('Errors')
  const tCommon = useTranslations('Common')
  const classified = classifyError(error)

  let description: ReactNode = null
  if (isDevelopment()) {
    description = (
      <details className='mt-1 text-xs'>
        <summary className='cursor-pointer'>{t('details')}</summary>
        <code className='break-all whitespace-pre-wrap'>{classified.message}</code>
      </details>
    )
  }

  // `className` goes on a wrapper: antd's Alert styles are unlayered and reset `margin`, so a
  // Tailwind spacing utility (`mb-4`) on the Alert itself would lose.
  return (
    <div className={className}>
      <Alert
        type='error'
        showIcon
        title={t(errorCopyKey(classified))}
        description={description}
        action={
          onRetry && classified.retryable ? (
            <Button size='small' onClick={onRetry}>
              {tCommon('retry')}
            </Button>
          ) : undefined
        }
      />
    </div>
  )
}
