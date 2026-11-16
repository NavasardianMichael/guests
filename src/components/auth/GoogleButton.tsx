'use client'

import type { FC } from 'react'
import { Button } from 'antd'
import { useTranslations } from 'next-intl'
import { googleSignInUrl } from '@api/auth/main'
import { useCapabilities } from '@hooks/useCapabilities'
import { GoogleLogo } from '@components/ui/GoogleLogo'

/**
 * A top-level navigation to the API, which runs the OAuth flow and lands back on `returnTo`.
 * Hidden when the API reports Google is not configured.
 */
export const GoogleButton: FC<{ returnTo?: string }> = ({ returnTo }) => {
  const t = useTranslations('Auth')
  const capabilities = useCapabilities()
  if (!capabilities?.google) return null

  return (
    <Button
      block
      size='large'
      icon={<GoogleLogo />}
      onClick={() => {
        window.location.href = googleSignInUrl(returnTo)
      }}
    >
      {t('google')}
    </Button>
  )
}
