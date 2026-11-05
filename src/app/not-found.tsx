import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { ROUTES } from '@constants/routes'
import { BrandLogo } from '@components/layout/BrandLogo'

export default async function NotFound() {
  const t = await getTranslations('Errors')
  const tNav = await getTranslations('Nav')
  return (
    <div className='mesh-bg grid min-h-dvh place-items-center px-4 text-center'>
      <div className='w-full max-w-md'>
        <BrandLogo className='justify-center' />
        <p className='mt-10 mb-0 font-display text-8xl font-extrabold text-accent'>404</p>
        <h1 className='mt-2 font-display text-title font-extrabold text-ink sm:text-3xl'>{t('notFoundTitle')}</h1>
        <p className='mt-3 text-muted'>{t('notFoundText')}</p>
        <Link href={ROUTES.home} className='mt-6 inline-flex rounded-full bg-ink px-6 py-3 font-semibold text-white no-underline'>
          {tNav('home')}
        </Link>
      </div>
    </div>
  )
}
