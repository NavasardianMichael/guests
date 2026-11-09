'use client'

import type { FC } from 'react'
import { CheckCircleFilled } from '@ant-design/icons'
import { useTranslations } from 'next-intl'
import { useOwnsTemplate } from '@hooks/useOwnedTemplates'
import type { TemplateId } from '@constants/templates'

/**
 * On a template's page, for its buyer: the template is theirs, and "use this template" starts a
 * new list in it that prints clean. Nothing for anyone else (the page itself is static).
 */
export const OwnedTemplateNote: FC<{ templateId: TemplateId }> = ({ templateId }) => {
  const t = useTranslations('Templates')
  if (!useOwnsTemplate(templateId)) return null
  return (
    <p className='m-0 mt-4 flex max-w-md items-start gap-2 text-sm text-ink'>
      <CheckCircleFilled className='mt-0.5 text-success' aria-hidden='true' />
      <span>{t('boughtNote')}</span>
    </p>
  )
}

/** The page's price line: what it costs, or that the visitor has bought it. */
export const TemplatePriceValue: FC<{ templateId: TemplateId; free: boolean; price: string }> = ({ templateId, free, price }) => {
  const t = useTranslations('Templates')
  const owned = useOwnsTemplate(templateId)
  if (free) return t('free')
  return owned ? t('bought') : t('premiumPrice', { price })
}
