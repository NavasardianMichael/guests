import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PRINT_KINDS, type PrintKind, SHEET_SHAPES, type SheetShape } from '@store/lists/single/types'
import { EXAMPLE_QUERY, KIND_QUERY, SHAPE_QUERY, TEMPLATE_QUERY } from '@constants/routes'
import { DEFAULT_TEMPLATE_ID, isTemplateId } from '@constants/templates'
import { exampleDocument } from '@content/exampleDocument'
import { findExample } from '@content/index'
import { NewListClient } from '@components/editor/NewListClient'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Editor')
  return { title: t('metaTitle'), robots: { index: false, follow: false } }
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const isKind = (value: unknown): value is PrintKind => typeof value === 'string' && (PRINT_KINDS as readonly string[]).includes(value)
const isShape = (value: unknown): value is SheetShape => typeof value === 'string' && (SHEET_SHAPES as readonly string[]).includes(value)

export default async function NewListPage({ searchParams }: Props) {
  const query = await searchParams
  const template = query[TEMPLATE_QUERY]
  const kind = query[KIND_QUERY]
  const shape = query[SHAPE_QUERY]
  // An event example page's "use this example": its whole list, in its own template and kind.
  const example = findExample(query[EXAMPLE_QUERY])
  return (
    <NewListClient
      example={example ? { slug: example.slug, doc: exampleDocument(example) } : null}
      templateId={isTemplateId(template) ? template : DEFAULT_TEMPLATE_ID}
      kind={isKind(kind) ? kind : 'seating'}
      shape={isShape(shape) ? shape : 'rectangle'}
    />
  )
}
