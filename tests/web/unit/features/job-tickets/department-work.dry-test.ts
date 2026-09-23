import assert from 'node:assert/strict'
import type { JobTicketDto, JobTicketListQuery } from '@/data/job-tickets/job-ticket.service'
import { completedTodayFromPage, loadDepartmentTickets, MAX_DEPARTMENT_TICKETS } from '@/data/job-tickets/job-ticket.service'
import { completionPercentage, countDepartmentStatuses, filterTickets, groupDepartmentOrders, readDepartment, readGrouper, readStatusFilter, sortDepartmentTickets } from '@/features/job-tickets/department-work'

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
  ['order-late', { dueDate: '2026-10-02', customerId: 'customer-1', customerName: 'Late' }],
  ['order-soon', { dueDate: '2026-09-24', customerId: 'customer-2', customerName: 'Soon' }],
])
assert.deepEqual(sortDepartmentTickets(tickets, orderInfo).map(row => row.id), ['tag-b', 'tag-c', 'tag-a'])
assert.deepEqual(groupDepartmentOrders(tickets, orderInfo).map(order => order.orderId), ['order-soon', 'order-late'])
assert.deepEqual(groupDepartmentOrders(filterTickets(tickets, 'PENDING'), orderInfo).map(order => order.orderId), ['order-late'])
assert.deepEqual(sortDepartmentTickets(filterTickets(tickets, 'PENDING'), orderInfo).map(row => row.id), ['tag-a'])
assert.equal(groupDepartmentOrders(tickets, orderInfo)[0]?.percentage, 50)
assert.equal(completionPercentage([]), 0)
assert.equal(completionPercentage(tickets), 33)
assert.deepEqual(countDepartmentStatuses(tickets), { ALL: 3, PENDING: 1, 'IN PROGRESS': 1, COMPLETED: 1 })

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
