import type { AttendanceRow } from '../attendance.types'

export const BOOKING_WINDOW_DAYS = 14
export const WEEKS_SHOWN = 3

export type DayState = 'past' | 'today' | 'taken' | 'mine' | 'free' | 'locked' | 'outside'

export interface CalendarDay {
  date: string
  state: DayState
  holderStaffId: string | null
}

export interface CalendarWeek {
  index: number
  monday: string
  days: CalendarDay[]
  mineDate: string | null
}

export interface BookableRange {
  first: string
  last: string
}

export function addDays(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().slice(0, 10)
}

export function mondayOf(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  return addDays(date, -((weekday + 6) % 7))
}

export function bookableRange(today: string): BookableRange {
  return { first: addDays(today, 1), last: addDays(today, BOOKING_WINDOW_DAYS) }
}

export function weekIndexOf(today: string, date: string): number {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${mondayOf(today)}T00:00:00Z`)) / 86_400_000)
  return Math.floor(days / 7)
}

export function buildCalendar(input: { today: string; rows: readonly AttendanceRow[]; meStaffId: string | null }): CalendarWeek[] {
  const { today, rows, meStaffId } = input
  const range = bookableRange(today)
  const holderByDate = new Map<string, string>()
  const mineDates = new Set<string>()
  for (const row of rows) {
    if (row.status !== 'DAY_OFF') continue
    holderByDate.set(row.workDate, row.staffId)
    if (row.staffId === meStaffId) mineDates.add(row.workDate)
  }

  const firstMonday = mondayOf(today)
  return Array.from({ length: WEEKS_SHOWN }, (_, index) => {
    const monday = addDays(firstMonday, index * 7)
    const dates = Array.from({ length: 7 }, (_, offset) => addDays(monday, offset))
    const mineDate = dates.find((date) => mineDates.has(date)) ?? null
    const days = dates.map((date): CalendarDay => {
      let state: DayState
      if (mineDates.has(date)) state = 'mine'
      else if (date === today) state = 'today'
      else if (date < today) state = 'past'
      else if (date > range.last) state = 'outside'
      else if (holderByDate.has(date)) state = 'taken'
      else state = mineDate === null ? 'free' : 'locked'
      return { date, state, holderStaffId: holderByDate.get(date) ?? null }
    })
    return { index, monday, days, mineDate }
  })
}
