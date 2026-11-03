import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PRINT_KINDS, type PrintKind } from '@store/lists/single/types'
import { KIND_QUERY, SAMPLE_QUERY, TEMPLATE_QUERY } from '@constants/routes'
import { DEFAULT_TEMPLATE_ID, isTemplateId } from '@constants/templates'
import { NewListClient } from '@components/editor/NewListClient'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Editor')
  return { title: t('metaTitle'), robots: { index: false, follow: false } }
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const isKind = (value: unknown): value is PrintKind => typeof value === 'string' && (PRINT_KINDS as readonly string[]).includes(value)

export default async function NewListPage({ searchParams }: Props) {
  const query = await searchParams
  const template = query[TEMPLATE_QUERY]
  const kind = query[KIND_QUERY]
  return (
    <NewListClient
      templateId={isTemplateId(template) ? template : DEFAULT_TEMPLATE_ID}
      kind={isKind(kind) ? kind : 'seating'}
      sample={query[SAMPLE_QUERY] === '1'}
    />
  )
}
