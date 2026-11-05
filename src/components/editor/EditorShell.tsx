'use client'

import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Drawer, Spin } from 'antd'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createListAPI, getListAPI } from '@api/lists/main'
import { useAuthStore } from '@store/auth/store'
import { useEditorUiStore } from '@store/editorUi/store'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import { DRAFT_ID, type ListDocument } from '@store/lists/single/types'
import { COMPACT_QUERY, useMediaQuery } from '@hooks/useMediaQuery'
import { editorPath, newListPath, RETURN_TO_QUERY, ROUTES } from '@constants/routes'
import { dedupe } from '@helpers/dedupe'
import { classifyError } from '@helpers/error'
import { sampleContent } from '@helpers/listFactory'
import { clearLocalDraft, readLocalDraft } from '@helpers/localDraft'
import { ErrorState } from '@components/ui/ErrorState'
import { CanvasZoomControl } from './canvas/CanvasZoomControl'
import { EditorCanvas } from './canvas/EditorCanvas'
import { EditorBottomBar } from './EditorBottomBar'
import { EditorSteps } from './EditorSteps'
import { EditorTopBar } from './EditorTopBar'
import { ImportModal } from './import/ImportModal'
import { EditorPanel, PanelBody, TabResetButton } from './panels/EditorPanel'
import { PreviewModal } from './PreviewModal'
import { Autosave } from './useAutosave'

type Props = { listId: string }

type LoadState = { phase: 'loading' } | { phase: 'importing' } | { phase: 'ready' } | { phase: 'error'; error: unknown }

/** The guests panel takes most of the screen; the others leave the sheet in view above them. */
const SHEET_SIZES = { kind: '62dvh', guests: '88dvh', layout: '62dvh', design: '70dvh', paper: '55dvh' } as const

/** A list with guests opens at them; an empty one at the first step, what is being made. */
const startStep = (doc: ListDocument) => (doc.content.guests.length > 0 ? 'guests' : 'kind')

/**
 * Opens one guest list for editing.
 *
 * - A server list needs a session (or this browser's guest key). Without either the user is
 *   sent to sign in and back.
 * - `draft` is a guest's local list. Once the user is signed in it is imported as a server
 *   list and the URL replaced — so signing in carries the work across.
 */
export const EditorShell: FC<Props> = ({ listId }) => {
  const t = useTranslations('Editor')
  const tCommon = useTranslations('Common')
  const router = useRouter()
  const user = useAuthStore.use.user()
  const isResolved = useAuthStore.use.isResolved()
  const loadDocument = useListEditorStore.use.loadDocument()
  const doc = useListEditorStore.use.doc()
  const openListId = useListEditorStore.use.listId()
  const select = useListEditorStore.use.select()
  const tab = useEditorUiStore.use.tab()
  const sheetOpen = useEditorUiStore.use.sheetOpen()
  const setSheetOpen = useEditorUiStore.use.setSheetOpen()
  const [state, setState] = useState<LoadState>({ phase: 'loading' })
  const [zoom, setZoom] = useState<number | null>(null)
  const [fitZoom, setFitZoom] = useState(1)
  const [pages, setPages] = useState(1)
  const [previewing, setPreviewing] = useState(false)
  const compact = useMediaQuery(COMPACT_QUERY)
  const tTabs = useTranslations('Editor.tabs')
  const tSamples = useTranslations('Samples')

  // Until the list has guests, every step but Guests draws the sheet on sample names, so a
  // design is chosen on something that looks like the result. Never saved, never printed.
  const kind = doc?.design.kind
  const sample = useMemo(
    () =>
      kind
        ? sampleContent(
            {
              heading: tSamples('heading'),
              subheading: tSamples('subheading'),
              footer: tSamples('footer'),
              table: (number) => tSamples('table', { number }),
            },
            kind === 'cards' ? 2 : undefined
          )
        : null,
    [kind, tSamples]
  )
  const showSample = Boolean(doc && sample && doc.content.guests.length === 0 && tab !== 'guests')
  const canvasDoc = useMemo(
    () =>
      doc && sample && showSample
        ? { ...doc, content: { ...doc.content, guests: sample.guests, tables: sample.tables } }
        : doc,
    [doc, sample, showSample]
  )

  const load = useCallback(async () => {
    if (listId === DRAFT_ID) {
      const draft = readLocalDraft()
      if (!draft) return router.replace(newListPath())
      if (!user) {
        loadDocument({ listId: DRAFT_ID, doc: draft, paidAt: null })
        useEditorUiStore.getState().startAt(startStep(draft))
        return setState({ phase: 'ready' })
      }
      setState({ phase: 'importing' })
      const createdId = await dedupe('import-draft', async () => {
        const created = await createListAPI(draft)
        clearLocalDraft()
        return created.id
      })
      return router.replace(editorPath(createdId))
    }

    let list
    try {
      list = await getListAPI({ id: listId })
    } catch (error) {
      // Signed out and not this browser's guest list: it may be an account's, so sign in and back.
      const { kind } = classifyError(error)
      if (user || (kind !== 'unauthorized' && kind !== 'notFound')) throw error
      return router.replace(`${ROUTES.signIn}?${RETURN_TO_QUERY}=${encodeURIComponent(editorPath(listId))}`)
    }
    const loaded: ListDocument = { title: list.title, content: list.content, design: list.design }
    loadDocument({ listId: list.id, doc: loaded, paidAt: list.paidAt })
    useEditorUiStore.getState().startAt(startStep(loaded))
    setState({ phase: 'ready' })
  }, [listId, loadDocument, router, user])

  useEffect(() => {
    if (!isResolved) return
    // Opening the document reads localStorage (a guest's draft) and the API once the session
    // is known — the external systems this effect exists to synchronise with.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch((error: unknown) => setState({ phase: 'error', error }))
  }, [isResolved, load])

  // Leaving the editor drops the document, so the next one never flashes the previous.
  useEffect(
    () => () => {
      useListEditorStoreBase.getState().reset()
      useEditorUiStore.getState().setSheetOpen(false)
    },
    []
  )

  if (state.phase === 'error') {
    return (
      <div className='grid min-h-dvh place-items-center bg-canvas p-6'>
        <ErrorState
          error={state.error}
          title={t('loadFailed')}
          onRetry={() => {
            setState({ phase: 'loading' })
            load().catch((error: unknown) => setState({ phase: 'error', error }))
          }}
          extra={
            <Link href={user ? ROUTES.dashboard : ROUTES.home}>
              <Button>{tCommon('back')}</Button>
            </Link>
          }
        />
      </div>
    )
  }

  if (state.phase !== 'ready' || !doc || !canvasDoc) {
    return (
      <div className='grid min-h-dvh place-items-center bg-canvas'>
        <Spin size='large' description={state.phase === 'importing' ? t('importing') : tCommon('loading')} />
      </div>
    )
  }

  const openPreview = () => {
    select([])
    setPreviewing(true)
  }

  return (
    <div className='flex h-dvh flex-col bg-canvas'>
      <Autosave />
      <EditorTopBar zoom={zoom} fitZoom={fitZoom} pages={pages} onZoomChange={setZoom} onPreview={openPreview} />
      <EditorSteps />
      {!user && openListId === DRAFT_ID && (
        <div className='flex shrink-0 items-center justify-center gap-3 bg-accent-soft px-3 py-1 text-center text-[11px] leading-snug sm:px-4 sm:py-1.5 sm:text-xs'>
          <span>{t('guestBanner')}</span>
          <Link
            href={`${ROUTES.signIn}?${RETURN_TO_QUERY}=${encodeURIComponent(editorPath(DRAFT_ID))}`}
            className='shrink-0 font-semibold text-ink underline'
          >
            {t('guestBannerCta')}
          </Link>
        </div>
      )}
      <div className='flex min-h-0 flex-1'>
        <aside
          className='hidden w-96 shrink-0 border-r border-line bg-surface lg:flex lg:flex-col'
          aria-label={t('panelOpen')}
        >
          <EditorPanel />
        </aside>
        <div className='relative flex min-w-0 flex-1'>
          <EditorCanvas
            doc={canvasDoc}
            sample={showSample}
            zoom={zoom}
            onZoomChange={setZoom}
            previewing={previewing}
            onPagesChange={setPages}
            onFitZoomChange={setFitZoom}
          />
          {compact && <CanvasZoomControl zoom={zoom} fitZoom={fitZoom} onZoomChange={setZoom} />}
        </div>
      </div>
      <EditorBottomBar onPreview={openPreview} />
      <PreviewModal open={previewing} onClose={() => setPreviewing(false)} doc={doc} />
      {compact && (
        <Drawer
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          placement='bottom'
          size={SHEET_SIZES[tab]}
          title={tTabs(tab)}
          extra={<TabResetButton tab={tab} />}
          destroyOnHidden
          styles={{
            wrapper: { borderRadius: '16px 16px 0 0', overflow: 'hidden' },
            header: { padding: '12px 16px' },
            body: { padding: '16px 16px calc(32px + env(safe-area-inset-bottom))' },
            mask: { background: 'rgba(20, 24, 45, 0.18)' },
          }}
        >
          <PanelBody tab={tab} />
        </Drawer>
      )}
      <ImportModal />
    </div>
  )
}
