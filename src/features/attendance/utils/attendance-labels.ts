import type { CalendarWeek } from './attendance-calendar'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEK_NAMES = ['This week', 'Next week', 'In 2 weeks']

function parts(date: string): { weekday: number; day: number; month: number; year: number } {
  const parsed = new Date(`${date}T00:00:00Z`)
  return { weekday: parsed.getUTCDay(), day: parsed.getUTCDate(), month: parsed.getUTCMonth(), year: parsed.getUTCFullYear() }
}

export function weekdayName(date: string): string {
  return WEEKDAYS[parts(date).weekday]!
}

export function dayOfMonth(date: string): number {
  return parts(date).day
}

export function monthShort(date: string): string {
  return MONTHS[parts(date).month]!.slice(0, 3)
}

export function fullLabel(date: string): string {
  return `${weekdayName(date)} ${dayOfMonth(date)} ${monthShort(date)}`
}

export function shortLabel(date: string): string {
  return `${weekdayName(date).slice(0, 3)} ${dayOfMonth(date)} ${monthShort(date)}`
}

export function weekRange(week: CalendarWeek): string {
  const first = week.days[0]!.date
  const last = week.days[6]!.date
  return monthShort(first) === monthShort(last)
    ? `${dayOfMonth(first)} – ${dayOfMonth(last)} ${monthShort(last)}`
    : `${dayOfMonth(first)} ${monthShort(first)} – ${dayOfMonth(last)} ${monthShort(last)}`
}

export function weekName(index: number): string {
  return WEEK_NAMES[index] ?? `In ${index} weeks`
}

export function calendarTitle(weeks: readonly CalendarWeek[]): string {
  const first = parts(weeks[0]!.days[0]!.date)
  const last = parts(weeks[weeks.length - 1]!.days[6]!.date)
  if (first.year !== last.year) return `${MONTHS[first.month]} ${first.year} – ${MONTHS[last.month]} ${last.year}`
  if (first.month !== last.month) return `${MONTHS[first.month]} – ${MONTHS[last.month]} ${last.year}`
  return `${MONTHS[first.month]} ${last.year}`
}
