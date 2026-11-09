'use client'

import type { FC } from 'react'
import { Alert } from 'antd'
import { useFormatter, useTranslations } from 'next-intl'
import { useAccessUntil, useNow } from '@hooks/useAccess'
import { accessDaysLeft, isAccessActive, PASS_DAYS } from '@constants/pricing'
import { FREE_TEMPLATE_ID } from '@constants/templates'

/**
 * The access pass on the dashboard (docs/PAYMENTS.md): while it runs, until when and how many
 * days are left; once it has run out, that the lists are all still here and what they can do
 * without it. Nothing for someone who never bought one, or while it is unknown.
 */
export const AccessBanner: FC<{ className?: string }> = ({ className }) => {
  const t = useTranslations('Dashboard')
  const tTemplates = useTranslations('Templates')
  const format = useFormatter()
  const until = useAccessUntil()
  const now = useNow()
  if (until === undefined || until === null || now === 0) return null

  const date = format.dateTime(new Date(until), { dateStyle: 'long' })
  const active = isAccessActive(until, now)

  return (
    // Margin on a wrapper: antd's Alert styles are unlayered and reset `margin`.
    <div className={className}>
      {active ? (
        <Alert
          type='success'
          showIcon
          title={t('accessActiveTitle', { date })}
          description={t('accessActiveText', { left: accessDaysLeft(until, now), days: PASS_DAYS })}
        />
      ) : (
        <Alert
          type='info'
          showIcon
          title={t('accessEndedTitle', { date })}
          description={t('accessEndedText', { free: tTemplates(`names.${FREE_TEMPLATE_ID}`), days: PASS_DAYS })}
        />
      )}
    </div>
  )
}
