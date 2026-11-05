'use client'

import { cloneElement, type CSSProperties, type FC, isValidElement, type ReactElement, type ReactNode } from 'react'
import { DownOutlined, LogoutOutlined, SettingOutlined, SnippetsOutlined } from '@ant-design/icons'
import { App, Avatar, Button, Dropdown, type MenuProps, Skeleton } from 'antd'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@store/auth/store'
import { ROUTES } from '@constants/routes'
import { classifyError, errorCopyKey } from '@helpers/error'

/**
 * Inline, not `bg-ink`: antd's Avatar styles are unlayered and beat Tailwind's utilities layer.
 * Navy disc with apricot initials, the brand mark's two colours.
 */
const AVATAR_STYLE: CSSProperties = {
  background: 'var(--brand-ink)',
  color: 'var(--brand-accent)',
  fontFamily: 'var(--font-ui), sans-serif',
  fontWeight: 700,
}

/** Up to two letters for an avatar: the first of the first two words. */
const initialsOf = (fullName: string): string =>
  fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')

/** Sign-in button for a guest, avatar menu for a user, a placeholder while the session resolves. */
export const AccountMenu: FC = () => {
  const t = useTranslations('Nav')
  const tErrors = useTranslations('Errors')
  const user = useAuthStore.use.user()
  const isResolved = useAuthStore.use.isResolved()
  const logout = useAuthStore.use.logout()
  const router = useRouter()
  const { message } = App.useApp()

  if (!isResolved) return <Skeleton.Avatar active />

  if (!user) {
    return (
      <Link href={ROUTES.signIn}>
        <Button type='text'>{t('signIn')}</Button>
      </Link>
    )
  }

  const initials = initialsOf(user.fullName)
  const firstName = user.fullName.split(/\s+/)[0] ?? ''
  const items: MenuProps['items'] = [
    { key: 'dashboard', icon: <SnippetsOutlined />, label: <Link href={ROUTES.dashboard}>{t('dashboard')}</Link> },
    { key: 'account', icon: <SettingOutlined />, label: <Link href={ROUTES.account}>{t('account')}</Link> },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('signOut'),
      onClick: () => {
        logout()
          .then(() => router.push(ROUTES.home))
          .catch((error: unknown) => message.error(tErrors(errorCopyKey(classifyError(error)))))
      },
    },
  ]

  // A header card above the menu; the menu drops its own shadow so the two read as one panel.
  const renderPopup = (menu: ReactNode): ReactNode => (
    <div className='min-w-60 overflow-hidden rounded-xl border border-line bg-surface shadow-lg'>
      <div className='flex items-center gap-3 border-b border-line bg-canvas px-4 py-3'>
        <Avatar size={40} src={user.avatarUrl ?? undefined} style={AVATAR_STYLE}>
          {initials}
        </Avatar>
        <div className='min-w-0'>
          <div className='max-w-52 truncate font-semibold text-ink'>{user.fullName}</div>
          <div className='max-w-52 truncate text-xs text-muted'>{user.email}</div>
        </div>
      </div>
      {isValidElement(menu)
        ? cloneElement(menu as ReactElement<{ style?: CSSProperties }>, { style: { boxShadow: 'none' } })
        : menu}
    </div>
  )

  return (
    <Dropdown menu={{ items }} popupRender={renderPopup} placement='bottomRight' trigger={['click']}>
      <button
        type='button'
        aria-label={user.fullName}
        className='group flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface p-0.5 shadow-sm transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:pr-3'
      >
        <Avatar size={32} src={user.avatarUrl ?? undefined} style={AVATAR_STYLE} className='ring-2 ring-accent-soft'>
          {initials}
        </Avatar>
        <span className='hidden max-w-28 truncate text-sm font-semibold text-ink sm:inline'>{firstName}</span>
        <DownOutlined className='hidden text-[10px] text-muted transition-colors group-hover:text-accent-strong sm:inline' />
      </button>
    </Dropdown>
  )
}
