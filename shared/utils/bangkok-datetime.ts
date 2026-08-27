const GVIZ_DATE_PATTERN = /^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,(\d{1,2}),(\d{1,2}),(\d{1,2}))?\)$/

function pad2(value: string | number): string {
  return String(value).padStart(2, '0')
}

export function bangkokToday(now?: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now ?? new Date())
}

export function normalizeSheetDate(value: unknown): string | null {
  if (value == null) return null
  const text = String(value).trim()
  if (text === '') return null
  const match = GVIZ_DATE_PATTERN.exec(text)
  if (match !== null) {
    const month = Number(match[2])
    if (month < 0 || month > 11) return text
    return `${match[1]}-${pad2(month + 1)}-${pad2(match[3])}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  return text
}

export function normalizeSheetTimestamp(value: unknown): string {
  if (value == null) return ''
  const text = String(value).trim()
  if (text === '') return ''
  const match = GVIZ_DATE_PATTERN.exec(text)
  if (match !== null) {
    const month = Number(match[2])
    if (month < 0 || month > 11) return text
    const datePart = `${match[1]}-${pad2(month + 1)}-${pad2(match[3])}`
    if (match[4] === undefined) return `${datePart} 00:00:00`
    return `${datePart} ${pad2(match[4])}:${pad2(match[5])}:${pad2(match[6])}`
  }
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(text)) {
    const date = new Date(text)
    if (!Number.isNaN(date.getTime())) {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(date)
      const formatted = Object.fromEntries(
        parts
          .filter((part) => part.type !== 'literal')
          .map((part) => [part.type, part.value]),
      )
      return `${formatted.year}-${formatted.month}-${formatted.day} ${formatted.hour}:${formatted.minute}:${formatted.second}`
    }
  }
  const iso = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/.exec(text)
  if (iso !== null) return `${iso[1]} ${iso[2]}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text} 00:00:00`
  return text
}

export function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value == null) return 0
  const text = String(value).trim().replace(/,/g, '')
  if (text === '') return 0
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : 0
}

export function toRequiredString(value: unknown): string {
  if (value == null) return ''
  return String(value)
}

export function toNullableString(value: unknown): string | null {
  const text = toRequiredString(value)
  return text === '' ? null : text
}
