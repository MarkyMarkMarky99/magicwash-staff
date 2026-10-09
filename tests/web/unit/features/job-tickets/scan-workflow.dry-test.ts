import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import type { JobTicketDto } from '@/data/job-tickets/job-ticket.service'
import { useJobTicketStore } from '@/data/job-tickets/job-ticket.store'
import { completionPercentage, countDepartmentStatuses } from '@/features/job-tickets/department-work'
import { createTagScanGuard, presentStartOrderResult } from '@/features/job-tickets/scan-result'

const row: JobTicketDto = {
  id: 'WSH-order-1-tag-1', orderId: 'order-1', laundryItemId: 'tag-1', scope: 'ITEM', taskCode: 'WSH-STANDARD',
  department: 'Washing', stepNo: 1, customerId: 'customer-1', orderName: null, dueDate: null,
  specialInstructions: null, notes: null, status: 'Pending', startedAt: null, completedAt: null,
  scannedBy: null, photoEvidenceUrl: null, createdAt: null, createdBy: null, updatedAt: null,
  updatedBy: null, deletedAt: null, deletedBy: null,
}
const originalFetch = globalThis.fetch
let responseStatus = 200
let rawResponse: unknown = null
const requests: Array<{ url: string; method: string; body: unknown }> = []

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  requests.push({ url: String(input), method: init?.method ?? 'GET', body: JSON.parse(String(init?.body)) })
  return new Response(JSON.stringify(rawResponse), { status: responseStatus, headers: { 'Content-Type': 'application/json' } })
}) as typeof fetch

try {
  setActivePinia(createPinia())
  const store = useJobTicketStore()
  store.rows.set(row.id, row)

  store.rows.set(row.id, { ...row, status: 'Pending', startedAt: null, scannedBy: null })
  const startPayload = { orderId: 'order-1', department: 'Washing', scannedBy: 'staff-2' } as const
  responseStatus = 200
  rawResponse = {
    kind: 'completed',
    advanced: [{ ticketId: row.id, laundryItemId: 9305753, status: 'In Progress', startedAt: '2026-09-23 10:00:00' }],
    blocked: [{ ticketId: 'ticket-2', laundryItemId: 9305754, blockedByDepartment: 'DryCleaning' }],
    skippedWithoutTag: 1,
  }
  const started = await store.startOrder(startPayload)
  assert.equal(requests.at(-1)?.url, '/api/job-tickets/start-order')
  assert.deepEqual(requests.at(-1)?.body, startPayload)
  assert.deepEqual(started, {
    kind: 'completed',
    advanced: [{ ticketId: row.id, laundryItemId: '09305753', status: 'In Progress', startedAt: '2026-09-23 10:00:00' }],
    blocked: [{ ticketId: 'ticket-2', laundryItemId: '09305754', blockedByDepartment: 'DryCleaning' }],
    skippedWithoutTag: 1,
  })
  assert.deepEqual(countDepartmentStatuses(store.orderTickets('order-1')), { ALL: 1, PENDING: 0, 'IN PROGRESS': 1, COMPLETED: 0 })
  assert.equal(store.orderTickets('order-1')[0]?.status, 'In Progress')
  assert.equal(store.orderTickets('order-1')[0]?.startedAt, '2026-09-23 10:00:00')
  assert.equal(store.orderTickets('order-1')[0]?.scannedBy, 'staff-2')
  const advancePayload = { department: 'Washing', fromStatus: 'In Progress', tickets: [{ ticketId: row.id, orderId: 'order-1' }], scannedBy: 'staff-3' } as const
  rawResponse = { kind: 'completed', advanced: [{ ticketId: row.id, laundryItemId: 9305753, status: 'Completed', startedAt: '2026-09-23 10:00:00', completedAt: '2026-09-23 11:00:00' }], blocked: [{ ticketId: 'ticket-2', laundryItemId: 9305754, blockedByDepartment: 'DryCleaning' }], skipped: [], scoreFailed: 0 }
  const advanced = await store.advanceTickets(advancePayload)
  assert.equal(requests.at(-1)?.url, '/api/job-tickets/advance')
  assert.deepEqual(requests.at(-1)?.body, advancePayload)
  assert.equal(advanced.kind, 'completed')
  if (advanced.kind === 'completed') {
    assert.equal(advanced.advanced[0]?.laundryItemId, '09305753')
    assert.equal(advanced.blocked[0]?.laundryItemId, '09305754')
  }
  assert.equal(completionPercentage(store.orderTickets('order-1')), 100)
  assert.equal(store.orderTickets('order-1').length, 1)
  assert.equal(store.orderTickets('order-1')[0]?.status, 'Completed')
  assert.equal(store.orderTickets('order-1')[0]?.completedAt, '2026-09-23 11:00:00')
  assert.equal(store.orderTickets('order-1')[0]?.scannedBy, 'staff-3')
  rawResponse = null
  assert.deepEqual(presentStartOrderResult(started), {
    tone: 'error', message: '1 advanced · 1 blocked · 1 skipped without tag · Blocked by Dry Cleaning',
  })
  assert.deepEqual(presentStartOrderResult({ kind: 'completed', advanced: [], blocked: [], skippedWithoutTag: 1 }), {
    tone: 'warning', message: '0 advanced · 0 blocked · 1 skipped without tag',
  })
  assert.deepEqual(presentStartOrderResult({ kind: 'completed', advanced: [], blocked: [], skippedWithoutTag: 0 }), {
    tone: 'success', message: '0 advanced · 0 blocked · 0 skipped without tag',
  })
  for (const [certainty, status, message] of [
    ['rejected', 502, 'Could not save. Try again'],
    ['unknown', 500, 'Could not save. Check the order before starting again'],
  ] as const) {
    responseStatus = status
    rawResponse = { kind: 'write_failed', certainty, blocked: [], skippedWithoutTag: 0 }
    const failed = await store.startOrder(startPayload)
    assert.equal(failed.kind, 'write_failed')
    assert.deepEqual(presentStartOrderResult(failed), { tone: 'error', message })
  }
  await assert.rejects(() => store.startOrder({ ...startPayload, orderId: ' ' }))
  assert.equal(requests.length, 4)
  store.$dispose()

  const guard = createTagScanGuard()
  let release: (() => void) | undefined
  const waiting = new Promise<void>(resolve => { release = resolve })
  let sends = 0
  const first = guard('tag-1', async () => { sends += 1; await waiting })
  assert.equal(await guard('tag-1', async () => { sends += 1 }), false)
  assert.equal(await guard('tag-2', async () => { sends += 1 }), true)
  assert.equal(sends, 2)
  release?.()
  assert.equal(await first, true)
  assert.equal(await guard('tag-1', async () => { sends += 1 }), true)
  assert.equal(sends, 3)
  await assert.rejects(() => guard('tag-3', async () => { throw new Error('offline') }))
  assert.equal(await guard('tag-3', async () => { sends += 1 }), true)
  assert.equal(sends, 4)

  console.log('scan-workflow.dry-test: OK')
} finally {
  globalThis.fetch = originalFetch
}
