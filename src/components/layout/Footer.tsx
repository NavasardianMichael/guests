import type { FC } from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { APP_NAME } from '@constants/app'
import { FONTS_SOURCE_URL } from '@constants/fonts'
import { ROUTES } from '@constants/routes'
import { BrandLogo } from './BrandLogo'
import { LanguageSwitcher } from './LanguageSwitcher'

export const Footer: FC = async () => {
  const t = await getTranslations('Footer')
  const tNav = await getTranslations('Nav')

  const columns = [
    {
      title: t('product'),
      links: [
        { href: ROUTES.templates, label: tNav('templates') },
        { href: ROUTES.pricing, label: tNav('pricing') },
        { href: ROUTES.contact, label: tNav('contact') },
        { href: ROUTES.signIn, label: tNav('signIn') },
      ],
    },
    {
      title: t('legal'),
      links: [
        { href: ROUTES.terms, label: t('terms') },
        { href: ROUTES.privacy, label: t('privacy') },
      ],
    },
  ]

  return (
    <footer className='mt-24 border-t border-line bg-surface'>
      <div className='mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-[2fr_1fr_1fr] md:px-6'>
        <div className='max-w-sm'>
          <BrandLogo />
          <p className='mt-4 text-sm leading-relaxed text-muted'>{t('tagline')}</p>
          <p className='mt-3 text-xs text-muted'>
            {t.rich('fonts', {
              link: (chunks) => (
                <a
                  href={FONTS_SOURCE_URL}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-muted underline hover:text-ink'
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className='mb-3 text-sm font-semibold text-ink'>{column.title}</h2>
            <ul className='m-0 flex list-none flex-col p-0'>
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className='text-sm text-muted no-underline hover:text-ink'>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className='border-t border-line'>
        <div className='mx-auto flex max-w-7xl flex-col-reverse items-center justify-between gap-3 px-4 py-4 sm:flex-row md:px-6'>
          <p className='m-0 text-xs text-muted'>{t('rights', { year: new Date().getFullYear(), name: APP_NAME })}</p>
          {/* The only language switch on the site: the interface language is a cookie, set rarely. */}
          <LanguageSwitcher size='small' />
        </div>
      </div>
    </footer>
  )
}
