'use client'

import type { FC } from 'react'
import { Checkbox, Select } from 'antd'
import { useTranslations } from 'next-intl'
import type { ColumnMapping } from '@helpers/guestImport'

type Props = {
  rows: string[][]
  mapping: ColumnMapping
  onChange: (mapping: ColumnMapping) => void
}

const PREVIEW_ROWS = 4

/** Which column is the name (or the first and last names), the table, the note. */
export const ColumnMapper: FC<Props> = ({ rows, mapping, onChange }) => {
  const t = useTranslations('Editor.import')
  const columns = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const label = (col: number): string => {
    const title = mapping.header ? rows[0]?.[col] : ''
    const sample = rows[mapping.header ? 1 : 0]?.[col] ?? ''
    return `${t('column', { number: col + 1 })}${title ? ` · ${title}` : sample ? ` · ${sample.slice(0, 24)}` : ''}`
  }
  const options = Array.from({ length: columns }, (_, col) => ({ value: col, label: label(col) }))

  return (
    <div className='flex flex-col gap-3'>
      <div className='scrollbar-thin overflow-x-auto rounded-lg border border-line'>
        <table className='w-full border-collapse text-xs'>
          <tbody>
            {rows.slice(0, PREVIEW_ROWS).map((row, index) => (
              <tr key={index} className={index === 0 && mapping.header ? 'bg-canvas font-semibold' : undefined}>
                {Array.from({ length: columns }, (_, col) => (
                  <td
                    key={col}
                    className={
                      mapping.name.includes(col)
                        ? 'border-b border-line bg-accent-soft/60 px-2 py-1 whitespace-nowrap'
                        : 'border-b border-line px-2 py-1 whitespace-nowrap'
                    }
                  >
                    {row[col] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
          <Select<number | null>
            size='small'
            value={mapping.table}
            options={[{ value: null, label: t('none') }, ...options]}
            onChange={(table) => onChange({ ...mapping, table })}
          />
        </label>
        <label className='flex flex-col gap-1 text-xs text-muted'>
          {t('noteColumn')}
          <Select<number | null>
            size='small'
            value={mapping.note}
            options={[{ value: null, label: t('none') }, ...options]}
            onChange={(note) => onChange({ ...mapping, note })}
          />
        </label>
      </div>
    </div>
  )
}
