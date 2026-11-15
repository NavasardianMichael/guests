'use client'

import { type FC, useEffect, useMemo, useRef, useState } from 'react'
import { CameraOutlined, FileExcelOutlined, InboxOutlined, LockOutlined, SnippetsOutlined } from '@ant-design/icons'
import { Alert, App, Button, Input, Modal, Select, Spin, Upload } from 'antd'
import { useTranslations } from 'next-intl'
import { extractGuestsAPI, getPhotoStatusAPI } from '@api/ai/main'
import type { PhotoStatus } from '@api/ai/types'
import { useEditorUiStore } from '@store/editorUi/store'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import type { ImportMode, IncomingGuest } from '@store/lists/single/types'
import { useAccessUntil } from '@hooks/useAccess'
import { useCapabilities } from '@hooks/useCapabilities'
import { useFormatDate } from '@hooks/useFormatDate'
import { ERROR_CODES } from '@constants/errors'
import { PASS_DAYS, PHOTO_READS_PER_PASS } from '@constants/pricing'
import { trackEvent } from '@helpers/analytics'
import { cn } from '@helpers/cn'
import { classifyError, errorCopyKey, processError } from '@helpers/error'
import {
  cellText,
  type ColumnMapping,
  decodeText,
  guessMapping,
  looksTabular,
  parseLines,
  rowsToGuests,
  splitTabular,
} from '@helpers/guestImport'
import { fileToUploadDataUrl } from '@helpers/image'
import { TileButton } from '@components/ui/TileButton'
import { ColumnMapper } from './ColumnMapper'
import { ImportPreview } from './ImportPreview'

/**
 * Named types, not `image/*`: Chrome on Windows resolves the wildcard against every image type
 * in the registry, and the picker takes seconds to open — a click looks like it did nothing.
 * Anything the browser decodes will do; `fileToUploadDataUrl` sends it on as a JPEG.
 */
const PHOTO_ACCEPT = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/gif',
  'image/bmp',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
  '.avif',
  '.gif',
  '.bmp',
].join(',')
const MAX_FILE_BYTES = 10 * 1024 * 1024

/** Photos of one selection read at once: a page of names takes the model several seconds. */
const PHOTO_CONCURRENCY = 3

type Sheet = { rows: string[][]; mapping: ColumnMapping }

/** A spreadsheet or text file as rows. The parsers load only when a file is chosen. */
const readFile = async (file: File): Promise<{ sheets: Record<string, string[][]> } | { lines: string }> => {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx')) {
    const { default: readXlsxFile, readSheetNames } = await import('read-excel-file')
    const names = await readSheetNames(file)
    const sheets: Record<string, string[][]> = {}
    for (const sheet of names) {
      const rows = await readXlsxFile(file, { sheet })
      sheets[sheet] = rows.map((row) => row.map(cellText)).filter((row) => row.some(Boolean))
    }
    return { sheets }
  }
  const text = decodeText(new Uint8Array(await file.arrayBuffer()))
  if (name.endsWith('.txt') && !looksTabular(text)) return { lines: text }
  const { default: Papa } = await import('papaparse')
  const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: 'greedy' })
  return { sheets: { [file.name]: parsed.data.map((row) => row.map(cellText)) } }
}

/**
 * The photo reads left on this pass, made to stand out above the upload: a tinted box with a bar
 * of what is unused (a pass brings 15, stacked passes more). Green while several are left, apricot on the last.
 */
const PhotoReadsLeft: FC<{ remaining: number; allowance: number }> = ({ remaining, allowance }) => {
  const t = useTranslations('Editor.import')
  const last = remaining <= 1
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl px-4 py-3 ring-1 mx-1',
        last ? 'bg-accent-soft text-accent-deep ring-accent/40' : 'bg-success/10 text-success ring-success/30'
      )}
    >
      <CameraOutlined aria-hidden='true' className='text-xl' />
      <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
        <span className='text-sm font-bold'>{t('photoRemaining', { remaining, count: allowance })}</span>
        <span aria-hidden='true' className='relative h-1.5 overflow-hidden rounded-full bg-current/20'>
          <span
            className='absolute inset-y-0 left-0 rounded-full bg-current'
            style={{ width: `${allowance > 0 ? (remaining / allowance) * 100 : 0}%` }}
          />
        </span>
      </div>
    </div>
  )
}

/**
 * Bringing an existing list in, three ways: pasted text (one name per line, "Table 5:" lines
 * seating the names under them — or a block copied from Excel), a file (CSV, TSV, TXT, XLSX,
 * with the columns mapped), or a photo read by the AI (`POST /ai/extract-guests`). Whatever the
 * source, the result is shown, editable; on Import, a list that already has guests asks whether
 * the result replaces them or is added to them.
 *
 * The photo comes with full access: `PHOTO_READS_PER_PASS` reads per pass, one per photo, several chosen at once
 * (`server/src/services/photoQuota.ts`, which the API enforces too). The source is never hidden:
 * its upload is disabled, with the reason and the way on — the checkout, to get full access or
 * to add days (which bring more reads) — and the reads left are shown (`GET /ai/photo`).
 */
export const ImportModal: FC = () => {
  const t = useTranslations('Editor.import')
  const tErrors = useTranslations('Errors')
  const { message, modal } = App.useApp()
  const source = useEditorUiStore.use.importSource()
  const openImport = useEditorUiStore.use.openImport()
  const closeImport = useEditorUiStore.use.closeImport()
  const addGuests = useListEditorStore.use.addGuests()
  const existing = useListEditorStoreBase((state) => state.doc?.content.guests.length ?? 0)
  const capabilities = useCapabilities()
  const formatDate = useFormatDate()
  const setCheckoutOpen = useEditorUiStore.use.setCheckoutOpen()
  // Asked again when the access changes (bought, or found to have run out).
  const until = useAccessUntil()

  const [text, setText] = useState('')
  const [pasteMapping, setPasteMapping] = useState<ColumnMapping | null>(null)
  const [sheets, setSheets] = useState<Record<string, Sheet>>({})
  const [sheetName, setSheetName] = useState<string | null>(null)
  const [fileLines, setFileLines] = useState<string | null>(null)
  const [photoGuests, setPhotoGuests] = useState<IncomingGuest[] | null>(null)
  const [photoReading, setPhotoReading] = useState(false)
  const [photoProgress, setPhotoProgress] = useState<{ done: number; total: number } | null>(null)
  // Undefined while asked; null when it could not be asked (the API still decides).
  const [photoStatus, setPhotoStatus] = useState<PhotoStatus | null | undefined>(undefined)
  const [edited, setEdited] = useState<IncomingGuest[] | null>(null)
  /**
   * Bumped by each photo read and by every reset (closing, another source): a read that comes
   * back after it was left behind is dropped, so it never lands in a dialog opened since. The
   * reads left still update — the API has counted it.
   */
  const photoRun = useRef(0)

  const reset = () => {
    photoRun.current += 1
    setText('')
    setPasteMapping(null)
    setSheets({})
    setSheetName(null)
    setFileLines(null)
    setPhotoGuests(null)
    setPhotoReading(false)
    setPhotoProgress(null)
    setEdited(null)
  }

  const aiOn = capabilities === null || capabilities.ai
  const onPhotoSource = source === 'photo' && aiOn
  useEffect(() => {
    if (!onPhotoSource || until === undefined) return
    let cancelled = false
    getPhotoStatusAPI()
      .then((status) => {
        if (!cancelled) setPhotoStatus(status)
      })
      .catch(() => {
        if (!cancelled) setPhotoStatus(null)
      })
    return () => {
      cancelled = true
    }
  }, [onPhotoSource, until])

  const close = () => {
    closeImport()
    reset()
  }

  // What the current source yields, before the user's own edits in the preview.
  const parsed = useMemo<IncomingGuest[]>(() => {
    if (source === 'paste') {
      if (!text.trim()) return []
      if (looksTabular(text)) {
        const rows = splitTabular(text)
        return rowsToGuests(rows, pasteMapping ?? guessMapping(rows))
      }
      return parseLines(text)
    }
    if (source === 'file') {
      if (fileLines !== null) return parseLines(fileLines)
      const sheet = sheetName ? sheets[sheetName] : undefined
      return sheet ? rowsToGuests(sheet.rows, sheet.mapping) : []
    }
    return photoGuests ?? []
  }, [source, text, pasteMapping, fileLines, sheetName, sheets, photoGuests])

  const guests = edited ?? parsed
  const tabularPaste = source === 'paste' && looksTabular(text)
  const pasteRows = useMemo(() => (tabularPaste ? splitTabular(text) : []), [tabularPaste, text])

  const onFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      void message.error(t('fileTooLarge'))
      return
    }
    try {
      const result = await readFile(file)
      setEdited(null)
      if ('lines' in result) {
        setFileLines(result.lines)
        setSheets({})
        setSheetName(null)
        return
      }
      const next: Record<string, Sheet> = {}
      for (const [name, rows] of Object.entries(result.sheets)) next[name] = { rows, mapping: guessMapping(rows) }
      const first = Object.keys(next).find((name) => next[name].rows.length) ?? null
      setFileLines(null)
      setSheets(next)
      setSheetName(first)
      if (!first) void message.warning(t('fileEmpty'))
    } catch {
      void message.error(t('fileFailed'))
    }
  }

  /**
   * One or several photos, each its own request — each counts once it yields names, one that
   * yields none gives its read back. More are chosen than reads are left: the first ones are
   * read. They go `PHOTO_CONCURRENCY` at a time, and their names join what was read before (the
   * preview's edits included) in the order the photos were chosen, so a list photographed page
   * by page — one shot at a time on a phone — builds up. The batch stops when the API says the
   * reads are spent, access has ended, or the hourly limit is reached.
   */
  const onPhotos = async (picked: File[]) => {
    const left = photoStatus?.state === 'available' ? photoStatus.remaining : PHOTO_READS_PER_PASS
    const files = picked.slice(0, left)
    if (!files.length) return
    if (picked.length > files.length) void message.info(t('photoCapped', { count: files.length }))

    const run = ++photoRun.current
    const current = () => run === photoRun.current
    const before = edited ?? photoGuests ?? []
    const read: IncomingGuest[][] = files.map(() => [])
    let next = 0
    let done = 0
    let nothing = 0
    let failed = 0
    let stopped: unknown = null
    setPhotoReading(true)
    setPhotoProgress({ done: 0, total: files.length })

    const worker = async () => {
      while (next < files.length && !stopped && current()) {
        const index = next++
        try {
          const image = await fileToUploadDataUrl(files[index])
          const result = await extractGuestsAPI({ image })
          setPhotoStatus(result.photo)
          read[index] = result.guests
          if (!result.guests.length) nothing += 1
        } catch (error) {
          const { code } = processError(error)
          // A reason that holds for the rest stops the batch; one photo's failure is counted, and
          // said in full when it was the only one.
          const stopsAll =
            code === ERROR_CODES.photoNeedsAccess || code === ERROR_CODES.photoLimitReached || code === ERROR_CODES.rateLimited
          if (stopsAll || files.length === 1) stopped ??= error
          else failed += 1
        }
        done += 1
        if (current()) setPhotoProgress({ done, total: files.length })
      }
    }
    await Promise.all(Array.from({ length: Math.min(PHOTO_CONCURRENCY, files.length) }, worker))
    if (!current()) return

    setPhotoReading(false)
    setPhotoProgress(null)
    setEdited(null)
    setPhotoGuests([...before, ...read.flat()])
    if (stopped) {
      const { code } = processError(stopped)
      // The API's word wins over what this page last knew: ask again, which shows why.
      if (code === ERROR_CODES.photoNeedsAccess || code === ERROR_CODES.photoLimitReached) {
        getPhotoStatusAPI()
          .then(setPhotoStatus)
          .catch(() => undefined)
      }
      void message.error(tErrors(errorCopyKey(classifyError(stopped))))
    }
    if (failed) void message.error(t('photoFailedSome', { count: failed }))
    if (nothing) void message.warning(files.length === 1 ? t('photoNothing') : t('photoNothingSome', { count: nothing }))
  }

  const getFullAccess = () => {
    close()
    setCheckoutOpen(true)
  }

  const importRows = (rows: IncomingGuest[], mode: ImportMode) => {
    if (!source) return
    addGuests(rows, mode)
    trackEvent('guests_import', { source, count: rows.length, mode })
    void message.success(t('imported', { count: rows.length }))
    close()
  }

  /**
   * Onto an empty list the guests just go in. Onto a list that has guests — often still the
   * sample a new list starts with — it asks whether they replace those or join them.
   */
  const submit = () => {
    const rows = guests.filter((guest) => guest.name.trim())
    if (!rows.length || !source) return
    if (!existing) return importRows(rows, 'append')
    const dialog: { destroy: () => void } = modal.confirm({
      title: t('modeTitle', { count: existing }),
      content: t('modeText'),
      centered: true,
      okText: t('replace'),
      cancelText: t('cancel'),
      onOk: () => importRows(rows, 'replace'),
      footer: (_, { OkBtn, CancelBtn }) => (
        <>
          <CancelBtn />
          <Button
            onClick={() => {
              dialog.destroy()
              importRows(rows, 'append')
            }}
          >
            {t('append')}
          </Button>
          <OkBtn />
        </>
      ),
    })
  }

  const sheet = sheetName ? sheets[sheetName] : undefined
  const busy = photoReading
  // Until the status is known the upload waits; if it cannot be asked, the API decides on upload.
  const photoAllowed =
    aiOn && photoStatus !== undefined && photoStatus?.state !== 'locked' && photoStatus?.state !== 'used'

  return (
    <Modal
      open={source !== null}
      onCancel={close}
      title={t('title')}
      width={880}
      centered
      // Phones: nearly the full width, so the preview has room.
      style={{ maxWidth: 'calc(100vw - 16px)' }}
      // Never taller than the screen: the title and the buttons stay put, the body scrolls.
      styles={{
        container: { display: 'flex', flexDirection: 'column', maxHeight: 'calc(100dvh - 32px)' },
        body: { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' },
      }}
      destroyOnHidden
      okText={t('submit', { count: guests.filter((guest) => guest.name.trim()).length })}
      okButtonProps={{ disabled: !guests.some((guest) => guest.name.trim()) || busy }}
      onOk={submit}
      cancelText={t('cancel')}
    >
      {source && (
        <div className='flex flex-col gap-4'>
          <div className='grid grid-cols-3 gap-2' role='radiogroup' aria-label={t('title')}>
            {(
              [
                ['paste', <SnippetsOutlined key='paste' />],
                ['file', <FileExcelOutlined key='file' />],
                ['photo', <CameraOutlined key='photo' />],
              ] as const
            ).map(([value, icon]) => (
              <TileButton
                key={value}
                role='radio'
                aria-checked={source === value}
                active={source === value}
                icon={icon}
                onClick={() => {
                  if (value === source) return
                  reset()
                  openImport(value)
                }}
              >
                {t(`sources.${value}`)}
              </TileButton>
            ))}
          </div>

          {source === 'paste' && (
            <>
              <Input.TextArea
                value={text}
                onChange={(event) => {
                  setText(event.target.value)
                  setEdited(null)
                }}
                autoSize={{ minRows: 6, maxRows: 12 }}
                placeholder={t('pastePlaceholder')}
                aria-label={t('sources.paste')}
              />
              <p className='m-0 text-xs leading-relaxed text-muted'>{t('pasteHint')}</p>
              {tabularPaste && (
                <ColumnMapper
                  rows={pasteRows}
                  mapping={pasteMapping ?? guessMapping(pasteRows)}
                  onChange={(next) => {
                    setPasteMapping(next)
                    setEdited(null)
                  }}
                />
              )}
            </>
          )}

          {source === 'file' && (
            <>
              <Upload.Dragger
                accept='.csv,.tsv,.txt,.xlsx'
                multiple={false}
                showUploadList={false}
                beforeUpload={(file) => {
                  void onFile(file)
                  return false
                }}
              >
                <p className='ant-upload-drag-icon'>
                  <InboxOutlined />
                </p>
                <p className='ant-upload-text'>{t('fileDrop')}</p>
                <p className='ant-upload-hint'>{t('fileHint')}</p>
              </Upload.Dragger>
              {Object.keys(sheets).length > 1 && (
                <Select
                  value={sheetName}
                  onChange={(name) => {
                    setSheetName(name)
                    setEdited(null)
                  }}
                  options={Object.keys(sheets).map((name) => ({ value: name, label: name }))}
                  aria-label={t('sheet')}
                />
              )}
              {sheet && sheetName && (
                <ColumnMapper
                  rows={sheet.rows}
                  mapping={sheet.mapping}
                  onChange={(mapping) => {
                    setSheets({ ...sheets, [sheetName]: { ...sheet, mapping } })
                    setEdited(null)
                  }}
                />
              )}
            </>
          )}

          {source === 'photo' && (
            <>
              {!aiOn && <Alert type='warning' showIcon title={t('photoUnavailable')} />}
              {aiOn && photoStatus?.state === 'locked' && (
                <Alert
                  type='warning'
                  showIcon
                  icon={<LockOutlined />}
                  title={t('photoLockedTitle')}
                  description={t('photoLockedText', { count: PHOTO_READS_PER_PASS, days: PASS_DAYS })}
                  action={
                    <Button type='primary' size='small' onClick={getFullAccess}>
                      {t('photoGetAccess')}
                    </Button>
                  }
                />
              )}
              {aiOn && photoStatus?.state === 'used' && (
                <Alert
                  type='info'
                  showIcon
                  title={t('photoUsedTitle', { count: photoStatus.allowance })}
                  description={t('photoUsedText', {
                    date: photoStatus.until ? formatDate(photoStatus.until) : '',
                    count: PHOTO_READS_PER_PASS,
                    days: PASS_DAYS,
                  })}
                  action={
                    <Button size='small' onClick={getFullAccess}>
                      {t('photoAddDays')}
                    </Button>
                  }
                />
              )}
              {aiOn && photoStatus?.state === 'available' && (
                <PhotoReadsLeft remaining={photoStatus.remaining} allowance={photoStatus.allowance} />
              )}
              <Upload.Dragger
                accept={PHOTO_ACCEPT}
                multiple
                showUploadList={false}
                disabled={busy || !photoAllowed}
                beforeUpload={(file, list) => {
                  // Called once per file of the selection: the first call takes the whole of it.
                  if (file === list[0]) void onPhotos(list)
                  return false
                }}
              >
                <p className='ant-upload-drag-icon'>
                  <CameraOutlined />
                </p>
                <p className='ant-upload-text'>{t('photoDrop')}</p>
                <p className='ant-upload-hint'>{t('photoHint')}</p>
              </Upload.Dragger>
              {photoReading && (
                <div className='flex items-center gap-2 text-sm'>
                  <Spin size='small' />
                  {photoProgress && photoProgress.total > 1
                    ? t('photoReadingOf', { done: photoProgress.done, total: photoProgress.total })
                    : t('photoReading')}
                </div>
              )}
              <p className='m-0 text-xs leading-relaxed text-muted'>
                {t('photoRules', { count: PHOTO_READS_PER_PASS, days: PASS_DAYS })}
              </p>
              <p className='m-0 text-xs leading-relaxed text-muted'>{t('photoPrivacy')}</p>
            </>
          )}

          {!busy && <ImportPreview guests={guests} onChange={setEdited} />}
        </div>
      )}
    </Modal>
  )
}
