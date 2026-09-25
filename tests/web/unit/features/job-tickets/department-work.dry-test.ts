import assert from 'node:assert/strict'
import type { JobTicketDto, JobTicketListQuery } from '@/data/job-tickets/job-ticket.service'
import { completedTodayFromPage, listJobTickets, loadDepartmentTickets, MAX_DEPARTMENT_TICKETS } from '@/data/job-tickets/job-ticket.service'
import { completionPercentage, countDepartmentStatuses, filterTickets, groupDepartmentOrders, readDepartment, readGrouper, readStatusFilter, sortDepartmentTickets } from '@/features/job-tickets/department-work'
import { normalizeGarmentTagId } from '@/shared/utils/garment-tag-id'

function ticket(id: string, orderId: string, status: JobTicketDto['status'], completedAt: string | null = null): JobTicketDto {
  return {
    id, orderId, laundryItemId: id, scope: 'ITEM', serviceType: 'WASH', department: 'Washing', stepNo: 1,
    customerId: 'customer-1', orderName: null, dueDate: null, specialInstructions: null, notes: null,
    status, startedAt: null, completedAt, scannedBy: null, photoEvidenceUrl: null,
    createdAt: null, createdBy: null, updatedAt: null, updatedBy: null, deletedAt: null, deletedBy: null,
  }
}

assert.equal(readDepartment('washing')?.code, 'Washing')
assert.equal(readDepartment('drycleaning')?.code, 'DryCleaning')
assert.equal(readDepartment('ironing')?.code, 'Ironing')
assert.equal(readDepartment('packaging')?.code, 'Packaging')
assert.equal(readDepartment('__proto__'), null)
assert.equal(readStatusFilter('CANCELLED'), 'ALL')
assert.equal(readStatusFilter('IN PROGRESS'), 'IN PROGRESS')
assert.equal(readGrouper('item'), 'item')
assert.equal(readGrouper('unknown'), 'order')

const tickets = [ticket('tag-a', 'order-late', 'Pending'), ticket('tag-b', 'order-soon', 'Completed'), ticket('tag-c', 'order-soon', 'In Progress')]
const orderInfo = new Map([
  ['order-late', { dueDate: '2026-10-02', customerId: 'customer-1', customerName: 'Late', customerIndex: 'LAT' }],
  ['order-soon', { dueDate: '2026-09-24', customerId: 'customer-2', customerName: 'Soon', customerIndex: 'SOO' }],
])
assert.deepEqual(sortDepartmentTickets(tickets, orderInfo).map(row => row.id), ['tag-b', 'tag-c', 'tag-a'])
assert.deepEqual(groupDepartmentOrders(tickets, orderInfo).map(order => order.orderId), ['order-soon', 'order-late'])
assert.deepEqual(groupDepartmentOrders(filterTickets(tickets, 'PENDING'), orderInfo).map(order => order.orderId), ['order-late'])
assert.deepEqual(sortDepartmentTickets(filterTickets(tickets, 'PENDING'), orderInfo).map(row => row.id), ['tag-a'])
assert.equal(groupDepartmentOrders(tickets, orderInfo)[0]?.percentage, 50)
assert.equal(completionPercentage([]), 0)
assert.equal(completionPercentage(tickets), 33)
assert.deepEqual(countDepartmentStatuses(tickets), { ALL: 3, PENDING: 1, 'IN PROGRESS': 1, COMPLETED: 1 })

assert.equal(normalizeGarmentTagId(18806075), '18806075')
assert.equal(normalizeGarmentTagId(9305753), '09305753')
assert.equal(normalizeGarmentTagId('Ab12Cd34'), 'Ab12Cd34')
assert.equal(normalizeGarmentTagId(null), null)
assert.equal(normalizeGarmentTagId(undefined), null)

const originalFetch = globalThis.fetch
globalThis.fetch = (async () => new Response(JSON.stringify({
  success: true,
  data: [
    { ...ticket('numeric-full', 'order-soon', 'Pending'), laundryItemId: 18806075 },
    { ...ticket('numeric-short', 'order-soon', 'In Progress'), laundryItemId: 9305753 },
    { ...ticket('missing', 'order-soon', 'Completed'), laundryItemId: null },
    { ...ticket('alpha', 'order-late', 'Pending'), laundryItemId: 'Ab12Cd34' },
  ],
  meta: { pagination: { page: 1, perPage: 500, total: 4, totalPages: 1 } },
}), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch

let productionTickets: JobTicketDto[]
try {
  productionTickets = (await listJobTickets({ department: 'Washing' })).items
} finally {
  globalThis.fetch = originalFetch
}
assert.deepEqual(productionTickets.map(row => row.laundryItemId), ['18806075', '09305753', null, 'Ab12Cd34'])
assert.deepEqual(countDepartmentStatuses(productionTickets), { ALL: 4, PENDING: 2, 'IN PROGRESS': 1, COMPLETED: 1 })
for (const [filter, expectedIds] of [
  ['ALL', ['numeric-short', 'numeric-full', 'alpha', 'missing']],
  ['PENDING', ['numeric-full', 'alpha']],
  ['IN PROGRESS', ['numeric-short']],
  ['COMPLETED', ['missing']],
] as const) {
  const filtered = filterTickets(productionTickets, filter)
  const sorted = sortDepartmentTickets(filtered, orderInfo)
  assert.deepEqual(sorted.map(row => row.id), expectedIds)
  const grouped = groupDepartmentOrders(sorted, orderInfo)
  assert.equal(grouped.reduce((count, order) => count + order.tickets.length, 0), expectedIds.length)
  assert.equal(countDepartmentStatuses(productionTickets)[filter], expectedIds.length)
}

const today = '2026-09-23'
const completed = [
  ticket('today', 'order-soon', 'Completed', '2026-09-23T00:10:00+07:00'),
  ticket('yesterday', 'order-soon', 'Completed', '2026-09-22T23:59:00+07:00'),
]
assert.deepEqual(completedTodayFromPage(completed, today), { tickets: [completed[0]], reachedOlder: true })
assert.deepEqual(completedTodayFromPage([completed[0]!], today), { tickets: [completed[0]], reachedOlder: false })
assert.equal(completedTodayFromPage([ticket('utc-boundary', 'order-soon', 'Completed', '2026-09-22T18:00:00Z')], today).tickets.length, 1)
assert.deepEqual(completedTodayFromPage([ticket('missing-date', 'order-soon', 'Completed'), completed[0]!], today), { tickets: [completed[0]], reachedOlder: false })

const calls: Partial<JobTicketListQuery>[] = []
const loaded = await loadDepartmentTickets('Washing', new Date('2026-09-23T03:00:00Z'), async query => {
  calls.push(query)
  const items = query.status === 'Pending' ? [ticket('pending', 'order-soon', 'Pending')]
    : query.status === 'In Progress' ? [ticket('progress', 'order-soon', 'In Progress')]
      : completed
  return { items, pagination: { page: query.page ?? 1, perPage: query.perPage ?? 500 } }
})
assert.deepEqual(loaded.tickets.map(row => row.id), ['pending', 'progress', 'today'])
assert.equal(loaded.truncated, false)
assert.deepEqual(calls.map(call => call.status), ['Pending', 'In Progress', 'Completed'])
assert.equal(calls[2]?.sortBy, 'completedAt')
assert.equal(calls[2]?.sortOrder, 'desc')

const capCalls: Partial<JobTicketListQuery>[] = []
const capped = await loadDepartmentTickets('Washing', new Date('2026-09-23T03:00:00Z'), async query => {
  capCalls.push(query)
  const items = Array.from({ length: query.perPage ?? 500 }, (_, index) => ticket(`p${query.page}-${index}`, 'order-soon', 'Pending'))
  return { items, pagination: { page: query.page ?? 1, perPage: query.perPage ?? 500 } }
})
assert.equal(capped.tickets.length, MAX_DEPARTMENT_TICKETS)
assert.equal(capped.truncated, true)
assert.deepEqual(capCalls.map(call => call.page), [1, 2, 3, 4])
assert.ok(capCalls.every(call => call.status === 'Pending'))

const combinedCalls: Partial<JobTicketListQuery>[] = []
const combinedCap = await loadDepartmentTickets('Washing', new Date('2026-09-23T03:00:00Z'), async query => {
  combinedCalls.push(query)
  const length = query.status === 'Pending' && query.page === 4 ? 0 : query.perPage ?? 500
  const items = Array.from({ length }, (_, index) => ticket(`${query.status}-${query.page}-${index}`, 'order-soon', query.status!))
  return { items, pagination: { page: query.page ?? 1, perPage: query.perPage ?? 500 } }
})
assert.equal(combinedCap.tickets.length, MAX_DEPARTMENT_TICKETS)
assert.equal(combinedCap.truncated, true)
assert.deepEqual(combinedCalls.map(call => call.status), ['Pending', 'Pending', 'Pending', 'Pending', 'In Progress'])

console.log('department-work.dry-test: OK')
