'use client'

import type { FC } from 'react'
import { CloseOutlined } from '@ant-design/icons'
import { useTranslations } from 'next-intl'
import type { IncomingGuest } from '@store/lists/single/types'

type Props = {
  guests: IncomingGuest[]
  onChange: (guests: IncomingGuest[]) => void
}

/** What will come in, editable: a misread name is fixed here, a stray line removed. */
export const ImportPreview: FC<Props> = ({ guests, onChange }) => {
  const t = useTranslations('Editor.import')
  const tables = new Set(guests.map((guest) => guest.table).filter(Boolean)).size
  const update = (index: number, patch: Partial<IncomingGuest>) =>
    onChange(guests.map((guest, at) => (at === index ? { ...guest, ...patch } : guest)))

  if (!guests.length) return <p className='m-0 rounded-lg bg-canvas p-4 text-center text-sm text-muted'>{t('nothingYet')}</p>

  return (
    <div className='flex flex-col gap-2'>
      <p className='m-0 text-sm font-medium'>{t('found', { guests: guests.length, tables })}</p>
      <ul className='m-0 max-h-72 list-none overflow-y-auto rounded-lg border border-line p-1'>
        {guests.map((guest, index) => (
          <li key={index} className='group flex items-center gap-1'>
            <span className='w-7 shrink-0 text-right text-[11px] text-muted tabular-nums'>{index + 1}</span>
            <input
              className='min-w-0 flex-1 rounded-md border-0 bg-transparent px-1.5 py-1 text-sm outline-none focus:bg-canvas'
              value={guest.name}
              aria-label={t('name')}
              onChange={(event) => update(index, { name: event.target.value })}
            />
            <input
              className='w-24 min-w-0 rounded-md border-0 bg-transparent px-1.5 py-1 text-xs text-muted outline-none focus:bg-canvas'
              value={guest.table ?? ''}
              placeholder={t('tablePlaceholder')}
              aria-label={t('table')}
              onChange={(event) => update(index, { table: event.target.value })}
            />
            <button
              type='button'
              className='cursor-pointer rounded border-0 bg-transparent p-1 text-muted opacity-0 group-hover:opacity-100 hover:text-danger focus:opacity-100'
              aria-label={t('removeRow')}
              onClick={() => onChange(guests.filter((_, at) => at !== index))}
            >
              <CloseOutlined />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
