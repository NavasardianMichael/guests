import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { Footer } from '@components/layout/Footer'
import { Header } from '@components/layout/Header'

/** Marketing pages, auth, dashboard: header and footer. The editor has its own full-screen shell. */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('Common')
  return (
    <div className='flex min-h-dvh flex-col'>
      <a
        href='#main'
        className='sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2'
      >
        {t('skipToContent')}
      </a>
      <Header />
      <main id='main' className='flex-1'>
        {children}
      </main>
      <Footer />
    </div>
  )
}
