import type { z } from 'zod'
import type { appointmentListResponseSchema } from '../../../../contracts/appointments/appointment-api.schema'

export type WaitingPickupAppointment = z.infer<typeof appointmentListResponseSchema>

const BANGKOK_TIME_ZONE = 'Asia/Bangkok'
const ACTIVE_PICKUP_STATUSES = new Set(['CONFIRMED', 'IN_TRANSIT'])
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

/**
 * Temporary MVP exception: waiting-pickup filtering stays client-side because
 * the generic appointments list has no deletedAt/date-range query support.
 * The endpoint also caps a customer's unfiltered appointment page at 100.
 *
 * Known gap: appointmentListResponseSchema and appointment.module.ts expose no
 * deletedAt/server-side deletion filter, so a soft-deleted appointment can
 * still appear here. Do not treat this as backend deletion correctness.
 */
export function filterWaitingPickups(
  appointments: readonly WaitingPickupAppointment[],
  now: Date = new Date(),
): WaitingPickupAppointment[] {
  const today = bangkokDate(now)

  return appointments
    .filter((appointment) => {
      const appointmentDate = normalizeAppointmentDate(appointment.appointmentDate)
      return (
        appointment.appointmentType === 'PICKUP' &&
        ACTIVE_PICKUP_STATUSES.has(appointment.status) &&
        appointmentDate !== null &&
        appointmentDate >= today
      )
    })
    .sort((left, right) => {
      const leftDate = normalizeAppointmentDate(left.appointmentDate) ?? ''
      const rightDate = normalizeAppointmentDate(right.appointmentDate) ?? ''
      return leftDate.localeCompare(rightDate)
    })
}

/** Normalize the known sheet/GViz appointment date shapes for comparison/UI. */
export function normalizeAppointmentDate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const input = value.trim()
  if (input === '') {
    return null
  }

  const gvizMatch = input.match(/^Date\((\d+),(\d+),(\d+)\)$/)
  if (gvizMatch) {
    const [, year, month, day] = gvizMatch
    return validDate(year, Number(month) + 1, day)
  }

  const displayMatch = input.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (displayMatch) {
    const [, day, monthName, year] = displayMatch
    const month = MONTHS.get(monthName.toLowerCase())
    return month === undefined ? null : validDate(year, month, day)
  }

  const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return validDate(year, month, day)
  }

  return null
}

function bangkokDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BANGKOK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function validDate(year: string, month: string | number, day: string): string | null {
  const numericYear = Number(year)
  const numericMonth = Number(month)
  const numericDay = Number(day)
  const date = new Date(Date.UTC(numericYear, numericMonth - 1, numericDay))

  if (
    date.getUTCFullYear() !== numericYear ||
    date.getUTCMonth() !== numericMonth - 1 ||
    date.getUTCDate() !== numericDay
  ) {
    return null
  }

  return `${year.padStart(4, '0')}-${String(numericMonth).padStart(2, '0')}-${String(numericDay).padStart(2, '0')}`
}
