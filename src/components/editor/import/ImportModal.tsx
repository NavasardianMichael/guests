'use client'

import { type FC, useEffect, useMemo, useState } from 'react'
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
 * Bringing an existing list in, three ways: pasted text (one name per line, "Table 5:" lines
 * seating the names under them — or a block copied from Excel), a file (CSV, TSV, TXT, XLSX,
 * with the columns mapped), or a photo read by the AI (`POST /ai/extract-guests`). Whatever the
 * source, the result is shown, editable; on Import, a list that already has guests asks whether
 * the result replaces them or is added to them.
 *
 * The photo comes with full access: `PHOTO_READS_PER_PASS` reads per pass, one photo at a time
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
  // Undefined while asked; null when it could not be asked (the API still decides).
  const [photoStatus, setPhotoStatus] = useState<PhotoStatus | null | undefined>(undefined)
  const [edited, setEdited] = useState<IncomingGuest[] | null>(null)

  const reset = () => {
    setText('')
    setPasteMapping(null)
    setSheets({})
    setSheetName(null)
    setFileLines(null)
    setPhotoGuests(null)
    setPhotoReading(false)
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

  /** One photo. It counts once it yields names; one that yields none gives its read back. */
  const onPhoto = async (file: File) => {
    setEdited(null)
    setPhotoGuests(null)
    setPhotoReading(true)
    try {
      const image = await fileToUploadDataUrl(file)
      const result = await extractGuestsAPI({ image })
      setPhotoGuests(result.guests)
      setPhotoStatus(result.photo)
      if (!result.guests.length) void message.warning(t('photoNothing'))
    } catch (error) {
      const { code } = processError(error)
      // The API's word wins over what this page last knew: ask again, which shows why.
      if (code === ERROR_CODES.photoNeedsAccess || code === ERROR_CODES.photoLimitReached) {
        getPhotoStatusAPI()
          .then(setPhotoStatus)
          .catch(() => undefined)
      }
      void message.error(tErrors(errorCopyKey(classifyError(error))))
    } finally {
      setPhotoReading(false)
    }
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
  const photoAllowed = aiOn && photoStatus !== undefined && photoStatus?.state !== 'locked' && photoStatus?.state !== 'used'

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
                <p className='m-0 text-sm font-medium text-ink'>
                  {t('photoRemaining', { remaining: photoStatus.remaining, count: photoStatus.allowance })}
                </p>
              )}
              <Upload.Dragger
                accept={PHOTO_ACCEPT}
                multiple={false}
                maxCount={1}
                showUploadList={false}
                disabled={busy || !photoAllowed}
                beforeUpload={(file, list) => {
                  // One photo at a time: of several dropped at once, only the first is read.
                  if (file !== list[0]) return false
                  if (list.length > 1) void message.info(t('photoOneAtATime'))
                  void onPhoto(file)
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
                  {t('photoReading')}
                </div>
              )}
              <p className='m-0 text-xs leading-relaxed text-muted'>{t('photoRules', { count: PHOTO_READS_PER_PASS, days: PASS_DAYS })}</p>
              <p className='m-0 text-xs leading-relaxed text-muted'>{t('photoPrivacy')}</p>
            </>
          )}

          {!busy && <ImportPreview guests={guests} onChange={setEdited} />}
        </div>
      )}
    </Modal>
  )
}
