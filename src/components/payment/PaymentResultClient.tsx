'use client'

import { type FC, useEffect, useState } from 'react'
import { ArrowLeftOutlined, CheckCircleFilled, ClockCircleFilled, CloseCircleFilled, PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Spin } from 'antd'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@store/auth/store'
import { DRAFT_ID } from '@store/lists/single/types'
import { usePurchasesStoreBase } from '@store/purchases/store'
import { useOwnedTemplates } from '@hooks/useOwnedTemplates'
import { CURRENCY, TEMPLATE_PRICE_AMD } from '@constants/pricing'
import { CHECKOUT_QUERY, editorPath, newListPath, RETURN_TO_QUERY, ROUTES } from '@constants/routes'
import type { TemplateId } from '@constants/templates'
import { trackEvent } from '@helpers/analytics'
import { readLocalDraft } from '@helpers/localDraft'

type Props = { status: 'succeeded' | 'failed' | 'pending'; templateId?: TemplateId; listId?: string; paymentId?: string }

const PENDING_POLL_MS = 4000
const PENDING_MAX_POLLS = 8

/**
 * Where the bank's return trip lands (via the API, which has already asked the bank). The
 * bought templates are re-read rather than trusting `status`: reading them reconciles a
 * pending payment, so "pending" polls a few times until the bank has answered. A guest reads
 * them through the guest cookie, and is reminded that what they bought lives only in this
 * browser until they sign in.
 */
export const PaymentResultClient: FC<Props> = ({ status, templateId, listId, paymentId }) => {
  const t = useTranslations('Payment')
  const tTemplates = useTranslations('Templates')
  const user = useAuthStore.use.user()
  const isResolved = useAuthStore.use.isResolved()
  const owned = useOwnedTemplates()
  const [polls, setPolls] = useState(0)
  // The editor this purchase started from: a saved list, or this browser's draft.
  const [backTo, setBackTo] = useState<string | null>(listId ? editorPath(listId) : null)

  useEffect(() => {
    // localStorage is only readable after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!listId && readLocalDraft()) setBackTo(editorPath(DRAFT_ID))
  }, [listId])

  // A poll asks again; the first read is `useOwnedTemplates`' own.
  useEffect(() => {
    if (polls > 0) void usePurchasesStoreBase.getState().refresh()
  }, [polls])

  const bought = Boolean(templateId && owned?.includes(templateId))
  const effective = bought ? 'succeeded' : status === 'succeeded' && owned ? 'pending' : status

  // Revisiting this page repeats the event; GA counts one purchase per transaction_id.
  useEffect(() => {
    if (bought && templateId) {
      trackEvent('purchase', {
        currency: CURRENCY,
        value: TEMPLATE_PRICE_AMD,
        transaction_id: paymentId ?? templateId,
        template: templateId,
      })
    }
  }, [bought, paymentId, templateId])

  useEffect(() => {
    if (effective !== 'pending' || polls >= PENDING_MAX_POLLS) return
    const timer = setTimeout(() => setPolls((count) => count + 1), PENDING_POLL_MS)
    return () => clearTimeout(timer)
  }, [effective, polls])

  if (templateId && owned === null && status !== 'failed') {
    return (
      <div className='grid flex-1 place-items-center'>
        <Spin size='large' />
      </div>
    )
  }

  const template = templateId ? tTemplates(`names.${templateId}`) : ''
  const view = {
    succeeded: { icon: <CheckCircleFilled className='text-success' />, title: t('succeeded'), text: t('succeededText', { template }) },
    failed: { icon: <CloseCircleFilled className='text-danger' />, title: t('failed'), text: t('failedText') },
    pending: { icon: <ClockCircleFilled className='text-accent' />, title: t('pending'), text: t('pendingText') },
  }[effective]

  return (
    <div className='mx-auto my-auto w-full max-w-lg text-center'>
      <div className='text-6xl' aria-hidden='true'>
        {view.icon}
      </div>
      <h1 className='mt-6 font-display text-title font-extrabold text-ink sm:text-3xl'>{view.title}</h1>
      <p className='mt-3 text-lg text-muted'>{view.text}</p>
      {/* Margin on a wrapper: antd's Alert styles are unlayered and reset `margin`. */}
      {isResolved && !user && effective === 'succeeded' && (
        <div className='mt-6 text-left'>
          <Alert
            type='warning'
            showIcon
            title={t('guestTitle')}
            description={t('guestText')}
            action={
              <Link href={`${ROUTES.signIn}?${RETURN_TO_QUERY}=${encodeURIComponent(backTo ?? ROUTES.templates)}`}>
                <Button size='small'>{t('guestSignIn')}</Button>
              </Link>
            }
          />
        </div>
      )}
      <div className='mt-8 flex flex-wrap justify-center gap-3'>
        {effective === 'succeeded' && backTo && (
          <Link href={backTo}>
            <Button type='primary' size='large'>
              {t('toEditor')}
            </Button>
          </Link>
        )}
        {effective === 'succeeded' && templateId && (
          <Link href={newListPath({ template: templateId })}>
            <Button size='large' icon={<PlusOutlined />}>
              {t('newList')}
            </Button>
          </Link>
        )}
        {effective === 'failed' && backTo && (
          <Link href={`${backTo}?${CHECKOUT_QUERY}=1`}>
            <Button type='primary' size='large'>
              {t('tryAgain')}
            </Button>
          </Link>
        )}
        {effective !== 'succeeded' && backTo && (
          <Link href={backTo}>
            <Button size='large'>{t('toEditor')}</Button>
          </Link>
        )}
        <Link href={user ? ROUTES.dashboard : ROUTES.templates}>
          <Button size='large' type='text' icon={<ArrowLeftOutlined />}>
            {user ? t('toDashboard') : t('toTemplates')}
          </Button>
        </Link>
      </div>
    </div>
  )
}
