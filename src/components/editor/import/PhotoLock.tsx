'use client'

import type { FC } from 'react'
import { LockOutlined } from '@ant-design/icons'
import { useTranslations } from 'next-intl'
import { useAccessActive, useAccessUntil } from '@hooks/useAccess'

/**
 * A small lock beside a "From a photo" button while no pass runs: photo reading comes with full
 * access (5 photos per pass). The button stays — the import dialog says why its upload is off and
 * offers the checkout. Nothing while the access is still unknown, so it never flickers on.
 */
export const PhotoLock: FC = () => {
  const t = useTranslations('Editor.import')
  const known = useAccessUntil() !== undefined
  const active = useAccessActive()
  if (!known || active) return null
  return <LockOutlined className='ms-1 text-xs opacity-70' role='img' aria-label={t('photoLockedHint')} title={t('photoLockedHint')} />
}
