'use client'

import { type FC, type ReactNode, useEffect, useMemo, useState } from 'react'
import { CheckOutlined, ClockCircleOutlined, DownloadOutlined, LockOutlined } from '@ant-design/icons'
import { Alert, App, Button, Modal } from 'antd'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { checkoutAPI } from '@api/purchases/main'
import { useAuthStore } from '@store/auth/store'
import { useEditorUiStore, useEditorUiStoreBase } from '@store/editorUi/store'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import { DRAFT_ID } from '@store/lists/single/types'
import { useAccessUntil, useNow } from '@hooks/useAccess'
import { useCapabilities } from '@hooks/useCapabilities'
import { useFormatDate } from '@hooks/useFormatDate'
import { usePdfDownload } from '@hooks/usePdfDownload'
import { accessAfterPurchase, CURRENCY, formatAmount, isAccessActive, PASS_DAYS, PASS_PRICE_AMD } from '@constants/pricing'
import { CHECKOUT_QUERY, ROUTES } from '@constants/routes'
import { FREE_TEMPLATE_ID, isPrintable, TEMPLATES } from '@constants/templates'
import { trackEvent } from '@helpers/analytics'
import { cn } from '@helpers/cn'
import { designInTemplate } from '@helpers/listFactory'
import { SheetPreview } from '@components/sheet/SheetPreview'
import { ErrorAlert } from '@components/ui/ErrorAlert'
import { SignInToBuyModal } from './SignInToBuyModal'
import { flushSave } from '../useAutosave'

/**
 * The list as each option prints it: as designed (full access), or restyled in the free
 * template. Reads the document itself, mounted only while the dialog is open.
 */
const OptionPreview: FC<{ free?: boolean }> = ({ free = false }) => {
  const doc = useListEditorStore.use.doc()
  const shown = useMemo(() => (doc && free ? { ...doc, design: designInTemplate(doc.design, FREE_TEMPLATE_ID) } : doc), [doc, free])
  if (!shown) return null
  return <SheetPreview doc={shown} />
}

type OptionProps = { name: string; price: string; items: string[]; preview: ReactNode; featured?: boolean; children: ReactNode }

/** One way to download, as a card: its preview, name and price, what it gives, and its button(s) at the bottom. */
const DownloadOption: FC<OptionProps> = ({ name, price, items, preview, featured = false, children }) => (
  <section className={cn('flex flex-col rounded-2xl p-5', featured ? 'ring-2 ring-ink' : 'ring-1 ring-line')}>
    <div className='flex gap-4'>
      <div className='w-24 shrink-0 self-start overflow-hidden rounded-md shadow-md ring-1 ring-black/5'>{preview}</div>
      <div className='min-w-0'>
        <h3 className='m-0 text-base font-bold text-ink'>{name}</h3>
        <p className='mt-2 mb-0 font-display text-3xl font-extrabold text-ink'>{price}</p>
      </div>
    </div>
    <ul className='m-0 my-5 flex list-none flex-col gap-2 p-0'>
      {items.map((item) => (
        <li key={item} className='flex gap-2 text-sm'>
          <CheckOutlined className='mt-0.5 text-success' />
          {item}
        </li>
      ))}
    </ul>
    <div className='mt-auto'>{children}</div>
  </section>
)

/** What paying without an account means, said before the bank page — not after. */
const GuestWarning: FC<{ redirecting: boolean; onContinue: () => void; onSignIn: () => void }> = ({
  redirecting,
  onContinue,
  onSignIn,
}) => {
  const t = useTranslations('Editor.download')
  return (
    <div className='flex flex-col gap-2'>
      <Alert type='warning' showIcon className='mb-2' title={t('guestWarningTitle')} description={t('guestWarningText')} />
      <Button type='primary' size='large' block loading={redirecting} onClick={onContinue}>
        {redirecting ? t('redirecting') : t('guestContinue')}
      </Button>
      <Button size='large' block disabled={redirecting} onClick={onSignIn}>
        {t('guestSignIn')}
      </Button>
    </div>
  )
}

/**
 * The two ways to download, side by side where there is room (as cv-builder's): this list in
 * the free template (with the "made with" line, for that file only — the list on screen keeps
 * its template), and full access (docs/PAYMENTS.md) — one payment opens every template and
 * kind, clean, for `PASS_DAYS`; bought while a pass runs, the days go on top. Before paying
 * the buyer is told when the days start and end, what stays when they end (everything: the
 * lists, editable and printable in the free template) and how long unused lists are kept. The
 * list is saved first, so what prints after is what is on screen. The free card is left out
 * where it offers nothing: while a pass runs (Download already prints what is on screen), or
 * for a list already in the free template. It is back the next time the dialog opens, for as
 * long as no pass runs. Neither path needs an account; paying without one is warned about
 * once, on the way to the bank. Opened by either Download button, the access chip (to add
 * days), or `?checkout=1` (back from signing in to pay).
 */
export const CheckoutModal: FC = () => {
  const t = useTranslations('Editor.download')
  const tErrors = useTranslations('Errors')
  const tAccess = useTranslations('Editor.access')
  const tTemplates = useTranslations('Templates')
  const tCommon = useTranslations('Common')
  const { message } = App.useApp()
  const formatDate = useFormatDate()
  const open = useEditorUiStore.use.checkoutOpen()
  const setOpen = useEditorUiStore.use.setCheckoutOpen()
  const listId = useListEditorStore.use.listId()
  const templateId = useListEditorStoreBase((state) => state.doc?.design.templateId)
  const isGuest = !useAuthStore.use.user()
  const until = useAccessUntil()
  const now = useNow()
  const capabilities = useCapabilities()
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [confirmingGuest, setConfirmingGuest] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const { run: downloadPdf, isWorking: downloading } = usePdfDownload()

  // Back from signing in to pay: open once the access is known, unless it runs by now (it may
  // have been bought as a guest and moved to the account).
  useEffect(() => {
    if (until === undefined || !templateId) return
    if (new URLSearchParams(window.location.search).get(CHECKOUT_QUERY) !== '1') return
    window.history.replaceState(null, '', window.location.pathname)
    if (!isPrintable(templateId, isAccessActive(until, Date.now()))) useEditorUiStoreBase.getState().setCheckoutOpen(true)
  }, [until, templateId])

  if (!templateId || !listId) return null

  const free = tTemplates(`names.${FREE_TEMPLATE_ID}`)
  const price = tCommon('amount', { amount: formatAmount(PASS_PRICE_AMD) })
  const known = until ?? null
  const active = isAccessActive(known, now)
  const ends = formatDate(accessAfterPurchase(known, now))
  const showFree = !active && !TEMPLATES[templateId].free

  const close = () => {
    setConfirmingGuest(false)
    setError(null)
    setOpen(false)
  }

  const pay = async () => {
    setError(null)
    setRedirecting(true)
    try {
      if (listId !== DRAFT_ID) await flushSave()
      const checkoutUrl = await checkoutAPI(listId !== DRAFT_ID ? { listId } : {})
      trackEvent('begin_checkout', { currency: CURRENCY, value: PASS_PRICE_AMD, days: PASS_DAYS, extend: active })
      window.location.assign(checkoutUrl)
    } catch (failure) {
      setRedirecting(false)
      setError(failure)
    }
  }

  /** This list, restyled in the free template for the file only. The open list is left as it is. */
  const downloadFree = async () => {
    const current = useListEditorStoreBase.getState()
    if (!current.listId || !current.doc) return
    if (current.listId !== DRAFT_ID && !(await flushSave())) {
      void message.error(tErrors('kinds.server'))
      return
    }
    const saved = useListEditorStoreBase.getState().doc
    if (!saved) return
    const result = await downloadPdf(
      current.listId,
      { ...saved, design: designInTemplate(saved.design, FREE_TEMPLATE_ID) },
      { asGiven: true }
    )
    if (result === 'done') close()
  }

  const unavailable = capabilities !== null && !capabilities.payments

  return (
    <>
      <Modal
        open={open}
        onCancel={close}
        footer={null}
        width={showFree ? 800 : 520}
        centered
        title={t('checkoutTitle')}
        destroyOnHidden
      >
        <p className='mt-0 mb-4 text-sm text-muted'>{t('checkoutLead', { days: PASS_DAYS })}</p>
        <div className={cn('grid gap-4', showFree && 'md:grid-cols-2')}>
          {showFree && (
            <DownloadOption
              name={tTemplates('free')}
              price={tCommon('amount', { amount: formatAmount(0) })}
              items={t.raw('freeIncludes') as string[]}
              preview={<OptionPreview free />}
            >
              <Button
                size='large'
                block
                icon={<DownloadOutlined />}
                loading={downloading}
                disabled={redirecting}
                onClick={() => void downloadFree()}
              >
                {downloading ? t('preparing') : t('freeDownload', { free })}
              </Button>
            </DownloadOption>
          )}

          <DownloadOption name={tAccess('label')} price={price} items={t.raw('includes') as string[]} preview={<OptionPreview />} featured>
            {/* Margin on a wrapper: antd's Alert styles are unlayered and reset `margin`. */}
            <div className='mb-4'>
              <Alert
                type='info'
                showIcon
                icon={<ClockCircleOutlined />}
                styles={{ root: { alignItems: 'flex-start' } }}
                title={
                  active
                    ? t('extendNote', { until: formatDate(known!), days: PASS_DAYS, date: ends })
                    : t('startsNow', { days: PASS_DAYS, date: ends })
                }
              />
            </div>
            {unavailable && (
              <div className='mb-4'>
                <Alert type='warning' showIcon title={t('unavailable')} />
              </div>
            )}
            {Boolean(error) && <ErrorAlert error={error} className='mb-4' />}
            {confirmingGuest ? (
              <GuestWarning redirecting={redirecting} onContinue={() => void pay()} onSignIn={() => setSigningIn(true)} />
            ) : (
              <Button
                type='primary'
                size='large'
                block
                icon={<LockOutlined />}
                loading={redirecting}
                disabled={unavailable || downloading}
                onClick={() => (isGuest ? setConfirmingGuest(true) : void pay())}
              >
                {redirecting ? t('redirecting') : t('pay', { price })}
              </Button>
            )}
          </DownloadOption>
        </div>

        <div className='mt-4 rounded-lg bg-canvas p-3 ring-1 ring-line'>
          <p className='m-0 text-sm font-semibold text-ink'>{t('afterTitle', { days: PASS_DAYS })}</p>
          <p className='mt-1 mb-0 text-sm text-muted'>{t('afterText', { free, days: PASS_DAYS })}</p>
          <p className='mt-2 mb-0 text-xs text-muted'>{t('keptText')}</p>
        </div>
        <p className='mt-4 mb-0 text-xs leading-relaxed'>{t('secure')}</p>
        <p className='mt-1 mb-0 text-xs'>
          {t.rich('agree', {
            terms: (chunks) => (
              <Link href={ROUTES.terms} target='_blank' className='underline!'>
                {chunks}
              </Link>
            ),
            refund: (chunks) => (
              <Link href={ROUTES.refundPolicy} target='_blank' className='underline!'>
                {chunks}
              </Link>
            ),
          })}
        </p>
      </Modal>
      <SignInToBuyModal listId={listId} open={signingIn} onClose={() => setSigningIn(false)} />
    </>
  )
}
