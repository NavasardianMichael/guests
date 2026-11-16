'use client'

import { type FC, useCallback, useEffect, useState } from 'react'
import { PlusOutlined } from '@ant-design/icons'
import { Alert, App, Button, Empty, Skeleton, Tooltip } from 'antd'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@store/auth/store'
import { useListsStore } from '@store/lists/list/store'
import type { GuestList } from '@store/lists/single/types'
import { usePdfDownload } from '@hooks/usePdfDownload'
import { CHECKOUT_QUERY, editorPath, newListPath, RETURN_TO_QUERY, ROUTES } from '@constants/routes'
import { classifyError, errorCopyKey } from '@helpers/error'
import { clearLocalDraft, hasLocalDrafts, listLocalDrafts, type LocalDraft } from '@helpers/localDraft'
import { reportError } from '@helpers/reportError'
import { ErrorState } from '@components/ui/ErrorState'
import { AccessBanner } from './AccessBanner'
import { ListCard } from './ListCard'

export const DashboardClient: FC = () => {
  const t = useTranslations('Dashboard')
  const tCommon = useTranslations('Common')
  const tErrors = useTranslations('Errors')
  const list = useListsStore.use.list()
  const user = useAuthStore.use.user()
  const isResolved = useAuthStore.use.isResolved()
  // Signed out here means a guest: drafts in this browser, or a cookie that owns server lists (src/proxy.ts).
  const isGuest = isResolved && !user
  const isLoaded = useListsStore.use.isLoaded()
  const getLists = useListsStore.use.getLists()
  const duplicateList = useListsStore.use.duplicateList()
  const deleteList = useListsStore.use.deleteList()
  const { message, modal } = App.useApp()
  const { run } = usePdfDownload()
  const router = useRouter()
  /** A premium list without a running pass opens in the editor with the checkout, which shows what it buys. */
  const onDownload = async (item: GuestList) => {
    if ((await run(item.id, item)) === 'locked') router.push(`${editorPath(item.id)}?${CHECKOUT_QUERY}=1`)
  }
  const [loadError, setLoadError] = useState<unknown>(null)
  /** The API knows no owner here: signed out and no guest cookie, so no server lists. */
  const [noOwner, setNoOwner] = useState(false)
  /** This browser's drafts (`helpers/localDraft`); opening one signed in imports it to the account. */
  const [drafts, setDrafts] = useState<LocalDraft[]>([])

  const load = useCallback(
    () =>
      getLists().catch((failure: unknown) => {
        if (classifyError(failure).kind === 'unauthorized') return setNoOwner(true)
        reportError(failure, 'dashboard:list')
        setLoadError(failure)
      }),
    [getLists]
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    // localStorage exists only after hydration — the external system this effect reads.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDrafts(listLocalDrafts())
  }, [])

  // Nothing of theirs in this browser and not signed in: the dashboard is the account's.
  const nothingHere = isGuest && noOwner && !drafts.length && !hasLocalDrafts()
  useEffect(() => {
    if (nothingHere) router.replace(`${ROUTES.signIn}?${RETURN_TO_QUERY}=${encodeURIComponent(ROUTES.dashboard)}`)
  }, [nothingHere, router])

  const retry = () => {
    setLoadError(null)
    void load()
  }

  const showError = (failure: unknown) => message.error(tErrors(errorCopyKey(classifyError(failure))))

  const onDuplicate = (item: GuestList) =>
    modal.confirm({
      title: t('duplicateTitle', { title: item.title }),
      content: t('duplicateText'),
      okText: tCommon('duplicate'),
      cancelText: tCommon('cancel'),
      centered: true,
      onOk: () =>
        duplicateList(item.id)
          .then(() => message.success(t('duplicated')))
          .catch(showError),
    })

  const onDelete = (item: GuestList) =>
    modal.confirm({
      title: t('deleteTitle', { title: item.title }),
      content: t('deleteText'),
      okText: tCommon('delete'),
      okButtonProps: { danger: true },
      cancelText: tCommon('cancel'),
      centered: true,
      onOk: () =>
        deleteList(item.id)
          .then(() => message.success(t('deleted')))
          .catch(showError),
    })

  const onDeleteDraft = (draft: LocalDraft) =>
    modal.confirm({
      title: t('deleteTitle', { title: draft.doc.title }),
      content: t('deleteText'),
      okText: tCommon('delete'),
      okButtonProps: { danger: true },
      cancelText: tCommon('cancel'),
      centered: true,
      onOk: () => {
        clearLocalDraft(draft.id)
        setDrafts((current) => current.filter((item) => item.id !== draft.id))
        message.success(t('deleted'))
      },
    })

  /** A draft drawn as a list card; its id opens it in the editor, which imports it when signed in. */
  const draftList = (draft: LocalDraft): GuestList => ({ ...draft.doc, id: draft.id, createdAt: draft.savedAt, updatedAt: draft.savedAt })
  const lists = list.allIds.map((id) => list.byId[id])
  const loaded = isLoaded || noOwner
  const count = lists.length + drafts.length

  const body = () => {
    if (loadError) return <ErrorState error={loadError} onRetry={retry} />
    if (!loaded || nothingHere) {
      return (
        <div className='mt-10 grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-4'>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton.Node key={index} active className='aspect-210/297 h-auto! w-full! rounded-2xl' />
          ))}
        </div>
      )
    }
    if (!count) {
      return (
        <Empty
          className='mt-12 sm:mt-20'
          description={
            <>
              <strong className='block text-lg text-ink'>{t('emptyTitle')}</strong>
              <span className='text-muted'>{t('emptyText')}</span>
            </>
          }
        >
          <Link href={newListPath()}>
            <Button type='primary'>{t('new')}</Button>
          </Link>
        </Empty>
      )
    }
    return (
      <div className='mt-10 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-3 xl:grid-cols-4'>
        {drafts.map((draft) => (
          <ListCard
            key={draft.id}
            list={draftList(draft)}
            onDelete={() => onDeleteDraft(draft)}
            onDownload={(target) => void onDownload(target)}
          />
        ))}
        {lists.map((item) => (
          <ListCard
            key={item.id}
            list={item}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
            onDownload={(target) => void onDownload(target)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className='mx-auto max-w-page px-4 py-10 sm:py-20 md:px-6'>
      <div className='flex items-end justify-between gap-4'>
        <div className='min-w-0 flex-1'>
          <h1 className='m-0 font-display text-title font-extrabold tracking-tight text-ink sm:text-4xl'>{t('title')}</h1>
          <p className='mt-2 mb-0 text-muted'>{t('subtitle')}</p>
        </div>
        {/* With no lists the empty state carries its own button. */}
        {loaded && !loadError && count > 0 && (
          <Tooltip title={t('new')}>
            <Link href={newListPath()} className='shrink-0'>
              <Button color='primary' variant='dashed' size='large' className='bg-transparent!' shape='circle' icon={<PlusOutlined />} aria-label={t('new')} />
            </Link>
          </Tooltip>
        )}
      </div>
      {/* Margin on a wrapper: antd's Alert styles are unlayered and reset `margin`. */}
      {isGuest && !nothingHere && (
        <div className='mt-6'>
          <Alert
            type='warning'
            showIcon
            title={t('guestTitle')}
            description={t('guestText')}
            action={
              <Link href={`${ROUTES.signIn}?${RETURN_TO_QUERY}=${encodeURIComponent(ROUTES.dashboard)}`}>
                <Button size='small'>{t('guestSignIn')}</Button>
              </Link>
            }
          />
        </div>
      )}
      <AccessBanner className='mt-6' />
      {body()}
    </div>
  )
}
