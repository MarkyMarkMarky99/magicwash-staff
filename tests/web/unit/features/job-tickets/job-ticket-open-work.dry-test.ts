import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useJobTicketStore } from '@/data/job-tickets/job-ticket.store'
import { MAX_DEPARTMENT_TICKETS, type JobTicketDto } from '@/data/job-tickets/job-ticket.service'
import { invalidate } from '@/shared/api/response-cache'

const ticket = (id: string, department: JobTicketDto['department'], status: JobTicketDto['status'] = 'Pending'): JobTicketDto => ({
  id, department, status, orderId: 'order-1', laundryItemId: id, scope: 'ITEM', taskCode: 'TASK', stepNo: 1,
  customerId: 'customer-1', orderName: null, dueDate: null, specialInstructions: null, notes: null,
  startedAt: null, completedAt: status === 'Completed' ? '2099-01-01 10:00:00' : null,
  scannedBy: null, photoEvidenceUrl: null, createdAt: null, createdBy: null, updatedAt: null,
  updatedBy: null, deletedAt: null, deletedBy: null,
})
const calls: URL[] = []
let finishOpen!: () => void
let waiting = new Promise<void>(resolve => { finishOpen = resolve })
let mode: 'shared' | 'capped' | 'failed' = 'shared'
const originalFetch = globalThis.fetch
setActivePinia(createPinia())
let store = useJobTicketStore()
globalThis.fetch = (async input => {
  const url = new URL(String(input), 'http://localhost')
  calls.push(url)
  const status = url.searchParams.get('status')
  const department = url.searchParams.get('department') as JobTicketDto['department']
  const page = Number(url.searchParams.get('page'))
  const perPage = Number(url.searchParams.get('perPage'))
  if (status !== 'Completed' && !url.searchParams.has('orderId')) {
    assert.equal(department, null)
    assert.equal(perPage, MAX_DEPARTMENT_TICKETS)
    assert.equal(url.searchParams.get('sortBy'), 'createdAt')
    assert.equal(url.searchParams.get('sortOrder'), 'desc')
    await waiting
    if (mode === 'failed' && status === 'Pending') return Response.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Open work offline' } }, { status: 500 })
  }
  let data: JobTicketDto[]
  if (url.searchParams.has('orderId')) {
    data = [ticket('packaging-open', 'Packaging'), { ...ticket('old-order-completed', 'Packaging', 'Completed'), completedAt: '2020-01-01 10:00:00' }]
  } else if (mode === 'capped') {
    const total = status === 'Pending' ? MAX_DEPARTMENT_TICKETS - 500 : status === 'In Progress' ? 600 : 0
    const start = (page - 1) * perPage
    data = Array.from({ length: Math.max(0, Math.min(perPage, total - start)) }, (_, index) => ticket(`${status}-${start + index}`, (start + index) % 2 ? 'Washing' : 'Packaging', status as JobTicketDto['status']))
  } else if (status === 'Completed') {
    assert.equal(url.searchParams.get('sortBy'), 'completedAt')
    data = [ticket(`${department}-completed`, department, 'Completed'), { ...ticket(`${department}-older`, department, 'Completed'), completedAt: '2020-01-01 10:00:00' }]
  } else {
    data = status === 'Pending' ? [ticket('packaging-open', 'Packaging'), ticket('washing-open', 'Washing'), ticket('ironing-open', 'Ironing')]
      : [ticket('logistics-open', 'Logistics', 'In Progress')]
  }
  return Response.json({ success: true, data, meta: { pagination: { page, perPage } } })
}) as typeof fetch

try {
  const packaging = store.loadDepartment('Packaging')
  const washing = store.loadDepartment('Washing')
  assert.equal(store.loading, true)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(calls.map(url => [url.searchParams.get('status'), url.searchParams.get('department')]), [['Pending', null], ['In Progress', null], ['Completed', 'Packaging'], ['Completed', 'Washing']])
  finishOpen()
  await Promise.all([packaging, washing])
  assert.equal(store.loading, false)
  assert.equal(store.truncated, false)
  assert.deepEqual(store.tickets.map(row => row.id), ['washing-open', 'Washing-completed'])
  assert.equal(store.rows.has('ironing-open'), true)
  assert.deepEqual(store.orderTickets('order-1', 'Logistics').map(row => row.id), ['logistics-open'])
  assert.equal(store.rows.has('Washing-older'), false)
  await store.loadDepartment('Packaging')
  assert.equal(calls.filter(url => url.searchParams.get('status') !== 'Completed').length, 2)
  assert.deepEqual(store.tickets.map(row => row.id), ['packaging-open', 'Packaging-completed'])
  const refresh = store.loadDepartment('Packaging')
  assert.equal(store.loading, false, 'a loaded department keeps showing its rows while it refreshes')
  assert.deepEqual(store.tickets.map(row => row.id), ['packaging-open', 'Packaging-completed'])
  await refresh
  await store.loadOrder('order-1')
  assert.equal(store.rows.has('old-order-completed'), true)
  assert.deepEqual(store.tickets.map(row => row.id), ['packaging-open', 'Packaging-completed'])
  store.$dispose()

  setActivePinia(createPinia())
  store = useJobTicketStore()
  calls.length = 0
  mode = 'capped'
  await store.loadDepartment('Packaging')
  assert.equal(store.rows.size, MAX_DEPARTMENT_TICKETS)
  assert.equal(store.tickets.length, MAX_DEPARTMENT_TICKETS / 2)
  assert.equal(store.truncated, true)
  assert.equal([...store.rows.values()].filter(row => row.status === 'Pending').length, MAX_DEPARTMENT_TICKETS - 500)
  assert.equal([...store.rows.values()].filter(row => row.status === 'In Progress').length, 500)
  assert.deepEqual(calls.filter(url => url.searchParams.get('status') === 'Pending').map(url => url.searchParams.get('page')), ['1'])
  const beforeSwitch = calls.length
  await store.loadDepartment('Washing')
  assert.equal(calls.length, beforeSwitch + 1)
  assert.equal(store.tickets.length, MAX_DEPARTMENT_TICKETS / 2)
  assert.equal(store.truncated, true)
  mode = 'failed'
  await store.loadDepartment('Packaging', true)
  assert.equal(store.loading, false)
  assert.ok(store.error)
  mode = 'shared'
  await store.loadDepartment('Packaging')
  assert.equal(store.error, null)
  assert.equal(store.truncated, false)
  assert.deepEqual(store.tickets.map(row => row.id), ['packaging-open', 'Packaging-completed'])
  store.$dispose()
  setActivePinia(createPinia())
  store = useJobTicketStore()
  calls.length = 0
  let finishOld!: () => void
  waiting = new Promise<void>(resolve => { finishOld = resolve })
  const oldLoad = store.loadDepartment('Packaging')
  await new Promise(resolve => setImmediate(resolve))
  store.releaseDepartment()
  invalidate('/api/job-tickets')
  let finishNew!: () => void
  waiting = new Promise<void>(resolve => { finishNew = resolve })
  store.activateDepartment('Packaging')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(calls.filter(url => url.searchParams.get('status') !== 'Completed').length, 2)
  finishOld()
  await oldLoad
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(store.loading, true)
  assert.equal(store.rows.has('packaging-open'), false)
  assert.equal(calls.filter(url => url.searchParams.get('status') !== 'Completed').length, 4)
  finishNew()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(store.loading, false)
  const currentRow = store.rows.get('packaging-open')
  assert.ok(currentRow)
  assert.equal(store.loading, false)
  assert.equal(store.rows.get('packaging-open'), currentRow)
  console.log('job-ticket-open-work.dry-test: OK (parallel shared load, reuse, department isolation, combined cap, refresh, retry)')
} finally {
  store.$dispose()
  globalThis.fetch = originalFetch
}
