'use client'

import type { FC } from 'react'
import { Checkbox, Select } from 'antd'
import { useTranslations } from 'next-intl'
import type { ColumnMapping } from '@helpers/guestImport'

const NONE = -1

type Props = {
  rows: string[][]
  mapping: ColumnMapping
  onChange: (mapping: ColumnMapping) => void
}

/**
 * Which column is the name (or the first and last names), the table, the note. Each option is
 * labelled with the column's title or first value; the guests it yields show in the preview below.
 */
export const ColumnMapper: FC<Props> = ({ rows, mapping, onChange }) => {
  const t = useTranslations('Editor.import')
  const columns = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const label = (col: number): string => {
    const title = mapping.header ? rows[0]?.[col] : ''
    const sample = rows[mapping.header ? 1 : 0]?.[col] ?? ''
    return `${t('column', { number: col + 1 })}${title ? ` · ${title}` : sample ? ` · ${sample.slice(0, 24)}` : ''}`
  }
  const options = Array.from({ length: columns }, (_, col) => ({ value: col, label: label(col) }))
  // antd warns on a `null` option value, so "none" is NONE inside the Select and null outside it.
  const optional = [{ value: NONE, label: t('none') }, ...options]
  const fromSelect = (col: number): number | null => (col === NONE ? null : col)

  return (
    <div className='flex flex-col gap-3'>
      <Checkbox checked={mapping.header} onChange={(event) => onChange({ ...mapping, header: event.target.checked })}>
        {t('headerRow')}
      </Checkbox>
      <div className='grid gap-2 sm:grid-cols-3'>
        <label className='flex flex-col gap-1 text-xs text-muted'>
          {t('nameColumn')}
          <Select<number[]>
            mode='multiple'
            size='small'
            value={mapping.name}
            options={options}
            onChange={(name) => onChange({ ...mapping, name: name.length ? name : mapping.name })}
          />
        </label>
        <label className='flex flex-col gap-1 text-xs text-muted'>
          {t('tableColumn')}
          <Select<number>
            size='small'
            value={mapping.table ?? NONE}
            options={optional}
            onChange={(col) => onChange({ ...mapping, table: fromSelect(col) })}
          />
        </label>
        <label className='flex flex-col gap-1 text-xs text-muted'>
          {t('noteColumn')}
          <Select<number>
            size='small'
            value={mapping.note ?? NONE}
            options={optional}
            onChange={(col) => onChange({ ...mapping, note: fromSelect(col) })}
          />
        </label>
      </div>
    </div>
  )
}
