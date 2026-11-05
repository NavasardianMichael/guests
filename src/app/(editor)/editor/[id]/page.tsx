import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { EditorShell } from '@components/editor/EditorShell'
import { SheetFontsLink } from '@components/sheet/SheetFontsLink'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Editor')
  return { title: t('metaTitle'), robots: { index: false, follow: false } }
}

type Props = { params: Promise<{ id: string }> }

export default async function EditorPage({ params }: Props) {
  const { id } = await params
  return (
    <>
      <SheetFontsLink />
      <EditorShell listId={id} />
    </>
  )
}
