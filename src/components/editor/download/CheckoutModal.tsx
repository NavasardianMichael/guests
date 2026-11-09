'use client'

import { type FC, useEffect, useState } from 'react'
import { CheckOutlined, LockOutlined } from '@ant-design/icons'
import { Alert, Button, Modal } from 'antd'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { checkoutTemplateAPI } from '@api/purchases/main'
import { useAuthStore } from '@store/auth/store'
import { useEditorUiStore, useEditorUiStoreBase } from '@store/editorUi/store'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import { DRAFT_ID } from '@store/lists/single/types'
import { usePurchasesStoreBase } from '@store/purchases/store'
import { useCapabilities } from '@hooks/useCapabilities'
import { useOwnedTemplates } from '@hooks/useOwnedTemplates'
import { usePdfDownload } from '@hooks/usePdfDownload'
import { ERROR_CODES } from '@constants/errors'
import { CURRENCY, formatAmount, TEMPLATE_PRICE_AMD } from '@constants/pricing'
import { CHECKOUT_QUERY, ROUTES } from '@constants/routes'
import { FREE_TEMPLATE_ID, isPrintable } from '@constants/templates'
import { trackEvent } from '@helpers/analytics'
import { classifyError } from '@helpers/error'
import { SheetPreview } from '@components/sheet/SheetPreview'
import { ErrorAlert } from '@components/ui/ErrorAlert'
import { SignInToBuyModal } from './SignInToBuyModal'
import { flushSave } from '../useAutosave'

/** The sheet as it will print once bought. Reads the document itself, mounted only while open. */
const SheetThumb: FC = () => {
  const doc = useListEditorStore.use.doc()
  if (!doc) return null
  return <SheetPreview doc={doc} />
}

/** What buying without an account means, said before the bank page — not after. */
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
 * Buying the list's template (docs/PAYMENTS.md): one payment, and the template is the buyer's
 * for every list they make. The list is saved first, so what prints after is what is on screen;
 * the buyer is told before paying that this list then keeps its template. The way out is the
 * free template, with the "made with" line. Neither path needs an account; buying without one
 * is warned about once, on the way to the bank. Opened by either Download button, or by
 * `?checkout=1` (back from signing in to buy).
 */
export const CheckoutModal: FC = () => {
  const t = useTranslations('Editor.download')
  const tTemplates = useTranslations('Templates')
  const tCommon = useTranslations('Common')
  const open = useEditorUiStore.use.checkoutOpen()
  const setOpen = useEditorUiStore.use.setCheckoutOpen()
  const listId = useListEditorStore.use.listId()
  const templateId = useListEditorStoreBase((state) => state.doc?.design.templateId)
  const applyTemplate = useListEditorStore.use.applyTemplate()
  const isGuest = !useAuthStore.use.user()
  const owned = useOwnedTemplates()
  const capabilities = useCapabilities()
  const { run } = usePdfDownload()
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [confirmingGuest, setConfirmingGuest] = useState(false)
  const [signingIn, setSigningIn] = useState(false)

  // Back from signing in to buy: open once the bought templates are known, unless this one is
  // among them by now (it may have been bought as a guest and moved to the account).
  useEffect(() => {
    if (owned === null || !templateId) return
    if (new URLSearchParams(window.location.search).get(CHECKOUT_QUERY) !== '1') return
    window.history.replaceState(null, '', window.location.pathname)
    if (!isPrintable(templateId, owned)) useEditorUiStoreBase.getState().setCheckoutOpen(true)
  }, [owned, templateId])

  if (!templateId || !listId) return null

  const template = tTemplates(`names.${templateId}`)
  const free = tTemplates(`names.${FREE_TEMPLATE_ID}`)
  const price = tCommon('amount', { amount: formatAmount(TEMPLATE_PRICE_AMD) })

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
      const checkoutUrl = await checkoutTemplateAPI({ templateId, ...(listId !== DRAFT_ID ? { listId } : {}) })
      trackEvent('begin_checkout', { currency: CURRENCY, value: TEMPLATE_PRICE_AMD, template: templateId })
      window.location.assign(checkoutUrl)
    } catch (failure) {
      setRedirecting(false)
      if (classifyError(failure).code === ERROR_CODES.templateAlreadyOwned) {
        // Bought meanwhile (another tab, a payment settled late): it prints now.
        await usePurchasesStoreBase.getState().refresh()
        close()
        const { doc } = useListEditorStoreBase.getState()
        if (doc) await run(listId, doc)
        return
      }
      setError(failure)
    }
  }

  const switchToFree = () => {
    applyTemplate(FREE_TEMPLATE_ID)
    close()
  }

  const unavailable = capabilities !== null && !capabilities.payments

  return (
    <>
      <Modal open={open} onCancel={close} footer={null} width={720} centered title={t('checkoutTitle', { template })} destroyOnHidden>
        <div className='grid gap-5 md:grid-cols-[200px_1fr]'>
          <div className='hidden overflow-hidden rounded-lg shadow-md ring-1 ring-black/5 md:block md:self-start'>
            <SheetThumb />
          </div>
          <section className='flex flex-col'>
            <p className='m-0 text-sm text-muted'>{t('checkoutLead')}</p>
            <p className='mt-3 mb-0 font-display text-3xl font-extrabold text-ink'>{price}</p>
            <ul className='m-0 my-4 flex list-none flex-col gap-2 p-0'>
              {(t.raw('includes') as string[]).map((item) => (
                <li key={item} className='flex gap-2 text-sm'>
                  <CheckOutlined className='mt-0.5 text-success' />
                  {item}
                </li>
              ))}
            </ul>
            {/* Margin on a wrapper: antd's Alert styles are unlayered and reset `margin`. */}
            <div className='mb-4'>
              <Alert type='info' showIcon title={t('lockNote', { template })} />
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
                disabled={unavailable}
                onClick={() => (isGuest ? setConfirmingGuest(true) : void pay())}
              >
                {redirecting ? t('redirecting') : t('pay', { price })}
              </Button>
            )}
            <div className='mt-5 border-t border-line pt-4'>
              <p className='m-0 text-sm font-semibold text-ink'>{t('freeTitle')}</p>
              <p className='mt-1 mb-3 text-sm text-muted'>{t('freeText', { free })}</p>
              <Button block disabled={redirecting} onClick={switchToFree}>
                {t('freeSwitch', { free })}
              </Button>
            </div>
          </section>
        </div>
        <p className='mt-5 mb-0 text-xs leading-relaxed'>{t('secure')}</p>
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
