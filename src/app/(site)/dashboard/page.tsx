import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { privateMetadata } from '@helpers/metadata'
import { DashboardClient } from '@components/dashboard/DashboardClient'
import { SheetFontsLink } from '@components/sheet/SheetFontsLink'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Dashboard')
  return privateMetadata(t('metaTitle'))
}

export default function DashboardPage() {
  return (
    <>
      <SheetFontsLink />
      <DashboardClient />
    </>
  )
}
