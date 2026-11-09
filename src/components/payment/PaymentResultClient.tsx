'use client'

import { type FC, useEffect, useState } from 'react'
import { ArrowLeftOutlined, CheckCircleFilled, ClockCircleFilled, CloseCircleFilled, PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Spin } from 'antd'
import Link from 'next/link'
import { useFormatter, useTranslations } from 'next-intl'
import type { PaymentStatus } from '@api/purchases/types'
import { useAuthStore } from '@store/auth/store'
import { DRAFT_ID } from '@store/lists/single/types'
import { usePurchasesStoreBase } from '@store/purchases/store'
import { useAccessUntil } from '@hooks/useAccess'
import { CURRENCY, PASS_DAYS, PASS_PRICE_AMD } from '@constants/pricing'
import { CHECKOUT_QUERY, editorPath, newListPath, RETURN_TO_QUERY, ROUTES } from '@constants/routes'
import { FREE_TEMPLATE_ID } from '@constants/templates'
import { trackEvent } from '@helpers/analytics'
import { readLocalDraft } from '@helpers/localDraft'

type Status = 'succeeded' | 'failed' | 'pending'

type Props = { status: Status; listId?: string; paymentId?: string }

const PENDING_POLL_MS = 4000
const PENDING_MAX_POLLS = 8

/** The payment's own status as the page shows it: a refund since reads as failed. */
const shown = (status: PaymentStatus): Status => (status === 'refunded' ? 'failed' : status)

/**
 * Where the bank's return trip lands (via the API, which has already asked the bank). The
 * payment is re-read rather than trusting `status`: reading it reconciles a pending payment, so
 * "pending" polls a few times until the bank has answered. On success it says until when the
 * access runs and what stays after it ends. A guest reads it through the guest cookie, and is
 * reminded that the access lives only in this browser until they sign in.
 */
export const PaymentResultClient: FC<Props> = ({ status, listId, paymentId }) => {
  const t = useTranslations('Payment')
  const tTemplates = useTranslations('Templates')
  const format = useFormatter()
  const user = useAuthStore.use.user()
  const isResolved = useAuthStore.use.isResolved()
  const until = useAccessUntil()
  const [polls, setPolls] = useState(0)
  const [confirmed, setConfirmed] = useState<Status | null>(null)
  // The editor this purchase started from: a saved list, or this browser's draft.
  const [backTo, setBackTo] = useState<string | null>(listId ? editorPath(listId) : null)

  useEffect(() => {
    // localStorage is only readable after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!listId && readLocalDraft()) setBackTo(editorPath(DRAFT_ID))
  }, [listId])

  // Each read (the first once the owner is known, then each poll) settles a pending payment and
  // answers its status, refreshing the access with it. A payment that is not this visitor's (opened
  // in another browser) has no status to answer: the bank's word from the redirect stands.
  const ownerKnown = until !== undefined
  useEffect(() => {
    if (!ownerKnown || !paymentId) return
    let cancelled = false
    void usePurchasesStoreBase
      .getState()
      .refresh(paymentId)
      .then((access) => {
        if (!cancelled) setConfirmed(access.payment ? shown(access.payment) : status)
      })
    return () => {
      cancelled = true
    }
  }, [ownerKnown, paymentId, polls, status])

  const effective: Status = confirmed ?? status

  // Revisiting this page repeats the event; GA counts one purchase per transaction_id.
  useEffect(() => {
    if (effective === 'succeeded' && paymentId) {
      trackEvent('purchase', { currency: CURRENCY, value: PASS_PRICE_AMD, transaction_id: paymentId, days: PASS_DAYS })
    }
  }, [effective, paymentId])

  useEffect(() => {
    if (effective !== 'pending' || polls >= PENDING_MAX_POLLS) return
    const timer = setTimeout(() => setPolls((count) => count + 1), PENDING_POLL_MS)
    return () => clearTimeout(timer)
  }, [effective, polls])

  if (paymentId && confirmed === null && status !== 'failed') {
    return (
      <div className='grid flex-1 place-items-center'>
        <Spin size='large' />
      </div>
    )
  }

  const date = until ? format.dateTime(new Date(until), { dateStyle: 'long' }) : ''
  const free = tTemplates(`names.${FREE_TEMPLATE_ID}`)
  const view = {
    succeeded: { icon: <CheckCircleFilled className='text-success' />, title: t('succeeded'), text: t('succeededText', { date }) },
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
      {effective === 'succeeded' && <p className='mt-3 text-sm text-muted'>{t('afterText', { free, days: PASS_DAYS })}</p>}
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
        {effective === 'succeeded' && (
          <Link href={newListPath()}>
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
