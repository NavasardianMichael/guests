'use client'

import type { FC } from 'react'
import { CheckCircleFilled } from '@ant-design/icons'
import { useTranslations } from 'next-intl'
import { useOwnsTemplate } from '@hooks/useOwnedTemplates'
import type { TemplateId } from '@constants/templates'
import { cn } from '@helpers/cn'

/** "Bought": on a card or list whose template the visitor owns. */
export const BoughtBadge: FC<{ className?: string; size?: 'small' | 'default' }> = ({ className, size = 'default' }) => {
  const t = useTranslations('Templates')
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-success font-semibold text-white shadow-sm',
        size === 'small' ? 'px-1.5 py-0.5 text-[9px] leading-none' : 'px-2.5 py-1 text-xs',
        className
      )}
    >
      <CheckCircleFilled aria-hidden='true' />
      {t('bought')}
    </span>
  )
}

/** The badge, shown only when the visitor owns `templateId` (a server page's cards stay static otherwise). */
export const OwnedTemplateBadge: FC<{ templateId: TemplateId; className?: string }> = ({ templateId, className }) =>
  useOwnsTemplate(templateId) ? <BoughtBadge className={className} /> : null
