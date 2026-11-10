import { TIME_ZONE } from '@constants/app'

/** Genitive, as a date reads: «31 հոկտեմբերի». */
const MONTHS = [
  'հունվարի',
  'փետրվարի',
  'մարտի',
  'ապրիլի',
  'մայիսի',
  'հունիսի',
  'հուլիսի',
  'օգոստոսի',
  'սեպտեմբերի',
  'հոկտեմբերի',
  'նոյեմբերի',
  'դեկտեմբերի',
] as const

/**
 * Many browsers (Chrome among them) ship no Armenian locale data and silently fall back to
 * English for `hy` («November 30, 2026»), while Node has it — so an Armenian date would also
 * differ between the server and the browser. For Armenian only the numbers come from `Intl`;
 * the words are ours. Russian and English are in every browser's data.
 */
const numericParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export type DateOptions = {
  /** Add the time, on a 24-hour clock in Armenian and Russian, as English writes it in English. */
  time?: boolean
}

const armenian = (value: Date, { time = false }: DateOptions): string => {
  const parts = Object.fromEntries(numericParts.formatToParts(value).map((part) => [part.type, part.value])) as Partial<
    Record<Intl.DateTimeFormatPartTypes, string>
  >
  const date = `${Number(parts.day)} ${MONTHS[Number(parts.month) - 1]} ${parts.year} թ.`
  return time ? `${date}, ${parts.hour}:${parts.minute}` : date
}

/**
 * A date as the reader's interface language writes it, in Yerevan time: «30 նոյեմբերի 2026 թ.»,
 * «30 ноября 2026 г.», «November 30, 2026» — with `time`, followed by the time. Every date the
 * app shows goes through here (components through `useFormatDate`), never through `Intl` or
 * next-intl's `format.dateTime` directly. Pure, so server pages use it too.
 */
export const formatDate = (value: string | number | Date, locale: string, options: DateOptions = {}): string => {
  const date = new Date(value)
  if (locale === 'hy') return armenian(date, options)
  return new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    dateStyle: 'long',
    ...(options.time ? { timeStyle: 'short' } : {}),
  }).format(date)
}
