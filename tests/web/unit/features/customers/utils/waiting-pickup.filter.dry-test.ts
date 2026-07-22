import assert from 'node:assert/strict'
import type { z } from 'zod'
import type { appointmentListResponseSchema } from '../../../../../../contracts/appointments/appointment-api.schema'
import { filterWaitingPickups, normalizeAppointmentDate } from '../../../../../../src/features/customers/utils/waiting-pickup.filter'

type AppointmentListDto = z.infer<typeof appointmentListResponseSchema>

const now = new Date('2026-07-21T12:00:00+07:00')

function appointment(
  overrides: Partial<AppointmentListDto> = {},
): AppointmentListDto {
  return {
    appointmentId: 'appointment-1',
    customerId: 'customer-1',
    customerName: 'Somchai',
    customerCode: 'WIX',
    phone: '0812345678',
    address: '12 Sukhumvit',
    location: '12 Sukhumvit',
    appointmentType: 'PICKUP',
    appointmentDate: '2026-07-22',
    timeSlot: '13:00-15:00',
    status: 'CONFIRMED',
    notes: null,
    ...overrides,
  }
}

const tests: Array<{ name: string; run: () => void }> = []

function test(name: string, run: () => void) {
  tests.push({ name, run })
}

test('includes both active pickup statuses and sorts by date ascending', () => {
  const later = appointment({ appointmentId: 'later', appointmentDate: 'Date(2026,6,24)' })
  const earlier = appointment({ appointmentId: 'earlier', appointmentDate: '23 Jul 2026', status: 'IN_TRANSIT' })

  assert.deepEqual(
    filterWaitingPickups([later, earlier], now).map((item) => item.appointmentId),
    ['earlier', 'later'],
  )
})

test('excludes other appointment types and inactive statuses', () => {
  const excluded = [
    appointment({ appointmentId: 'delivery', appointmentType: 'DELIVERY' }),
    appointment({ appointmentId: 'pickup-delivery', appointmentType: 'PICKUP_DELIVERY' }),
    appointment({ appointmentId: 'pending', status: 'PENDING' }),
    appointment({ appointmentId: 'completed', status: 'COMPLETED' }),
    appointment({ appointmentId: 'cancelled', status: 'CANCELLED' }),
  ]

  assert.deepEqual(filterWaitingPickups(excluded, now), [])
})

test('uses the Bangkok today boundary', () => {
  const yesterday = appointment({ appointmentId: 'yesterday', appointmentDate: '2026-07-20' })
  const today = appointment({ appointmentId: 'today', appointmentDate: '2026-07-21' })
  const tomorrow = appointment({ appointmentId: 'tomorrow', appointmentDate: '2026-07-22' })

  assert.deepEqual(
    filterWaitingPickups([yesterday, tomorrow, today], now).map((item) => item.appointmentId),
    ['today', 'tomorrow'],
  )
})

test('excludes malformed and missing appointment dates', () => {
  const malformed = appointment({ appointmentId: 'malformed', appointmentDate: 'not-a-date' })
  const missing = appointment({ appointmentId: 'missing', appointmentDate: '' })

  assert.deepEqual(filterWaitingPickups([malformed, missing], now), [])
  assert.equal(normalizeAppointmentDate('Date(2026,6,21)'), '2026-07-21')
  assert.equal(normalizeAppointmentDate('21 Jul 2026'), '2026-07-21')
  assert.equal(normalizeAppointmentDate('2026-99-99'), null)
})

test('documents the current deletedAt gap instead of asserting false correctness', () => {
  // deletedAt is intentionally absent from the API contract and filter input.
  // A soft-deleted row therefore remains visible until the backend contract is expanded.
  const softDeleted = { ...appointment({ appointmentId: 'soft-deleted' }), deletedAt: '2026-07-20' }
  assert.deepEqual(filterWaitingPickups([softDeleted], now), [softDeleted])
})

for (const item of tests) {
  item.run()
}

console.log(`${tests.length} waiting-pickup filter dry tests passed`)
