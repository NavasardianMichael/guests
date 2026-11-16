'use client'

import { type FC, type ReactNode, useState, useSyncExternalStore } from 'react'
import {
  AppstoreOutlined,
  FileTextOutlined,
  HomeOutlined,
  MenuOutlined,
  PlusOutlined,
  ReadOutlined,
  SnippetsOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { Button, Drawer } from 'antd'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@store/auth/store'
import { newListPath, ROUTES } from '@constants/routes'
import { cn } from '@helpers/cn'
import { hasLocalDrafts } from '@helpers/localDraft'
import { AccountMenu } from './AccountMenu'
import { BrandLogo } from './BrandLogo'

/** `icon` shows only in the mobile drawer; the desktop bar stays text. */
type NavItem = { href: string; label: string; icon: ReactNode }

/**
 * localStorage has no change event within a tab. The site's header remounts whenever the
 * editor is left (another layout), which is where a draft appears.
 */
const subscribeNever = (): (() => void) => () => undefined

export const Header: FC = () => {
  const t = useTranslations('Nav')
  const pathname = usePathname()
  const user = useAuthStore.use.user()
  // A guest with drafts in this browser gets the way back to them ("My lists").
  const guestDrafts = useSyncExternalStore(subscribeNever, hasLocalDrafts, () => false)
  const [open, setOpen] = useState(false)

  const items: NavItem[] = [
    { href: ROUTES.templates, label: t('templates'), icon: <AppstoreOutlined /> },
    { href: ROUTES.examples, label: t('examples'), icon: <FileTextOutlined /> },
    { href: ROUTES.guides, label: t('guides'), icon: <ReadOutlined /> },
    { href: ROUTES.pricing, label: t('pricing'), icon: <WalletOutlined /> },
    ...(user || guestDrafts ? [{ href: ROUTES.dashboard, label: t('dashboard'), icon: <SnippetsOutlined /> }] : []),
  ]
  // Five links leave no room for the full "create" button until ~1400px; between the desktop
  // menu's breakpoint (xl) and that, it becomes a round + with the same label for screen readers.
  const crowded = items.length > 4

  const isActive = (href: string): boolean => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <header className='sticky top-0 z-40 border-b border-line/70 bg-canvas/80 backdrop-blur-md'>
      <div className='mx-auto flex h-16 max-w-page items-center gap-3 px-4 sm:gap-6 md:px-6'>
        <BrandLogo />
        {/* From xl: below it the logo and the menu do not fit side by side (the drawer has them). */}
        <nav className='hidden items-center gap-1 xl:flex' aria-label={t('menu')}>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              // The current page: dark text and an accent bar under it, no background.
              className={cn(
                'relative px-3.5 py-1.5 text-[15px] font-medium text-muted no-underline transition-colors hover:text-ink',
                isActive(item.href) &&
                  'text-ink after:absolute after:inset-x-3.5 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-accent'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className='ml-auto flex shrink-0 items-center gap-2'>
          <Link href={newListPath()} className={cn('hidden sm:block', crowded && 'xl:hidden min-[1400px]:block')}>
            <Button type='primary' shape='round'>
              {t('create')}
            </Button>
          </Link>
          {crowded && (
            <Link href={newListPath()} className='hidden xl:block min-[1400px]:hidden' aria-label={t('create')} title={t('create')}>
              <Button type='primary' shape='circle' icon={<PlusOutlined />} tabIndex={-1} />
            </Link>
          )}
          <AccountMenu />
          {/* `xl:hidden` on a wrapper: antd's Button styles are unlayered and its `display` beats
              Tailwind's utilities, so on the Button itself the menu showed beside the nav links. */}
          <span className='flex xl:hidden'>
            <Button type='text' icon={<MenuOutlined />} aria-label={t('menu')} onClick={() => setOpen(true)} />
          </span>
        </div>
      </div>
      <Drawer open={open} onClose={() => setOpen(false)} placement='right' size='default' title={t('menu')}>
        <nav className='flex flex-col gap-1'>
          {[{ href: ROUTES.home, label: t('home'), icon: <HomeOutlined /> }, ...items].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium no-underline hover:bg-canvas',
                isActive(item.href) && 'text-accent-strong'
              )}
            >
              <span className={cn('flex text-lg', isActive(item.href) ? 'text-accent' : 'text-muted')} aria-hidden='true'>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
          <Link href={newListPath()} onClick={() => setOpen(false)} className='mt-4'>
            <Button type='primary' block size='large' icon={<PlusOutlined />}>
              {t('create')}
            </Button>
          </Link>
        </nav>
      </Drawer>
    </header>
  )
}
