'use client'

import { type FC, useMemo, useState } from 'react'
import { CameraOutlined, FileExcelOutlined, InboxOutlined, SnippetsOutlined } from '@ant-design/icons'
import { Alert, App, Input, Modal, Progress, Radio, Select, Upload } from 'antd'
import { useTranslations } from 'next-intl'
import { extractGuestsAPI } from '@api/ai/main'
import { useEditorUiStore } from '@store/editorUi/store'
import { useListEditorStore, useListEditorStoreBase } from '@store/lists/single/store'
import type { ImportMode, IncomingGuest } from '@store/lists/single/types'
import { useCapabilities } from '@hooks/useCapabilities'
import { trackEvent } from '@helpers/analytics'
import { classifyError, errorCopyKey } from '@helpers/error'
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

const MAX_PHOTOS = 5
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
 * with the columns mapped), or photos read by the AI (`POST /ai/extract-guests`). Whatever the
 * source, the result is shown, editable, before it is added to the list or replaces it.
 */
export const ImportModal: FC = () => {
  const t = useTranslations('Editor.import')
  const tErrors = useTranslations('Errors')
  const { message } = App.useApp()
  const source = useEditorUiStore.use.importSource()
  const openImport = useEditorUiStore.use.openImport()
  const closeImport = useEditorUiStore.use.closeImport()
  const addGuests = useListEditorStore.use.addGuests()
  const existing = useListEditorStoreBase((state) => state.doc?.content.guests.length ?? 0)
  const capabilities = useCapabilities()

  const [text, setText] = useState('')
  const [pasteMapping, setPasteMapping] = useState<ColumnMapping | null>(null)
  const [sheets, setSheets] = useState<Record<string, Sheet>>({})
  const [sheetName, setSheetName] = useState<string | null>(null)
  const [fileLines, setFileLines] = useState<string | null>(null)
  const [photoGuests, setPhotoGuests] = useState<IncomingGuest[] | null>(null)
  const [photoProgress, setPhotoProgress] = useState<{ done: number; total: number } | null>(null)
  const [edited, setEdited] = useState<IncomingGuest[] | null>(null)
  const [mode, setMode] = useState<ImportMode>('append')

  const reset = () => {
    setText('')
    setPasteMapping(null)
    setSheets({})
    setSheetName(null)
    setFileLines(null)
    setPhotoGuests(null)
    setPhotoProgress(null)
    setEdited(null)
    setMode('append')
  }

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

  const onPhotos = async (files: File[]) => {
    const batch = files.slice(0, MAX_PHOTOS)
    setEdited(null)
    setPhotoGuests(null)
    setPhotoProgress({ done: 0, total: batch.length })
    const found: IncomingGuest[] = []
    let failures = 0
    for (const [index, file] of batch.entries()) {
      try {
        const image = await fileToUploadDataUrl(file)
        found.push(...(await extractGuestsAPI({ image })))
      } catch (error) {
        failures += 1
        void message.error(tErrors(errorCopyKey(classifyError(error))))
      }
      setPhotoProgress({ done: index + 1, total: batch.length })
    }
    setPhotoProgress(null)
    setPhotoGuests(found)
    if (!found.length && failures < batch.length) void message.warning(t('photoNothing'))
  }

  const submit = () => {
    const rows = guests.filter((guest) => guest.name.trim())
    if (!rows.length || !source) return
    addGuests(rows, mode)
    trackEvent('guests_import', { source, count: rows.length })
    void message.success(t('imported', { count: rows.length }))
    close()
  }

  const sheet = sheetName ? sheets[sheetName] : undefined
  const busy = photoProgress !== null

  return (
    <Modal
      open={source !== null}
      onCancel={close}
      title={t('title')}
      width={720}
      // Phones: nearly the full screen, close to the top, so the preview has room.
      style={{ maxWidth: 'calc(100vw - 16px)', top: 16 }}
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
              {capabilities && !capabilities.ai && <Alert type='warning' showIcon title={t('photoUnavailable')} />}
              <Upload.Dragger
                accept='image/*'
                multiple
                showUploadList={false}
                disabled={busy || (capabilities !== null && !capabilities.ai)}
                beforeUpload={(file, list) => {
                  // Called once per file; start once, with the whole selection.
                  if (file === list[0]) void onPhotos(list)
                  return false
                }}
              >
                <p className='ant-upload-drag-icon'>
                  <CameraOutlined />
                </p>
                <p className='ant-upload-text'>{t('photoDrop')}</p>
                <p className='ant-upload-hint'>{t('photoHint', { max: MAX_PHOTOS })}</p>
              </Upload.Dragger>
              {photoProgress && (
                <div>
                  <p className='m-0 mb-1 text-sm'>{t('photoReading', photoProgress)}</p>
                  <Progress percent={Math.round(((photoProgress.done + 0.5) / photoProgress.total) * 100)} status='active' showInfo={false} />
                </div>
              )}
              <p className='m-0 text-xs leading-relaxed text-muted'>{t('photoPrivacy')}</p>
            </>
          )}

          {!busy && <ImportPreview guests={guests} onChange={setEdited} />}

          {existing > 0 && guests.length > 0 && (
            <Radio.Group value={mode} onChange={(event) => setMode(event.target.value as ImportMode)}>
              <Radio value='append'>{t('append', { count: existing })}</Radio>
              <Radio value='replace'>{t('replace')}</Radio>
            </Radio.Group>
          )}
        </div>
      )}
    </Modal>
  )
}
