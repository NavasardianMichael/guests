'use client'

import { useCallback } from 'react'
import { App } from 'antd'
import { useTranslations } from 'next-intl'
import { checkoutAPI } from '@api/purchases/main'
import { CURRENCY, PASS_DAYS, PASS_PRICE_AMD } from '@constants/pricing'
import { trackEvent } from '@helpers/analytics'
import { collectClientInfo } from '@helpers/clientInfo'

type CheckoutOptions = {
  /** A saved list of the buyer's, only where they started: the result page leads back to it. Null for a draft. */
  listId: string | null
  /** Bought while a pass runs (its days go on top), for analytics. */
  extend: boolean
}

/**
 * Starts buying full access and leaves for the bank's page (as cv-builder's). When an earlier
 * attempt's bank page may still be open in another tab (the API answers `open` instead of
 * starting one), the buyer is offered to continue that same payment: one order can be charged
 * only once, whichever tab it is paid in. The minutes come from the server's clock, never this
 * device's.
 *
 * Resolves true when the browser is on its way to the bank, false when the buyer chose to
 * stay. API failures — `earlierPaymentSucceeded` among them — are thrown to the caller, which
 * knows what to show.
 */
export const useCheckout = (): ((options: CheckoutOptions) => Promise<boolean>) => {
  const t = useTranslations('Payment.openPayment')
  const { modal } = App.useApp()

  return useCallback(
    async ({ listId, extend }: CheckoutOptions) => {
      const base = { ...(listId ? { listId } : {}), client: collectClientInfo() }
      let result = await checkoutAPI(base)
      if (result.kind === 'open') {
        const resume = await modal.confirm({
          title: t('title'),
          content: t('text', { minutes: result.minutesAgo }),
          okText: t('continue'),
          cancelText: t('cancel'),
        })
        if (!resume) return false
        result = await checkoutAPI({ ...base, resume: true })
        if (result.kind !== 'redirect') return false
      }
      trackEvent('begin_checkout', { currency: CURRENCY, value: PASS_PRICE_AMD, days: PASS_DAYS, extend })
      window.location.assign(result.url)
      return true
    },
    [modal, t]
  )
}
