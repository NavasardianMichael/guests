'use client'

import { type FC, type ReactNode, useState } from 'react'
import {
  AppstoreOutlined,
  HomeOutlined,
  MenuOutlined,
  PlusOutlined,
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
import { AccountMenu } from './AccountMenu'
import { BrandLogo } from './BrandLogo'
import { LanguageSwitcher } from './LanguageSwitcher'

/** `icon` shows only in the mobile drawer; the desktop bar stays text. */
type NavItem = { href: string; label: string; icon: ReactNode }

export const Header: FC = () => {
  const t = useTranslations('Nav')
  const pathname = usePathname()
  const user = useAuthStore.use.user()
  const [open, setOpen] = useState(false)

  const items: NavItem[] = [
    { href: ROUTES.templates, label: t('templates'), icon: <AppstoreOutlined /> },
    { href: ROUTES.pricing, label: t('pricing'), icon: <WalletOutlined /> },
    ...(user ? [{ href: ROUTES.dashboard, label: t('dashboard'), icon: <SnippetsOutlined /> }] : []),
  ]

  const isActive = (href: string): boolean => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <header className='sticky top-0 z-40 border-b border-line/70 bg-canvas/80 backdrop-blur-md'>
      <div className='mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-6 md:px-6'>
        <BrandLogo />
        <nav className='hidden items-center gap-1 md:flex' aria-label={t('menu')}>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-[15px] font-medium text-muted no-underline transition-colors hover:text-ink',
                isActive(item.href) && 'bg-surface text-ink shadow-sm'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className='ml-auto flex shrink-0 items-center gap-2'>
          <LanguageSwitcher className='hidden lg:flex' />
          <Link href={newListPath()} className='hidden sm:block'>
            <Button type='primary' shape='round'>
              {t('create')}
            </Button>
          </Link>
          <AccountMenu />
          {/* `md:hidden` on a wrapper: antd's Button styles are unlayered and its `display` beats
              Tailwind's utilities, so on the Button itself the menu showed beside the nav links. */}
          <span className='flex md:hidden'>
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
                isActive(item.href) && 'bg-canvas'
              )}
            >
              <span className='flex text-lg text-muted' aria-hidden='true'>
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
          <LanguageSwitcher className='mt-4' />
        </nav>
      </Drawer>
    </header>
  )
}
