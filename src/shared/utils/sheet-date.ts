const MONTHS = new Map([
  ['jan', 1],
  ['january', 1],
  ['feb', 2],
  ['february', 2],
  ['mar', 3],
  ['march', 3],
  ['apr', 4],
  ['april', 4],
  ['may', 5],
  ['jun', 6],
  ['june', 6],
  ['jul', 7],
  ['july', 7],
  ['aug', 8],
  ['august', 8],
  ['sep', 9],
  ['september', 9],
  ['oct', 10],
  ['october', 10],
  ['nov', 11],
  ['november', 11],
  ['dec', 12],
  ['december', 12],
])

const BANGKOK_TIME_ZONE = 'Asia/Bangkok'
const BANGKOK_OFFSET = '+07:00'

interface CivilDate {
  kind: 'civil'
  year: number
  month: number
  day: number
}

interface BangkokInstant {
  kind: 'instant'
  value: Date
}

type ParsedSheetDate = CivilDate | BangkokInstant

export interface SheetDateCalendar {
  iso: string
  year: number
  month: number
  day: number
  weekday: number
}

export interface BangkokClock {
  date: string
  weekday: number
  minutes: number
}

/**
 * Normalize the date portion of a sheet/GViz value without letting the host
 * timezone shift civil dates. Timestamp values are instants and are converted
 * to Bangkok before their date is returned.
 */
export function normalizeSheetDate(value: unknown): string | null {
  const parsed = parseSheetDate(value)
  if (!parsed) return null

  if (parsed.kind === 'civil') return toIsoDate(parsed)
  return partsInBangkok(parsed.value).date
}

const DATE_DISPLAY_FALLBACK = '—'

/** Format a sheet date for user-visible date displays in Bangkok. */
export function formatSheetDate(value: unknown): string {
  const normalized = normalizeSheetDate(value)
  if (!normalized) return DATE_DISPLAY_FALLBACK

  const parsed = parseIsoDate(normalized)
  if (!parsed) return DATE_DISPLAY_FALLBACK

  return formatBangkokDateParts(civilDateAsBangkokInstant(parsed))
}

/** Format a timestamp for user-visible date-time displays in Bangkok. */
export function formatSheetDateTime(value: unknown): string {
  const parsed = parseSheetDate(value)
  if (!parsed) return DATE_DISPLAY_FALLBACK

  const instant = parsed.kind === 'civil'
    ? civilDateAsBangkokInstant(parsed)
    : parsed.value

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BANGKOK_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${fields.day} ${fields.month} ${fields.year} ${fields.hour}:${fields.minute}:${fields.second}`
}

/** Return today's Bangkok civil date for date inputs and date-only defaults. */
export function todaySheetDate(now: Date = new Date()): string {
  return partsInBangkok(now).date
}

/** Return Bangkok's civil date, weekday, and minutes since local midnight. */
export function getBangkokClock(now: Date = new Date()): BangkokClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BANGKOK_TIME_ZONE,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    date: `${fields.year}-${fields.month}-${fields.day}`,
    weekday: weekdays.indexOf(fields.weekday),
    minutes: Number(fields.hour) * 60 + Number(fields.minute),
  }
}

/** Add calendar days to an ISO civil date without applying a timezone offset. */
export function addSheetDateDays(value: string, days: number): string {
  const parsed = parseIsoDate(value)
  if (!parsed || !Number.isInteger(days)) return value

  const next = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
}

/** Return calendar fields for a civil date using Sunday=0 weekday numbering. */
export function getSheetDateCalendar(value: unknown): SheetDateCalendar | null {
  const normalized = normalizeSheetDate(value)
  const parsed = normalized ? parseIsoDate(normalized) : null
  if (!normalized || !parsed) return null

  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
  return {
    iso: normalized,
    year: parsed.year,
    month: parsed.month,
    day: parsed.day,
    weekday: date.getUTCDay(),
  }
}

/** Return whole calendar days from the earlier ISO date to the later one. */
export function sheetDateDaysBetween(later: string, earlier: string): number | null {
  const laterDate = parseIsoDate(later)
  const earlierDate = parseIsoDate(earlier)
  if (!laterDate || !earlierDate) return null

  const laterUtc = Date.UTC(laterDate.year, laterDate.month - 1, laterDate.day)
  const earlierUtc = Date.UTC(earlierDate.year, earlierDate.month - 1, earlierDate.day)
  return (laterUtc - earlierUtc) / 86_400_000
}

function parseSheetDate(value: unknown): ParsedSheetDate | null {
  if (typeof value !== 'string') return null

  const input = value.trim()
  if (!input) return null

  const gvizMatch = input.match(/^Date\((\d{1,4}),(\d{1,2}),(\d{1,2})(?:,(\d{1,2}),(\d{1,2}),(\d{1,2}))?\)$/)
  if (gvizMatch) {
    const [, year, month, day, hour, minute, second] = gvizMatch
    const civil = parseCivilDate(Number(year), Number(month) + 1, Number(day))
    if (!civil) return null
    if (hour === undefined) return civil

    const time = parseClock(Number(hour), Number(minute), Number(second))
    if (!time) return null
    return {
      kind: 'instant',
      value: new Date(`${toIsoDate(civil)}T${time}${BANGKOK_OFFSET}`),
    }
  }

  const displayMatch = input.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (displayMatch) {
    const [, day, monthName, year] = displayMatch
    const month = MONTHS.get(monthName.toLowerCase())
    return month === undefined ? null : parseCivilDate(Number(year), month, Number(day))
  }

  const sheetDateTimeMatch = input.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/)
  if (sheetDateTimeMatch) {
    const [, year, month, day, hour, minute, second] = sheetDateTimeMatch
    const civil = parseCivilDate(Number(year), Number(month), Number(day))
    const time = parseClock(Number(hour), Number(minute), Number(second))
    if (!civil || !time) return null
    return {
      kind: 'instant',
      value: new Date(`${toIsoDate(civil)}T${time}${BANGKOK_OFFSET}`),
    }
  }

  const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/)
  if (!isoMatch) return null

  const [, year, month, day, suffix] = isoMatch
  const civil = parseCivilDate(Number(year), Number(month), Number(day))
  if (!civil) return null
  if (!suffix) return civil
  if (!suffix.startsWith('T')) return null

  const timestamp = suffix.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(suffix)
    ? input
    : `${input}${BANGKOK_OFFSET}`
  const instant = new Date(timestamp)
  return Number.isNaN(instant.getTime()) ? null : { kind: 'instant', value: instant }
}

function parseIsoDate(value: string): CivilDate | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return parseCivilDate(Number(match[1]), Number(match[2]), Number(match[3]))
}

function parseCivilDate(year: number, month: number, day: number): CivilDate | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null

  return { kind: 'civil', year, month, day }
}

function parseClock(hour: number, minute: number, second: number): string | null {
  if (
    !Number.isInteger(hour) || !Number.isInteger(minute) || !Number.isInteger(second)
    || hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59
  ) return null

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
}

function toIsoDate(date: CivilDate): string {
  return `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

function civilDateAsBangkokInstant(date: CivilDate): Date {
  return new Date(`${toIsoDate(date)}T00:00:00${BANGKOK_OFFSET}`)
}

function formatBangkokDateParts(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BANGKOK_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).formatToParts(value)
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${fields.day} ${fields.month} ${fields.year}`
}

function partsInBangkok(value: Date): { date: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return { date: `${fields.year}-${fields.month}-${fields.day}` }
}
