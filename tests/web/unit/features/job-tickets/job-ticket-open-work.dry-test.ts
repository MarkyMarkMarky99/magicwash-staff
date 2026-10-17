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
let waiting: Promise<void> | undefined
let mode: 'normal' | 'capped' | 'failed' = 'normal'
let cappedCount = MAX_DEPARTMENT_TICKETS
let generation = 'current'
const originalFetch = globalThis.fetch
setActivePinia(createPinia())
let store = useJobTicketStore()
const settle = () => new Promise(resolve => setImmediate(resolve))

globalThis.fetch = (async input => {
  const url = new URL(String(input), 'http://localhost')
  calls.push(url)
  if (url.searchParams.has('orderId')) {
    return Response.json({ success: true, data: [ticket('order-only', 'Packaging', 'Completed')], meta: { pagination: { page: 1, perPage: 500 } } })
  }
  assert.equal(url.pathname, '/api/job-tickets/department-work')
  assert.deepEqual([...url.searchParams.keys()], ['department'])
  const department = url.searchParams.get('department') as JobTicketDto['department']
  assert.ok(department)
  const snapshot = generation
  await waiting
  if (mode === 'failed') return Response.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Work offline' } }, { status: 500 })
  const data = mode === 'capped'
    ? Array.from({ length: cappedCount }, (_, index) => ticket(`${department}-${index}`, department))
    : [ticket(`${department}-${snapshot}`, department), { ...ticket(`${department}-older`, department, 'Completed'), completedAt: '2020-01-01 10:00:00' }]
  return Response.json({ success: true, data })
}) as typeof fetch

try {
  let finish!: () => void
  waiting = new Promise<void>(resolve => { finish = resolve })
  const first = store.loadDepartment('Packaging')
  const duplicate = store.loadDepartment('Packaging')
  assert.equal(store.loading, true)
  await settle()
  assert.equal(calls.length, 1, 'concurrent loads of one department share a request')
  finish()
  await Promise.all([first, duplicate])
  waiting = undefined
  assert.equal(store.loading, false)
  assert.equal(store.truncated, false)
  assert.deepEqual(store.tickets.map(row => row.id), ['Packaging-current', 'Packaging-older'])
  await store.loadDepartment('Washing')
  assert.deepEqual(calls.map(url => url.searchParams.get('department')), ['Packaging', 'Washing'])
  assert.deepEqual(store.tickets.map(row => row.id), ['Washing-current', 'Washing-older'])
  assert.equal(store.rows.has('Ironing-current'), false, 'unopened departments are not fetched')
  await store.loadDepartment('Packaging')
  assert.equal(calls.length, 2, 'returning to a loaded department reuses its work')


  waiting = new Promise<void>(resolve => { finish = resolve })
  const refresh = store.loadDepartment('Packaging', true)
  assert.equal(store.loading, false, 'loaded rows stay visible while refreshing')
  assert.deepEqual(store.tickets.map(row => row.id), ['Packaging-current', 'Packaging-older'])
  await settle()
  assert.equal(calls.length, 3, 'forceReload refetches')
  finish()
  await refresh
  waiting = undefined
  await store.loadOrder('order-1')
  assert.equal(store.rows.has('order-only'), true)
  assert.deepEqual(store.tickets.map(row => row.id), ['Packaging-current', 'Packaging-older'])

  calls.length = 0
  invalidate('/api/job-tickets')
  await settle()
  assert.deepEqual(calls.map(url => url.searchParams.get('department')), ['Packaging'])
  store.activateDepartment('Washing')
  await settle()
  assert.deepEqual(calls.map(url => url.searchParams.get('department')), ['Packaging', 'Washing'], 'inactive departments stay stale until activated')
  store.activateDepartment('Packaging')
  await settle()
  assert.equal(calls.length, 2)

  mode = 'failed'
  await store.loadDepartment('Packaging', true)
  assert.equal(store.loading, false)
  assert.equal(store.error, 'Work offline')
  mode = 'normal'
  await store.loadDepartment('Packaging')
  assert.equal(store.error, null)

  mode = 'capped'
  await store.loadDepartment('Packaging', true)
  assert.equal(store.tickets.length, MAX_DEPARTMENT_TICKETS)
  assert.equal(store.truncated, true, 'exactly the cap warns that the list may be incomplete')
  cappedCount += 1
  await store.loadDepartment('Packaging', true)
  assert.equal(store.rows.has(`Packaging-${MAX_DEPARTMENT_TICKETS}`), true, 'the server result is not capped in the store')
  assert.equal(store.tickets.length, MAX_DEPARTMENT_TICKETS)
  assert.equal(store.truncated, true)
  mode = 'normal'
  await store.loadDepartment('Packaging', true)
  assert.equal(store.truncated, false)
  store.$dispose()

  setActivePinia(createPinia())
  store = useJobTicketStore()
  calls.length = 0
  let finishOld!: () => void
  waiting = new Promise<void>(resolve => { finishOld = resolve })
  generation = 'old'
  const oldLoad = store.loadDepartment('Packaging')
  await settle()
  invalidate('/api/job-tickets')
  let finishNew!: () => void
  waiting = new Promise<void>(resolve => { finishNew = resolve })
  generation = 'new'
  await settle()
  assert.equal(calls.length, 1, 'the invalidated request settles before a replacement starts')
  finishOld()
  await oldLoad
  await settle()
  assert.equal(store.loading, true)
  assert.equal(store.rows.has('Packaging-old'), false, 'invalidated results never merge')
  assert.equal(calls.length, 2)
  finishNew()
  await settle()
  assert.equal(store.loading, false)
  assert.deepEqual(store.tickets.map(row => row.id), ['Packaging-new', 'Packaging-older'])
  console.log('job-ticket-open-work.dry-test: OK (department requests, reuse, refresh, retry, cap, invalidation races)')
} finally {
  store.$dispose()
  globalThis.fetch = originalFetch
}
