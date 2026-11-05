'use client'

import { useEffect } from 'react'
import { Button } from 'antd'
import { useTranslations } from 'next-intl'
import { reportError } from '@helpers/reportError'

type Props = { error: Error & { digest?: string }; reset: () => void }

export default function RouteError({ error, reset }: Props) {
  const t = useTranslations('Errors')
  const tCommon = useTranslations('Common')

  useEffect(() => reportError(error, 'route'), [error])

  return (
    <div className='grid min-h-[60dvh] place-items-center px-4 text-center'>
      <div className='w-full max-w-md'>
        <h1 className='font-display text-title font-extrabold text-ink sm:text-3xl'>{t('pageTitle')}</h1>
        <p className='mt-3 text-muted'>{t('kinds.unknown')}</p>
        {process.env.NODE_ENV !== 'production' && <code className='mt-2 block text-xs break-all'>{error.message}</code>}
        <div className='mt-6 flex justify-center gap-2'>
          <Button type='primary' onClick={reset}>
            {tCommon('retry')}
          </Button>
          <Button onClick={() => window.location.reload()}>{tCommon('reload')}</Button>
        </div>
      </div>
    </div>
  )
}
