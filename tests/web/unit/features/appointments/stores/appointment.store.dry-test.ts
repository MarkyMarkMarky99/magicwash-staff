import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { MAX_APPOINTMENTS_PER_PAGE } from '@contracts/appointments/appointment-api.schema'
import { invalidate } from '@/shared/api/response-cache'
import { todaySheetDate } from '@/shared/utils/sheet-date'

import { useAppointmentStore } from '@/data/appointments/appointment.store'

type AppointmentRow = Record<string, unknown>

const row = (id: string, overrides: AppointmentRow = {}): AppointmentRow => ({
  appointmentId: id,
  customerId: 'CUS-1',
  customerName: 'ลูกค้า',
  appointmentType: 'PICKUP',
  appointmentDate: 'Date(2026,8,7)',
  timeSlot: '13:00-15:00',
  status: 'CONFIRMED',
  ...overrides,
})

interface Call {
  url: URL
}

async function withStore(
  respond: (url: URL, init?: RequestInit) => AppointmentRow[] | AppointmentRow | Promise<AppointmentRow[]>,
  run: (store: ReturnType<typeof useAppointmentStore>, calls: Call[]) => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch
  const calls: Call[] = []

  invalidate('/api/appointments')
  globalThis.fetch = (async (input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    calls.push({ url })

    return new Response(
      JSON.stringify({ data: await respond(url, init), meta: { pagination: { page: 1, perPage: MAX_APPOINTMENTS_PER_PAGE } } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }) as typeof fetch

  setActivePinia(createPinia())
  try {
    await run(useAppointmentStore(), calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

await withStore(
  () => [
    row('APPT-1'),
    row('APPT-2', { timeSlot: '10:00-12:00' }),
    row('PAST', { appointmentDate: '2000-01-01' }),
    row('FUTURE', { appointmentDate: '2099-01-01' }),
    row('PENDING-PAST', { status: 'PENDING', appointmentDate: '2000-01-01' }),
    row('PENDING-FUTURE', { status: 'PENDING', appointmentDate: '2099-01-01' }),
    row('PENDING-TODAY', { status: 'PENDING', appointmentDate: todaySheetDate() }),
    row('PENDING-SELECTED', { status: 'PENDING' }),
  ],
  async (store, calls) => {
    await store.loadInitial()
    await store.loadDate('2026-09-07')
    assert.equal(calls.length, 1)
    const url = calls[0]!.url
    assert.equal(url.pathname, '/api/appointments')
    assert.equal(url.searchParams.get('perPage'), '1000')
    assert.equal(url.searchParams.get('page'), '1')
    assert.equal(url.searchParams.get('sortBy'), 'appointmentDate')
    assert.equal(url.searchParams.get('sortOrder'), 'asc')
    assert.equal(url.searchParams.has('appointmentDate'), false)
    assert.equal(url.searchParams.has('status'), false)
    assert.deepEqual(store.dailyItems.map((item) => item.appointmentId), ['APPT-2', 'APPT-1'])
    assert.equal(store.dailyItems[0]!.appointmentDate, '2026-09-07')
    assert.deepEqual(store.pendingItems.map((item) => item.appointmentId), ['PENDING-TODAY', 'PENDING-FUTURE'])
    assert.equal(store.pendingCount, 2)
    assert.equal(store.error, null)
    await store.loadDate('2000-01-01')
    assert.deepEqual(store.dailyItems.map((item) => item.appointmentId), ['PAST'])
    await store.loadDate('2099-01-01')
    assert.deepEqual(store.dailyItems.map((item) => item.appointmentId), ['FUTURE'])
    await store.loadPending()
    await store.loadInitial()
    assert.equal(calls.length, 1)
    await store.refreshDate()
    assert.equal(calls.length, 2)
    await store.loadPending(true)
    assert.equal(calls.length, 3)
  },
)

let release: (items: AppointmentRow[]) => void
const response = new Promise<AppointmentRow[]>((resolve) => { release = resolve })
await withStore(
  () => response,
  async (store, calls) => {
    const first = store.loadInitial()
    let secondFinished = false
    const second = store.loadDate('2026-09-07').then(() => { secondFinished = true })
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(store.loading, true)
    assert.equal(secondFinished, false)
    assert.equal(calls.length, 1)
    release!([row('APPT-1')])
    await Promise.all([first, second])
    assert.equal(secondFinished, true)
    assert.equal(store.loading, false)
    assert.equal(store.dailyItems[0]!.appointmentId, 'APPT-1')
  },
)

let persisted = row('APPT-1', { status: 'PENDING', appointmentDate: '2099-01-01' })
await withStore(
  (_url, init) => init?.method === 'PATCH' || init?.method === 'POST' ? persisted : [persisted],
  async (store) => {
    await store.loadDate('2099-01-01')
    assert.equal(store.pendingCount, 1)
    persisted = { ...persisted, status: 'CONFIRMED' }
    await store.updateStatus('APPT-1', 'CONFIRMED')
    assert.equal(store.pendingCount, 0)
    assert.equal(store.dailyItems.length, 1)
    persisted = { ...persisted, appointmentDate: '2000-01-01' }
    await store.updateStatus('APPT-1', 'CONFIRMED')
    assert.equal(store.dailyItems.length, 0)
    await store.loadDate('2000-01-01')
    assert.equal(store.dailyItems.length, 1)
    persisted = { ...persisted, status: 'PENDING' }
    await store.updateStatus('APPT-1', 'PENDING')
    assert.equal(store.dailyItems.length, 0)
    assert.equal(store.pendingCount, 0)
    persisted = row('APPT-NEW', { status: 'PENDING', appointmentDate: '2099-01-01' })
    await store.createNewAppointment({
      customerId: 'CUS-1',
      customerName: 'Customer',
      customerCode: 'C1',
      phone: '0800000000',
      address: 'Address',
      location: '',
      appointmentType: 'PICKUP',
      appointmentDate: '2099-01-01',
      timeSlot: '13:00-15:00',
    })
    assert.deepEqual(store.pendingItems.map((item) => item.appointmentId), ['APPT-NEW'])
    persisted = { ...persisted, status: 'CONFIRMED' }
    await store.updateStatus('APPT-NEW', 'CONFIRMED')
    await store.loadDate('2099-01-01')
    assert.deepEqual(store.dailyItems.map((item) => item.appointmentId), ['APPT-NEW'])
    assert.equal(store.pendingCount, 0)
  },
)

let fail = true
await withStore(
  () => {
    if (fail) throw new Error('Offline')
    return [row('APPT-1')]
  },
  async (store, calls) => {
    await store.loadPending()
    assert.equal(store.error, 'Offline')
    assert.equal(store.loading, false)
    fail = false
    await store.loadDate('2026-09-07')
    assert.equal(calls.length, 2)
    assert.equal(store.error, null)
    assert.equal(store.dailyItems.length, 1)
  },
)

console.log('passed - appointment store dry-tests')
