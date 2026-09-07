import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'

import { useAppointmentStore } from '@/features/appointments/stores/appointment.store'

/**
 * Executable, not a source scan. The store used to page-walk the whole sheet and
 * filter dates in the browser because the API's `appointmentDate` filter silently
 * returned nothing (a native Sheets date cell needs a typed GViz literal). That
 * cost five sequential reads, ~10.7s, on every hard page load of ANY page, since
 * `App.vue` calls `loadInitial()` on mount.
 *
 * Counting real requests through a stubbed `fetch` is what pins the fix: a source
 * scan would still pass if the loop came back, and so would any assertion that only
 * looks at the resulting rows.
 */

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
  respond: (url: URL) => AppointmentRow[],
  run: (store: ReturnType<typeof useAppointmentStore>, calls: Call[]) => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch
  const calls: Call[] = []

  globalThis.fetch = (async (input: URL | string) => {
    const url = new URL(String(input), 'http://localhost')
    calls.push({ url })

    return new Response(
      JSON.stringify({ data: respond(url), meta: { pagination: { page: 1, perPage: 100 } } }),
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

const dailyCalls = (calls: Call[]): Call[] =>
  calls.filter((call) => call.url.searchParams.get('status') !== 'PENDING')

// A day loads in exactly one request, and that request carries the date filter.
await withStore(
  () => [row('APPT-1'), row('APPT-2', { timeSlot: '10:00-12:00' })],
  async (store, calls) => {
    await store.loadDate('2026-09-07')

    const daily = dailyCalls(calls)
    assert.equal(daily.length, 1, 'loading a date must issue exactly one request, not a page walk')
    assert.equal(daily[0]!.url.pathname, '/api/appointments')
    assert.equal(
      daily[0]!.url.searchParams.get('appointmentDate'),
      '2026-09-07',
      'the date must be filtered by the API, not in the browser',
    )
    // `page` is the schema's default, not a walk — the request COUNT above is the guard.
    assert.equal(daily[0]!.url.searchParams.get('page'), '1', 'only ever the first page')

    assert.equal(store.dailyItems.length, 2)
    assert.equal(store.error, null)
  },
)

// GViz returns a native date cell in its wire format; the store must still normalize it.
await withStore(
  () => [row('APPT-1')],
  async (store) => {
    await store.loadDate('2026-09-07')

    assert.equal(
      store.dailyItems[0]!.appointmentDate,
      '2026-09-07',
      'Date(Y,M,D) must be normalized to ISO before it reaches the view',
    )
  },
)

// PENDING belongs to the pending queue only, never to a day.
await withStore(
  () => [row('APPT-1'), row('APPT-2', { status: 'PENDING' })],
  async (store) => {
    await store.loadDate('2026-09-07')

    assert.equal(store.dailyItems.length, 1)
    assert.equal(store.dailyItems[0]!.appointmentId, 'APPT-1')
  },
)

// A loaded date is cached: revisiting it must not refetch.
await withStore(
  () => [row('APPT-1')],
  async (store, calls) => {
    await store.loadDate('2026-09-07')
    const after = dailyCalls(calls).length

    await store.loadDate('2026-09-07')
    assert.equal(dailyCalls(calls).length, after, 'a loaded date must not refetch')

    await store.loadDate('2026-09-05')
    assert.equal(dailyCalls(calls).length, after + 1, 'a different date must fetch once')
  },
)

console.log('passed - appointment store dry-tests')
