'use client'

import type { FC } from 'react'
import { CopyOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, MoreOutlined } from '@ant-design/icons'
import { Button, Dropdown } from 'antd'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { GuestList } from '@store/lists/single/types'
import { useFormatDate } from '@hooks/useFormatDate'
import { editorPath } from '@constants/routes'
import { SheetPreview } from '@components/sheet/SheetPreview'

type Props = {
  list: GuestList
  onDuplicate: (list: GuestList) => void
  onDelete: (list: GuestList) => void
  onDownload: (list: GuestList) => void
}

/** One list on the dashboard: its first page, its name, how many guests, when it last changed. */
export const ListCard: FC<Props> = ({ list, onDuplicate, onDelete, onDownload }) => {
  const t = useTranslations('Dashboard')
  const tKinds = useTranslations('Editor.layout.kinds')
  const tCommon = useTranslations('Common')
  const formatDate = useFormatDate()
  const href = editorPath(list.id)

  return (
    <article className='group'>
      <Link
        href={href}
        className='relative block overflow-hidden rounded-2xl bg-surface shadow-[0_10px_30px_-12px_rgba(20,24,45,0.25)] ring-1 ring-black/5 transition duration-300 group-hover:-translate-y-1'
        aria-label={`${tCommon('edit')}: ${list.title}`}
      >
        <SheetPreview doc={list} />
      </Link>
      <div className='mt-3 flex items-start gap-2 px-1'>
        <div className='min-w-0 flex-1'>
          <h2 className='m-0 truncate text-base font-bold text-ink'>
            <Link href={href} className='text-inherit no-underline hover:text-accent-strong'>
              {list.title}
            </Link>
          </h2>
          <p className='m-0 mt-0.5 text-xs text-muted'>
            {tKinds(list.design.kind)} · {t('guests', { count: list.content.guests.length })}
          </p>
          <p className='m-0 mt-0.5 text-xs text-muted'>
            {t('updated', { date: formatDate(list.updatedAt, { time: true }) })}
          </p>
        </div>
        <Dropdown
          trigger={['click']}
          placement='bottomRight'
          menu={{
            items: [
              { key: 'edit', icon: <EditOutlined />, label: <Link href={href}>{tCommon('edit')}</Link> },
              { key: 'download', icon: <DownloadOutlined />, label: tCommon('download'), onClick: () => onDownload(list) },
              { key: 'duplicate', icon: <CopyOutlined />, label: tCommon('duplicate'), onClick: () => onDuplicate(list) },
              { type: 'divider' },
              { key: 'delete', icon: <DeleteOutlined />, label: tCommon('delete'), danger: true, onClick: () => onDelete(list) },
            ],
          }}
        >
          <Button type='text' size='small' icon={<MoreOutlined />} aria-label={t('actions')} />
        </Dropdown>
      </div>
    </article>
  )
}
