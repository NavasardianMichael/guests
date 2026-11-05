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
 * Many browsers ship no Armenian locale data and silently fall back to English for `hy`
 * («Oct 31, 2026, 7:42 PM»), so only the numbers come from `Intl`; the words are ours.
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

/** «31 հոկտեմբերի 2026 թ., 19:42», in Yerevan time. */
export const formatDateTime = (value: string | number | Date): string => {
  const parts = Object.fromEntries(
    numericParts.formatToParts(new Date(value)).map((part) => [part.type, part.value])
  ) as Partial<Record<Intl.DateTimeFormatPartTypes, string>>
  const month = MONTHS[Number(parts.month) - 1]
  return `${Number(parts.day)} ${month} ${parts.year} թ., ${parts.hour}:${parts.minute}`
}
