'use client'

import { type FC, useEffect } from 'react'
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  CloudSyncOutlined,
  ExclamationCircleFilled,
  EyeOutlined,
  LaptopOutlined,
  RedoOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons'
import { App, Button } from 'antd'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuthStore } from '@store/auth/store'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import { DRAFT_ID } from '@store/lists/single/types'
import { ROUTES } from '@constants/routes'
import { stepZoom } from '@helpers/canvasZoom'
import { BrandMark } from '@components/layout/BrandMark'
import { HintTooltip } from '@components/ui/HintTooltip'
import { LiveInput } from './controls/LiveFields'
import { ResetButton } from './controls/ResetButton'
import { AccessChip } from './download/AccessChip'
import { PdfActions } from './PdfActions'

type Props = {
  zoom: number | null
  fitZoom: number
  pages: number
  onZoomChange: (zoom: number | null) => void
  /** Opens the print preview, over the whole screen. */
  onPreview: () => void
}

/**
 * The save state; under `md` the icon alone, its words left to screen readers. A save that
 * cannot go through — the list was saved elsewhere since (`conflict`), or a refusal retrying
 * cannot fix (`stopped`) — also says so once in a message, since the icon alone is easy to miss.
 */
const SaveIndicator: FC = () => {
  const t = useTranslations('Editor.status')
  const { message } = App.useApp()
  const status = useListEditorStore.use.saveStatus()
  const isDraft = useListEditorStore.use.listId() === DRAFT_ID

  useEffect(() => {
    if (status === 'conflict') void message.warning({ content: t('conflictHint'), duration: 8 })
    if (status === 'stopped') void message.error({ content: t('stoppedHint'), duration: 8 })
  }, [message, status, t])

  if (status === 'conflict') {
    return (
      <HintTooltip title={t('conflictHint')}>
        <Button
          size='small'
          danger
          icon={<ExclamationCircleFilled />}
          aria-label={`${t('conflict')}. ${t('reload')}`}
          onClick={() => window.location.reload()}
          className='shrink-0'
        >
          <span className='hidden md:inline'>{t('reload')}</span>
        </Button>
      </HintTooltip>
    )
  }
  if (status === 'stopped') {
    return (
      <span className='flex shrink-0 items-center gap-1.5 text-xs text-danger' title={t('stoppedHint')}>
        <ExclamationCircleFilled /> <span className='sr-only md:not-sr-only'>{t('error')}</span>
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className='flex shrink-0 items-center gap-1.5 text-xs text-danger' title={t('error')}>
        <ExclamationCircleFilled /> <span className='sr-only md:not-sr-only'>{t('error')}</span>
      </span>
    )
  }
  if (status === 'saved') {
    return (
      <span className='flex shrink-0 items-center gap-1.5 text-xs text-muted' title={isDraft ? t('local') : t('saved')}>
        {isDraft ? <LaptopOutlined /> : <CheckCircleFilled className='text-success' />}
        <span className='sr-only md:not-sr-only'>{isDraft ? t('local') : t('saved')}</span>
      </span>
    )
  }
  return (
    <span className='flex shrink-0 items-center gap-1.5 text-xs text-muted' title={t(status)}>
      <CloudSyncOutlined spin={status === 'saving'} /> <span className='sr-only md:not-sr-only'>{t(status)}</span>
    </span>
  )
}

export const EditorTopBar: FC<Props> = ({ zoom, fitZoom, pages, onZoomChange, onPreview }) => {
  const t = useTranslations('Editor')
  const tCommon = useTranslations('Common')
  // Narrow selectors: this bar must not re-render on every keystroke in the list.
  const title = useListEditorStoreBase((state) => state.doc?.title)
  const canUndo = useListEditorStoreBase((state) => state.past.length > 0)
  const canRedo = useListEditorStoreBase((state) => state.future.length > 0)
  const undo = useListEditorStore.use.undo()
  const redo = useListEditorStore.use.redo()
  const setTitle = useListEditorStore.use.setTitle()
  const user = useAuthStore.use.user()

  const current = zoom ?? fitZoom
  const step = (direction: 1 | -1) => onZoomChange(stepZoom(current, direction))

  return (
    <header className='flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-2 sm:px-3'>
      <Link
        href={user ? ROUTES.dashboard : ROUTES.home}
        aria-label={tCommon('back')}
        className='flex h-10 min-w-10 shrink-0 items-center justify-center gap-1 text-muted'
      >
        <ArrowLeftOutlined />
        <BrandMark className='hidden size-7 sm:block' />
      </Link>
      <LiveInput
        variant='borderless'
        className='max-w-56 min-w-20 flex-1 px-1 font-semibold sm:px-2.5'
        value={title ?? ''}
        placeholder={t('untitled')}
        aria-label={t('titleLabel')}
        maxLength={120}
        onChange={setTitle}
      />
      <SaveIndicator />

      <div className='ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1'>
        <ResetButton scope='all' variant='icon' />
        <HintTooltip title={t('undo')}>
          <Button type='text' icon={<UndoOutlined />} disabled={!canUndo} onClick={undo} aria-label={t('undo')} />
        </HintTooltip>
        <HintTooltip title={t('redo')}>
          <Button type='text' icon={<RedoOutlined />} disabled={!canRedo} onClick={redo} aria-label={t('redo')} />
        </HintTooltip>
        <div className='mx-1 hidden items-center gap-0.5 rounded-lg bg-canvas px-1 lg:flex'>
          <Button type='text' size='small' icon={<ZoomOutOutlined />} onClick={() => step(-1)} aria-label={t('zoomOut')} />
          <button
            type='button'
            className='w-12 cursor-pointer border-0 bg-transparent text-xs font-medium tabular-nums'
            title={t('fit')}
            aria-label={t('zoomLevel', { percent: Math.round(current * 100) })}
            onClick={() => onZoomChange(null)}
          >
            {Math.round(current * 100)}%
          </button>
          <Button type='text' size='small' icon={<ZoomInOutlined />} onClick={() => step(1)} aria-label={t('zoomIn')} />
        </div>
        <span className='mr-1 hidden text-xs text-muted xl:inline'>{t('pages', { count: pages })}</span>
        {/* Phones and tablets open the preview from the bottom bar. */}
        <span className='hidden lg:flex'>
          <HintTooltip title={t('previewHint')}>
            <Button icon={<EyeOutlined />} aria-label={t('preview')} onClick={onPreview} />
          </HintTooltip>
        </span>
        <AccessChip />
        <PdfActions />
      </div>
    </header>
  )
}
