'use client'

import { type FC, useMemo } from 'react'
import { ReloadOutlined } from '@ant-design/icons'
import { App, Button } from 'antd'
import { useTranslations } from 'next-intl'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import { isAtDefault, type ResetScope } from '@helpers/designReset'
import { HintTooltip } from '@components/ui/HintTooltip'

type Props = {
  scope: ResetScope
  /** The tab's or section's title, named in the confirmation. Not needed for `all`. */
  name?: string
  /** `icon`: the editor's top bar; `tab`: a tab's header; `section`: a section's header. */
  variant: 'icon' | 'tab' | 'section'
}

/**
 * Puts a tab's or a section's settings (or all of them) back at the template's defaults, after
 * asking. Disabled while there is nothing to reset. One undo step, so Undo brings them back.
 */
export const ResetButton: FC<Props> = ({ scope, name, variant }) => {
  const t = useTranslations('Editor.reset')
  const tCommon = useTranslations('Common')
  const { modal, message } = App.useApp()
  const design = useListEditorStoreBase((state) => state.doc?.design)
  const resetDesign = useListEditorStore.use.resetDesign()
  const atDefault = useMemo(() => !design || isAtDefault(design, scope), [design, scope])

  const confirm = () =>
    modal.confirm({
      title: scope === 'all' ? t('confirmAllTitle') : t('confirmTitle', { name: name ?? '' }),
      content: scope === 'all' ? t('confirmAllText') : t('confirmText'),
      okText: t('ok'),
      cancelText: tCommon('cancel'),
      centered: true,
      onOk: () => {
        resetDesign(scope)
        void message.success(t('done'))
      },
    })

  if (variant === 'icon') {
    return (
      <HintTooltip title={t('all')}>
        <Button type='text' icon={<ReloadOutlined />} disabled={atDefault} onClick={confirm} aria-label={t('all')} />
      </HintTooltip>
    )
  }
  return (
    <Button
      size='small'
      type={variant === 'section' ? 'text' : 'default'}
      icon={<ReloadOutlined />}
      disabled={atDefault}
      onClick={confirm}
      aria-label={name ? `${t('button')}: ${name}` : t('button')}
      className={variant === 'section' ? 'text-xs text-muted' : undefined}
    >
      {t('button')}
    </Button>
  )
}
