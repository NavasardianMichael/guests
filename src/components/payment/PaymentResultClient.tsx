'use client'

import { type FC, useEffect, useState } from 'react'
import { ArrowLeftOutlined, CheckCircleFilled, ClockCircleFilled, CloseCircleFilled, LockOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Spin } from 'antd'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { PaymentStatus } from '@api/purchases/types'
import { useAuthStore } from '@store/auth/store'
import { DRAFT_ID } from '@store/lists/single/types'
import { usePurchasesStoreBase } from '@store/purchases/store'
import { accessActiveNow, useAccessUntil } from '@hooks/useAccess'
import { useCheckout } from '@hooks/useCheckout'
import { useFormatDate } from '@hooks/useFormatDate'
import { ERROR_CODES } from '@constants/errors'
import { CURRENCY, PASS_DAYS, PASS_PRICE_AMD } from '@constants/pricing'
import { editorPath, newListPath, type PaymentResultStatus, RETURN_TO_QUERY, ROUTES } from '@constants/routes'
import { FREE_TEMPLATE_ID } from '@constants/templates'
import { trackEvent } from '@helpers/analytics'
import { processError } from '@helpers/error'
import { readLocalDraft } from '@helpers/localDraft'
import { ErrorAlert } from '@components/ui/ErrorAlert'

type Props = { status: PaymentResultStatus; listId?: string; paymentId?: string }

const PENDING_POLL_MS = 4000
const PENDING_MAX_POLLS = 8

/**
 * Where the bank's return trip lands (via the API, which has already asked the bank). The
 * payment is re-read rather than trusting `status`: reading it reconciles a pending payment, so
 * "pending" polls a few times until the bank has answered — and says so once it stops, rather
 * than promising a refresh that will not come. On success it says until when the access runs
 * and what stays after it ends. A guest reads it through the guest cookie, and is reminded that
 * the access lives only in this browser until they sign in.
 *
 * "Try again" on a failure starts a new payment from here, straight to the bank's page: the
 * buyer saw the price, terms and guest warning moments ago. Never offered while pending — the
 * first payment may yet be charged.
 */
export const PaymentResultClient: FC<Props> = ({ status, listId, paymentId }) => {
  const t = useTranslations('Payment')
  const tTemplates = useTranslations('Templates')
  const formatDate = useFormatDate()
  const user = useAuthStore.use.user()
  const isResolved = useAuthStore.use.isResolved()
  const until = useAccessUntil()
  const [polls, setPolls] = useState(0)
  // This payment's own status, once read; null: not this visitor's (opened in another browser).
  const [payment, setPayment] = useState<PaymentStatus | null | undefined>(undefined)
  // The editor this purchase started from: a saved list, or this browser's draft.
  const [backTo, setBackTo] = useState<string | null>(listId ? editorPath(listId) : null)
  const checkout = useCheckout()
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<unknown>(null)

  useEffect(() => {
    // localStorage is only readable after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!listId && readLocalDraft()) setBackTo(editorPath(DRAFT_ID))
  }, [listId])

  // Each read (the first once the owner is known, then each poll) settles a pending payment and
  // answers its status, refreshing the access with it.
  const ownerKnown = until !== undefined
  useEffect(() => {
    if (!ownerKnown || !paymentId) return
    let cancelled = false
    void usePurchasesStoreBase
      .getState()
      .refresh(paymentId)
      .then((access) => {
        if (!cancelled) setPayment(access.payment)
      })
    return () => {
      cancelled = true
    }
  }, [ownerKnown, paymentId, polls])

  /**
   * This payment as its record says. The redirect's `failed` stands even while the record is
   * still pending (back from the bank with nothing charged, routes/payments.ts); a refund since
   * reads as failed. With no record readable here (another browser, no payment id) the
   * redirect's word is all there is.
   */
  const effective: PaymentResultStatus =
    payment === 'succeeded'
      ? 'succeeded'
      : payment === 'failed' || payment === 'refunded' || status === 'failed'
        ? 'failed'
        : payment === 'pending'
          ? 'pending'
          : status

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

  const retry = async () => {
    setRetryError(null)
    setRetrying(true)
    try {
      // False: an earlier payment may still be open, and the buyer chose to stay.
      if (!(await checkout({ listId: listId ?? null, extend: accessActiveNow() === true }))) setRetrying(false)
    } catch (failure) {
      setRetrying(false)
      // A payment whose redirect was lost went through after all: read again, which shows it.
      if (processError(failure).code === ERROR_CODES.earlierPaymentSucceeded) return setPolls((count) => count + 1)
      setRetryError(failure)
    }
  }

  if (paymentId && payment === undefined && status !== 'failed') {
    return (
      <div className='grid flex-1 place-items-center'>
        <Spin size='large' />
      </div>
    )
  }

  const date = until ? formatDate(until) : ''
  const free = tTemplates(`names.${FREE_TEMPLATE_ID}`)
  const view = {
    succeeded: { icon: <CheckCircleFilled className='text-success' />, title: t('succeeded'), text: t('succeededText', { date }) },
    failed: { icon: <CloseCircleFilled className='text-danger' />, title: t('failed'), text: t('failedText') },
    pending:
      polls < PENDING_MAX_POLLS
        ? { icon: <ClockCircleFilled className='text-accent' />, title: t('pending'), text: t('pendingText') }
        : { icon: <ClockCircleFilled className='text-accent' />, title: t('unconfirmed'), text: t('unconfirmedText') },
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
      {Boolean(retryError) && (
        <div className='mt-6 text-left'>
          <ErrorAlert error={retryError} />
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
        {effective === 'failed' && (
          <Button type='primary' size='large' icon={<LockOutlined />} loading={retrying} onClick={() => void retry()}>
            {retrying ? t('redirecting') : t('tryAgain')}
          </Button>
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
