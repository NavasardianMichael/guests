'use client'

import type { FC } from 'react'
import { Button, Divider, Modal } from 'antd'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CHECKOUT_QUERY, editorPath, RETURN_TO_QUERY, ROUTES } from '@constants/routes'
import { GoogleButton } from '@components/auth/GoogleButton'

/**
 * A guest chose to sign in before paying, so the access pass belongs to an account. They come
 * back to the same list with the checkout open: a draft is imported on arrival (`EditorShell`
 * keeps the query), and a pass they already bought as a guest has been moved to the account by
 * the API — while it runs, the checkout then does not open.
 */
export const SignInToBuyModal: FC<{ listId: string; open: boolean; onClose: () => void }> = ({ listId, open, onClose }) => {
  const t = useTranslations('Editor.download')
  const tAuth = useTranslations('Auth')
  const tCommon = useTranslations('Common')
  const returnTo = `${editorPath(listId)}?${CHECKOUT_QUERY}=1`
  const query = `?${RETURN_TO_QUERY}=${encodeURIComponent(returnTo)}`

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={t('signInTitle')} width={440} centered>
      <p className='mb-5 text-muted'>{t('signInText')}</p>
      <div className='flex flex-col gap-3'>
        <GoogleButton returnTo={returnTo} />
        <Divider plain className='my-1 text-xs text-muted'>
          {tCommon('or')}
        </Divider>
        <Link href={`${ROUTES.signIn}${query}`}>
          <Button block size='large' type='primary'>
            {t('signInEmail')}
          </Button>
        </Link>
        <p className='text-center text-sm text-muted'>
          {tAuth('noAccount')}{' '}
          <Link href={`${ROUTES.signUp}${query}`} className='font-semibold text-ink'>
            {tAuth('signUpTitle')}
          </Link>
        </p>
      </div>
    </Modal>
  )
}
