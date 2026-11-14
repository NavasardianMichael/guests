'use client'

import { type FC, useCallback, useEffect, useRef, useState } from 'react'
import { Button, Modal, Result, Spin } from 'antd'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createListAPI } from '@api/lists/main'
import { useAuthStore } from '@store/auth/store'
import { useEditorUiStore } from '@store/editorUi/store'
import { DRAFT_ID, type ListDocument, type PrintKind, type SheetShape } from '@store/lists/single/types'
import { useSampleTexts } from '@hooks/useSampleTexts'
import { editorPath, newListPath, RETURN_TO_QUERY, ROUTES } from '@constants/routes'
import type { TemplateId } from '@constants/templates'
import { dedupe } from '@helpers/dedupe'
import { startingPlanScale } from '@helpers/fitSheet'
import { newListDocument } from '@helpers/listFactory'
import { readLocalDraft, writeLocalDraft } from '@helpers/localDraft'
import { measureText } from '@helpers/measureText'
import { ErrorState } from '@components/ui/ErrorState'

type Props = { templateId: TemplateId; kind: PrintKind; shape: SheetShape }

/**
 * Starts a list — on the sample wedding's guests, the user's to change — and opens it at the
 * first step. Signed in: created on the server. Guest: written as the local draft — after
 * asking, if a draft is already there, since there is only one. A browser that refuses to store
 * it (site data blocked) is told so here: the editor reads the draft back, and opening it without
 * one would send the guest straight back to this page.
 */
export const NewListClient: FC<Props> = ({ templateId, kind, shape }) => {
  const t = useTranslations('Editor')
  const tCommon = useTranslations('Common')
  const texts = useSampleTexts()
  const router = useRouter()
  const user = useAuthStore.use.user()
  const isResolved = useAuthStore.use.isResolved()
  const [askReplace, setAskReplace] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [storageBlocked, setStorageBlocked] = useState(false)

  const build = useCallback((): ListDocument => {
    const doc = newListDocument(templateId, kind, { title: t('untitled'), shape, texts })
    // A hall plan starts on one page, as when it is picked in the editor (KindPanel).
    const textScale = startingPlanScale(doc, measureText)
    return textScale === null ? doc : { ...doc, design: { ...doc.design, textScale } }
  }, [kind, shape, t, texts, templateId])

  const startDraft = useCallback(() => {
    if (!writeLocalDraft(build())) {
      setAskReplace(false)
      return setStorageBlocked(true)
    }
    useEditorUiStore.getState().markJustCreated(DRAFT_ID)
    router.replace(editorPath(DRAFT_ID))
  }, [build, router])

  const start = useCallback(async () => {
    if (user) {
      const id = await dedupe(`new-list:${templateId}:${kind}:${shape}`, async () => (await createListAPI(build())).id)
      useEditorUiStore.getState().markJustCreated(id)
      return router.replace(editorPath(id))
    }
    if (readLocalDraft()) return setAskReplace(true)
    startDraft()
  }, [build, kind, router, shape, startDraft, templateId, user])

  // Once per visit: a re-render must never start a second list.
  const startedRef = useRef(false)
  useEffect(() => {
    if (!isResolved || startedRef.current) return
    startedRef.current = true
    // Reading localStorage (is there a draft?) is an external system; asking about it from
    // here, once the session is known, is what this effect is for.
    start().catch(setError)
  }, [isResolved, start])

  if (storageBlocked) {
    return (
      <div className='grid min-h-dvh place-items-center p-6'>
        <Result
          status='warning'
          title={t('storageBlockedTitle')}
          subTitle={t('storageBlockedText')}
          extra={
            <div className='flex flex-wrap justify-center gap-2'>
              <Link href={`${ROUTES.signIn}?${RETURN_TO_QUERY}=${encodeURIComponent(newListPath({ template: templateId, kind, shape }))}`}>
                <Button type='primary'>{t('guestBannerCta')}</Button>
              </Link>
              <Link href={ROUTES.templates}>
                <Button>{tCommon('back')}</Button>
              </Link>
            </div>
          }
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className='grid min-h-dvh place-items-center p-6'>
        <ErrorState
          error={error}
          onRetry={() => {
            setError(null)
            start().catch(setError)
          }}
          extra={
            <Link href={ROUTES.templates}>
              <Button>{tCommon('back')}</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className='grid min-h-dvh place-items-center bg-canvas'>
      <Spin size='large' description={tCommon('loading')} />
      <Modal
        open={askReplace}
        title={t('replaceDraftTitle')}
        closable={false}
        mask={{ closable: false }}
        onOk={startDraft}
        okText={t('replaceDraft')}
        cancelText={t('keepDraft')}
        onCancel={() => router.replace(editorPath(DRAFT_ID))}
      >
        {t('replaceDraftText')}
      </Modal>
    </div>
  )
}
