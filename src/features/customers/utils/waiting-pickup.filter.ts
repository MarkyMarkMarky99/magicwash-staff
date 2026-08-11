import type { z } from 'zod'
import type { appointmentListResponseSchema } from '../../../../contracts/appointments/appointment-api.schema'
import { normalizeSheetDate } from '@/shared/utils/sheet-date'

export type WaitingPickupAppointment = z.infer<typeof appointmentListResponseSchema>

const BANGKOK_TIME_ZONE = 'Asia/Bangkok'
const ACTIVE_PICKUP_STATUSES = new Set(['CONFIRMED', 'IN_TRANSIT'])

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
      const appointmentDate = normalizeSheetDate(appointment.appointmentDate)
      return (
        appointment.appointmentType === 'PICKUP' &&
        ACTIVE_PICKUP_STATUSES.has(appointment.status) &&
        appointmentDate !== null &&
        appointmentDate >= today
      )
    })
    .sort((left, right) => {
      const leftDate = normalizeSheetDate(left.appointmentDate) ?? ''
      const rightDate = normalizeSheetDate(right.appointmentDate) ?? ''
      return leftDate.localeCompare(rightDate)
    })
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
