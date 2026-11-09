'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@store/auth/store'
import { usePurchasesStore, usePurchasesStoreBase } from '@store/purchases/store'
import type { TemplateId } from '@constants/templates'

/**
 * The templates the visitor has bought — the account's once signed in, else this browser's
 * (its guest key). Null until known: callers treat that as "not yet", never as "none".
 */
export const useOwnedTemplates = (): readonly TemplateId[] | null => {
  const user = useAuthStore.use.user()
  const isResolved = useAuthStore.use.isResolved()
  const templates = usePurchasesStore.use.templates()
  const loadedFor = usePurchasesStore.use.loadedFor()
  const owner = isResolved ? (user?.id ?? 'guest') : null

  useEffect(() => {
    if (owner) void usePurchasesStoreBase.getState().load(owner)
  }, [owner])

  return owner && loadedFor === owner ? templates : null
}

/** Whether the visitor owns this template; false while unknown. */
export const useOwnsTemplate = (templateId: TemplateId): boolean => Boolean(useOwnedTemplates()?.includes(templateId))
