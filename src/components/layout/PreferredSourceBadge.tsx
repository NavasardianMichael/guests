import type { FC } from 'react'
import { getTranslations } from 'next-intl/server'
import { GOOGLE_PREFERRED_SOURCE_URL } from '@constants/seo'
import { GoogleLogo } from '@components/ui/GoogleLogo'
import { ArrowRightOutlined } from '@components/ui/icons'

/**
 * "Add us as a preferred source on Google": Google's own page for this site, opened in a new
 * tab. A plain link in the app's colours rather than Google's script-drawn button.
 */
export const PreferredSourceBadge: FC = async () => {
  const t = await getTranslations('Footer')

  return (
    <a
      href={GOOGLE_PREFERRED_SOURCE_URL}
      target='_blank'
      rel='noopener noreferrer'
      className='group inline-flex max-w-full items-center gap-3 rounded-2xl border border-line bg-canvas py-2 pr-4 pl-2 text-ink no-underline transition hover:border-accent hover:bg-accent-soft hover:shadow-[0_10px_24px_-14px_rgba(20,24,45,0.4)]'
    >
      <span className='relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface shadow-sm ring-1 ring-line'>
        <GoogleLogo className='size-5' />
        <svg
          viewBox='0 0 16 16'
          className='absolute -top-1.5 -right-1.5 size-4 rounded-full bg-accent p-0.5 text-white ring-2 ring-surface'
          aria-hidden='true'
        >
          <path fill='currentColor' d='M8 1.5l1.9 4 4.3.5-3.2 2.9.9 4.3L8 11.1l-3.9 2.1.9-4.3L1.8 6l4.3-.5z' />
        </svg>
      </span>
      <span className='flex min-w-0 flex-col leading-tight'>
        <span className='text-[11px] text-muted'>{t('preferredSourceEyebrow')}</span>
        <span className='text-sm font-semibold'>{t('preferredSource')}</span>
      </span>
      <ArrowRightOutlined className='shrink-0 text-xs text-muted transition group-hover:translate-x-0.5 group-hover:text-accent-strong' />
    </a>
  )
}
