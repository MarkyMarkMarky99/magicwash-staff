import { normalizeSheetDate, todaySheetDate } from '@/shared/utils/sheet-date'

export function toAppointmentDate(date: Date): string {
  return todaySheetDate(date)
}

export function appointmentDateFromString(value: string): Date {
  const normalized = normalizeSheetDate(value) ?? value
  const [year, month, day] = normalized.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function addAppointmentDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}
