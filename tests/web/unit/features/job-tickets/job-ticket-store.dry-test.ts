import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useJobTicketStore } from '@/data/job-tickets/job-ticket.store'
import type { JobTicketDto } from '@/data/job-tickets/job-ticket.service'
import { invalidate } from '@/shared/api/response-cache'

const ticket = (id: string, orderId = 'order-1', status: JobTicketDto['status'] = 'Pending'): JobTicketDto => ({
  id, orderId, laundryItemId: id, scope: 'ITEM', taskCode: 'PCK-STANDARD', department: 'Packaging', stepNo: 3,
  customerId: 'customer-1', orderName: null, dueDate: null, specialInstructions: null, notes: null, status,
  startedAt: null, completedAt: null, scannedBy: null, photoEvidenceUrl: null, createdAt: null, createdBy: null,
  updatedAt: null, updatedBy: null, deletedAt: null, deletedBy: null,
})
const calls: URL[] = []
let deferred: Promise<void> | undefined
let fail = false
const originalFetch = globalThis.fetch
setActivePinia(createPinia())
const store = useJobTicketStore()
globalThis.fetch = (async (input, init) => {
  const url = new URL(String(input), 'http://localhost')
  calls.push(url)
  if (init?.method === 'POST') {
    const payload = JSON.parse(String(init.body))
    const advanced = { ticketId: 'shared', laundryItemId: 'shared', status: 'In Progress', startedAt: '2026-10-09 10:00:00', completedAt: null }
    const data = url.pathname.endsWith('/scan') ? { kind: 'advanced', ...advanced }
      : { kind: 'completed', advanced: [advanced], blocked: [], skipped: [], skippedWithoutTag: 0, scoreFailed: 0 }
    assert.equal(payload.scannedBy, 'staff-1')
    return Response.json(data)
  }
  const orderId = url.searchParams.get('orderId')
  if (orderId === 'order-1' && deferred) await deferred
  if (fail && orderId) return Response.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Offline' } }, { status: 500 })
  const status = url.searchParams.get('status')
  const data = orderId ? [ticket(orderId === 'order-1' ? 'shared' : `${orderId}-shared`, orderId), { ...ticket(orderId === 'order-1' ? 'older' : `${orderId}-older`, orderId, 'Completed'), completedAt: '2020-01-01 10:00:00' }]
    : status === 'Pending' ? [ticket('shared'), { ...ticket('washing'), department: 'Washing' }] : []
  return Response.json({ success: true, data, meta: { pagination: { page: 1, perPage: 500 } } })
}) as typeof fetch

try {
  await store.loadDepartment('Packaging')
  assert.deepEqual(store.tickets.map(row => row.id), ['shared'])
  assert.equal(store.rows.get('washing')?.department, 'Washing')
  assert.deepEqual(calls.filter(url => url.searchParams.has('status')).map(url => [url.searchParams.get('status'), url.searchParams.get('department')]), [['Pending', null], ['In Progress', null], ['Completed', 'Packaging']])
  const beforeSwitch = calls.length
  await store.loadDepartment('Washing')
  assert.deepEqual(store.tickets.map(row => row.id), ['washing'])
  assert.equal(calls.length, beforeSwitch + 1)
  assert.equal(calls.at(-1)?.searchParams.get('status'), 'Completed')
  assert.equal(calls.at(-1)?.searchParams.get('department'), 'Washing')
  await store.loadDepartment('Packaging')
  assert.equal(calls.length, beforeSwitch + 2)
  let release!: () => void
  deferred = new Promise<void>(resolve => { release = resolve })
  const pending = store.loadOrder('order-1')
  assert.equal(store.orderView('order-1').loading, true)
  assert.deepEqual(store.orderTickets('order-1', 'Packaging').map(row => row.id), ['shared'])
  assert.equal(store.orderTickets('order-1')[0], store.tickets[0])
  assert.equal(store.loading, false)
  release()
  await pending
  deferred = undefined
  assert.deepEqual(store.orderTickets('order-1').map(row => row.id), ['shared', 'older', 'washing'])
  assert.deepEqual(store.tickets.map(row => row.id), ['shared'])
  assert.equal(store.tickets[0], store.orderTickets('order-1')[0])
  for (const write of [
    () => store.scan({ laundryItemId: 'shared', department: 'Packaging', scannedBy: 'staff-1' }),
    () => store.startOrder({ orderId: 'order-1', department: 'Packaging', scannedBy: 'staff-1' }),
    () => store.advanceTickets({ department: 'Packaging', fromStatus: 'Pending', scannedBy: 'staff-1', tickets: [{ ticketId: 'shared', orderId: 'order-1' }] }),
  ]) {
    const row = store.tickets[0]
    await write()
    assert.equal(store.tickets[0], row)
    assert.equal(store.orderTickets('order-1')[0], row)
    assert.equal(row.status, 'In Progress')
    assert.equal(row.scannedBy, 'staff-1')
    row.status = 'Pending'
  }
  await store.loadOrder('unused', 'Logistics')
  assert.equal(store.rows.has('older'), true)
  const releaseFirst = store.retainOrder('order-1')
  const releaseSecond = store.retainOrder('order-1')
  const releaseLogistics = store.retainOrder('visible', 'Logistics')
  releaseFirst()
  releaseFirst()
  calls.length = 0
  invalidate('/api/job-tickets')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls.filter(url => url.searchParams.has('status')).length, 3)
  assert.deepEqual(calls.filter(url => ['Pending', 'In Progress'].includes(url.searchParams.get('status') ?? '')).map(url => url.searchParams.get('department')), [null, null])
  assert.deepEqual(calls.filter(url => url.searchParams.has('orderId')).map(url => [url.searchParams.get('orderId'), url.searchParams.get('department')]), [['order-1', null], ['visible', 'Logistics']])
  assert.ok(calls.filter(url => url.searchParams.has('orderId')).every(url => url.searchParams.get('perPage') === '500'))
  releaseSecond()
  releaseLogistics()
  store.releaseDepartment()
  calls.length = 0
  invalidate('/api/job-tickets')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls.length, 0)
  store.activateDepartment('Packaging')
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(store.tickets.map(row => row.id), ['shared'])
  fail = true
  await assert.rejects(store.loadOrder('failed'))
  assert.equal(store.orderView('failed').loading, false)
  assert.ok(store.orderView('failed').error)
  assert.equal(store.error, null)
  fail = false
  await store.loadOrder('failed')
  assert.equal(store.orderView('failed').error, null)
  assert.equal(store.orderView('failed').truncated, false)
  console.log('job-ticket-store.dry-test: OK (shared rows, isolated views, cached getter, writes, active invalidation, errors)')
} finally {
  store.$dispose()
  globalThis.fetch = originalFetch
}
