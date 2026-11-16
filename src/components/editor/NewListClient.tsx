'use client'

import { type FC, useCallback, useEffect, useRef, useState } from 'react'
import { Button, Result, Spin } from 'antd'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createListAPI } from '@api/lists/main'
import { useAuthStore } from '@store/auth/store'
import { useEditorUiStore } from '@store/editorUi/store'
import type { ListDocument, PrintKind, SheetShape } from '@store/lists/single/types'
import { useSampleTexts } from '@hooks/useSampleTexts'
import { editorPath, newListFromExamplePath, newListPath, RETURN_TO_QUERY, ROUTES } from '@constants/routes'
import type { TemplateId } from '@constants/templates'
import { dedupe } from '@helpers/dedupe'
import { startingPlanScale } from '@helpers/fitSheet'
import { newListDocument } from '@helpers/listFactory'
import { startLocalDraft } from '@helpers/localDraft'
import { measureText } from '@helpers/measureText'
import { ErrorState } from '@components/ui/ErrorState'

type Props = {
  templateId: TemplateId
  kind: PrintKind
  shape: SheetShape
  /** An event example page's list to start from (`?example=`), or null. */
  example: { slug: string; doc: ListDocument } | null
}

/**
 * Starts a list — on the sample wedding's guests, the user's to change, or on an event example's
 * list — and opens it at the first step. Signed in: created on the server. Guest: kept as a new
 * local draft beside any others (`helpers/localDraft`), so nothing is replaced and nothing is
 * asked. A browser that refuses to store it (site data blocked) is told so here: the editor reads
 * the draft back, and opening it without one would send the guest straight back to this page.
 */
export const NewListClient: FC<Props> = ({ templateId, kind, shape, example }) => {
  const t = useTranslations('Editor')
  const tCommon = useTranslations('Common')
  const texts = useSampleTexts()
  const router = useRouter()
  const user = useAuthStore.use.user()
  const isResolved = useAuthStore.use.isResolved()
  const [error, setError] = useState<unknown>(null)
  const [storageBlocked, setStorageBlocked] = useState(false)

  const build = useCallback((): ListDocument => {
    // The example's own list, as its page shows it (already fitted to its page).
    if (example) return structuredClone(example.doc)
    const doc = newListDocument(templateId, kind, { title: t('untitled'), shape, texts })
    // A hall plan starts on one page, as when it is picked in the editor (KindPanel).
    const textScale = startingPlanScale(doc, measureText)
    return textScale === null ? doc : { ...doc, design: { ...doc.design, textScale } }
  }, [example, kind, shape, t, texts, templateId])

  const start = useCallback(async () => {
    const id = user
      ? await dedupe(`new-list:${templateId}:${kind}:${shape}:${example?.slug ?? ''}`, async () => (await createListAPI(build())).id)
      : startLocalDraft(build())
    if (!id) return setStorageBlocked(true)
    useEditorUiStore.getState().markJustCreated(id)
    router.replace(editorPath(id))
  }, [build, example, kind, router, shape, templateId, user])

  // Once per visit: a re-render must never start a second list.
  const startedRef = useRef(false)
  useEffect(() => {
    if (!isResolved || startedRef.current) return
    startedRef.current = true
    // Writing the guest's draft to localStorage (an external system) once the session is known
    // is what this effect is for; it reports a refusal through state.
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
              <Link href={`${ROUTES.signIn}?${RETURN_TO_QUERY}=${encodeURIComponent(example ? newListFromExamplePath(example.slug) : newListPath({ template: templateId, kind, shape }))}`}>
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
    </div>
  )
}
