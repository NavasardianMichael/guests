'use client'

import { type FC, useEffect } from 'react'
import { Button, Modal } from 'antd'
import { useTranslations } from 'next-intl'
import { leaveReason, useLeaveGuardStore, useLeaveGuardStoreBase } from '@store/navigation/guard/store'
import { confirmLeave } from '@hooks/useLeaveGuard'

/** Our marker on the extra history entry that catches the back button. Next's own state is kept beside it. */
const SENTINEL = '__leaveGuard'

const onSentinel = (): boolean => Boolean((window.history.state as Record<string, unknown> | null)?.[SENTINEL])

const pushSentinel = (): void =>
  window.history.pushState({ ...(window.history.state as Record<string, unknown> | null), [SENTINEL]: true }, '', window.location.href)

const isLeaving = (): boolean => useLeaveGuardStoreBase.getState().leaving

/**
 * Enforces `useLeaveGuard` (the App Router has no navigation blocker; ported from
 * who-wants-to-be-a-millionaire):
 *
 * - **closing the tab, reloading, leaving the site** — `beforeunload`, so the browser shows
 *   its own dialog (browsers no longer allow custom text there);
 * - **an internal link** — a capture-phase click listener runs before Next's `Link` handler,
 *   holds the navigation and asks; "leave" replays the click;
 * - **the back button** — a sentinel history entry on top of the page: going back lands on
 *   the page itself, which is put back and the question asked; "leave" goes back past both;
 * - **a router call** — its caller awaits `confirmLeave()` first.
 *
 * Once the user agrees, `leaving` lets the navigation through, so a full page load that
 * follows does not ask a second time.
 */
export const LeaveGuard: FC = () => {
  const t = useTranslations('Common')
  const guards = useLeaveGuardStore.use.guards()
  const question = useLeaveGuardStore.use.question()
  const answer = useLeaveGuardStore.use.answer()
  const active = leaveReason(guards) !== null

  useEffect(() => {
    if (!active) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isLeaving()) return
      event.preventDefault()
      // Older browsers still need `returnValue` to show the dialog.
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [active])

  useEffect(() => {
    if (!active) return
    const onClick = (event: MouseEvent) => {
      if (isLeaving() || event.defaultPrevented) return
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element | null)?.closest?.('a[href]')
      if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download')) return
      if (anchor.target && anchor.target !== '_self') return
      const url = new URL(anchor.href, window.location.href)
      // Another origin unloads the page, where `beforeunload` asks; the same page (or a hash) loses nothing.
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      event.preventDefault()
      event.stopPropagation()
      void confirmLeave().then((leave) => {
        if (leave) anchor.click()
      })
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [active])

  useEffect(() => {
    if (!active) return
    const href = window.location.href
    // Not when this page is the first entry: Back then leaves the site, and `beforeunload` asks.
    if (!onSentinel() && (typeof navigation === 'undefined' || navigation.canGoBack)) pushSentinel()

    const onPopState = () => {
      if (isLeaving() || window.location.href !== href || onSentinel()) return
      pushSentinel()
      void confirmLeave().then((leave) => {
        if (leave) window.history.go(-2)
      })
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      // Nothing to guard any more while still on the page (the save landed): drop the sentinel
      // so the back button needs one press again. Checked a tick later, once a navigation or a
      // new guard has settled.
      setTimeout(() => {
        const guarded = leaveReason(useLeaveGuardStoreBase.getState().guards) !== null
        if (!guarded && window.location.href === href && onSentinel()) window.history.back()
      })
    }
  }, [active])

  const stay = () => answer(false)

  return (
    <Modal
      open={question !== null}
      onCancel={stay}
      title={t('unsavedTitle')}
      centered
      footer={[
        <Button key='stay' onClick={stay}>
          {t('stay')}
        </Button>,
        <Button key='leave' danger type='primary' onClick={() => answer(true)}>
          {t('leave')}
        </Button>,
      ]}
    >
      {t('unsavedBody')}
    </Modal>
  )
}
