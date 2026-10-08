import assert from 'node:assert/strict'
import type { JobTicketDto, JobTicketListQuery } from '@/data/job-tickets/job-ticket.service'
import { completedTodayFromPage, listJobTickets, loadDepartmentTickets, MAX_DEPARTMENT_TICKETS } from '@/data/job-tickets/job-ticket.service'
import { advanceSummary, completionPercentage, countDepartmentStatuses, filterTickets, groupDepartmentOrders, readDepartment, readGrouper, readStatusFilter, resolveScanTag, restoreScanQueue, sortDepartmentTickets, statusForFilter, taskLabel, ticketSelectLabel, toggleTicketSelection } from '@/features/job-tickets/department-work'
import { normalizeGarmentTagId } from '@/shared/utils/garment-tag-id'

function ticket(id: string, orderId: string, status: JobTicketDto['status'], completedAt: string | null = null): JobTicketDto {
  return {
    id, orderId, laundryItemId: id, scope: 'ITEM', taskCode: 'WSH-STANDARD', department: 'Washing', stepNo: 1,
    customerId: 'customer-1', orderName: null, dueDate: null, specialInstructions: null, notes: null,
    status, startedAt: null, completedAt, scannedBy: null, photoEvidenceUrl: null,
    createdAt: null, createdBy: null, updatedAt: null, updatedBy: null, deletedAt: null, deletedBy: null,
  }
}

assert.equal(readDepartment('washing')?.code, 'Washing')
assert.equal(readDepartment('drycleaning')?.code, 'DryCleaning')
assert.equal(readDepartment('ironing')?.code, 'Ironing')
assert.equal(readDepartment('packaging')?.code, 'Packaging')
assert.equal(readDepartment('logistics')?.code, 'Logistics')
assert.equal(readDepartment('__proto__'), null)
assert.equal(readStatusFilter('CANCELLED'), 'ALL')
assert.equal(readStatusFilter('IN PROGRESS'), 'IN PROGRESS')
assert.equal(readGrouper('item'), 'item')
assert.equal(readGrouper('unknown'), 'order')
assert.equal(statusForFilter('ALL'), null)
assert.equal(statusForFilter('PENDING'), 'Pending')
const selectionTicket = ticket('tag-a', 'order-1', 'Pending')
const selected = toggleTicketSelection(new Set<string>(), selectionTicket, 'Pending')
assert.deepEqual([...selected], ['tag-a'])
assert.deepEqual([...toggleTicketSelection(selected, selectionTicket, 'Pending')], [])
assert.deepEqual([...toggleTicketSelection(selected, selectionTicket, 'In Progress')], ['tag-a'])
assert.deepEqual([...toggleTicketSelection(new Set<string>(), { ...selectionTicket, laundryItemId: null }, 'Pending')], [])
const scanTickets = [selectionTicket, ticket('tag-b', 'order-1', 'Completed')]
assert.deepEqual(resolveScanTag('tag-a', scanTickets, 'Pending', [], 'Washing'), { entry: { ticketId: 'tag-a', orderId: 'order-1', tag: 'tag-a' }, message: 'Queued' })
assert.equal(resolveScanTag('tag-b', scanTickets, 'Pending', [], 'Washing').message, 'Not in this tab')
assert.equal(resolveScanTag('missing', scanTickets, 'Pending', [], 'Washing').message, 'No job for this tag')
assert.equal(resolveScanTag('tag-a', scanTickets, 'Pending', [{ ticketId: 'tag-a', orderId: 'order-1', tag: 'tag-a' }], 'Washing').message, 'Already queued')
assert.deepEqual(restoreScanQueue([{ ticketId: 'tag-a' }, { ticketId: 'tag-a' }, { ticketId: 'tag-b' }, { ticketId: 'missing' }], scanTickets, 'Pending', 'Washing'), [{ ticketId: 'tag-a', orderId: 'order-1', tag: 'tag-a' }])
const taskTickets = [
  { ...ticket('wash-b', 'order-1', 'Pending'), laundryItemId: 'tag-m', taskCode: 'WSH-B', stepNo: 2 },
  { ...ticket('wash-a', 'order-1', 'Pending'), laundryItemId: 'tag-m', taskCode: 'WSH-A', stepNo: 1 },
  { ...ticket('wash-done', 'order-1', 'Completed'), laundryItemId: 'tag-solo', taskCode: 'WSH-A', stepNo: 1 },
  { ...ticket('wash-solo', 'order-1', 'Pending'), laundryItemId: 'tag-solo', taskCode: 'WSH-B', stepNo: 2 },
  { ...ticket('wash-legacy', 'order-1', 'Pending'), laundryItemId: 'tag-legacy', taskCode: null },
]
assert.deepEqual(resolveScanTag('tag-m', taskTickets, 'Pending', [], 'Washing'), {
  message: '2 tasks for this tag (WSH-B, WSH-A). Select them from the list',
})
assert.deepEqual(resolveScanTag('tag-solo', taskTickets, 'Pending', [], 'Washing'), { entry: { ticketId: 'wash-solo', orderId: 'order-1', tag: 'tag-solo' }, message: 'Queued' })
assert.deepEqual(resolveScanTag('tag-solo', taskTickets, 'Pending', [{ ticketId: 'wash-solo', orderId: 'order-1', tag: 'tag-solo' }], 'Washing').message, 'Already queued')
assert.deepEqual(resolveScanTag('tag-legacy', taskTickets, 'Pending', [], 'Washing').entry?.ticketId, 'wash-legacy')
assert.deepEqual(resolveScanTag('tag-m', [taskTickets[0]!, { ...taskTickets[1]!, taskCode: null }], 'Pending', [], 'Washing'), {
  message: '2 tasks for this tag (WSH-B, no task). Select them from the list',
})
assert.deepEqual(restoreScanQueue([{ ticketId: 'wash-a' }, { ticketId: 'wash-legacy', orderId: 'order-9', tag: 'stale' }], taskTickets, 'Pending', 'Washing'), [
  { ticketId: 'wash-a', orderId: 'order-1', tag: 'tag-m' },
  { ticketId: 'wash-legacy', orderId: 'order-1', tag: 'tag-legacy' },
])
assert.deepEqual(restoreScanQueue([{ ticketId: 'WSH-order-1-tag-m' }], taskTickets, 'Pending', 'Washing'), [])
assert.equal(taskLabel(taskTickets[0]!), 'WSH-B')
assert.equal(taskLabel(taskTickets[4]!), null)
assert.equal(taskLabel({ taskCode: '  ' }), null)
assert.equal(ticketSelectLabel(taskTickets[0]!), 'Select tag tag-m, task WSH-B; current status Pending')
assert.equal(ticketSelectLabel(taskTickets[4]!), 'Select tag tag-legacy; current status Pending')
assert.equal(ticketSelectLabel({ ...taskTickets[4]!, laundryItemId: null, status: 'In Progress' }), 'Select tag missing; current status In Progress')
const taskOrderInfo = new Map([['order-1', { dueDate: '2026-09-24', customerId: 'customer-1', customerName: 'Task', customerIndex: 'TSK' }]])
assert.deepEqual(sortDepartmentTickets(taskTickets.slice(0, 2), taskOrderInfo).map(row => row.id), ['wash-a', 'wash-b'])
assert.deepEqual(sortDepartmentTickets([{ ...taskTickets[0]!, stepNo: 1 }, { ...taskTickets[1]!, stepNo: 1 }], taskOrderInfo).map(row => row.taskCode), ['WSH-A', 'WSH-B'])
for (const scoreFailed of [1, 3]) {
  assert.equal(advanceSummary({ kind: 'completed', advanced: [], blocked: [], skipped: [], scoreFailed }, 'In Progress'),
    `0 completed · 0 blocked · 0 skipped · Score not saved for ${scoreFailed} job${scoreFailed === 1 ? '' : 's'}. Tell an admin.`)
}
assert.equal(advanceSummary({ kind: 'completed', advanced: [{ ticketId: 'tag-a', laundryItemId: 'tag-a', status: 'In Progress', startedAt: null, completedAt: null }], blocked: [{ ticketId: 'tag-b', laundryItemId: null, blockedByDepartment: 'Washing' }], skipped: [{ ticketId: 'other', reason: 'not_found' }], scoreFailed: 0 }, 'Pending'), '1 started · 1 blocked by Washing · 1 skipped')

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
const boardTickets = filterTickets([...tickets, { ...ticket('weight', 'order-only', 'Completed'), scope: 'ORDER', laundryItemId: null }], 'ALL')
assert.deepEqual(boardTickets, tickets)
assert.deepEqual(countDepartmentStatuses(boardTickets), { ALL: 3, PENDING: 1, 'IN PROGRESS': 1, COMPLETED: 1 })
assert.equal(completionPercentage(boardTickets), 33)
assert.ok(!groupDepartmentOrders(boardTickets, orderInfo).some(order => order.orderId === 'order-only'))
const logisticsBag = { ...ticket('LOG-order-soon-bag-1-LOG-BAG', 'order-soon', 'Pending'), scope: 'ORDER' as const, department: 'Logistics' as const, taskCode: 'LOG-BAG', laundryItemId: null }
const logisticsDone = { ...logisticsBag, id: 'LOG-order-soon-bag-2-LOG-BAG', status: 'Completed' as const }
const logisticsRows = [...tickets, logisticsBag, logisticsDone,
  { ...logisticsBag, scope: 'ITEM' as const }, { ...logisticsBag, taskCode: 'OTHER' },
  { ...logisticsBag, deletedAt: '2026-10-08' }, { ...logisticsBag, department: 'Packaging' as const }]
assert.deepEqual(filterTickets(logisticsRows, 'ALL', 'Logistics'), [logisticsBag, logisticsDone])
assert.deepEqual(filterTickets(logisticsRows, 'PENDING', 'Logistics'), [logisticsBag])
assert.deepEqual(countDepartmentStatuses(filterTickets(logisticsRows, 'ALL', 'Logistics')), { ALL: 2, PENDING: 1, 'IN PROGRESS': 0, COMPLETED: 1 })
assert.equal(groupDepartmentOrders(filterTickets(logisticsRows, 'ALL', 'Logistics'), orderInfo)[0]?.percentage, 50)
for (const department of ['Washing', 'DryCleaning', 'Ironing', 'Packaging'] as const) {
  assert.deepEqual(filterTickets([...tickets, logisticsBag], 'ALL', department), tickets)
}
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
  const items = query.status === 'Pending' ? Array.from({ length: query.perPage ?? 500 }, (_, index) => ticket(`p${query.page}-${index}`, 'order-soon', 'Pending')) : []
  return { items, pagination: { page: query.page ?? 1, perPage: query.perPage ?? 500 } }
})
assert.equal(capped.tickets.length, MAX_DEPARTMENT_TICKETS)
assert.equal(capped.truncated, true)
assert.deepEqual(capCalls.filter(call => call.status === 'Pending').map(call => call.page), [1, 2, 3, 4])
assert.deepEqual(capCalls.slice(0, 3).map(call => call.status), ['Pending', 'In Progress', 'Completed'])

const combinedCalls: Partial<JobTicketListQuery>[] = []
const combinedCap = await loadDepartmentTickets('Washing', new Date('2026-09-23T03:00:00Z'), async query => {
  combinedCalls.push(query)
  const length = query.status === 'Pending' && query.page !== 4 ? query.perPage ?? 500
    : query.status === 'In Progress' && query.page === 1 ? query.perPage ?? 500 : 0
  const items = Array.from({ length }, (_, index) => ticket(`${query.status}-${query.page}-${index}`, 'order-soon', query.status!))
  return { items, pagination: { page: query.page ?? 1, perPage: query.perPage ?? 500 } }
})
assert.equal(combinedCap.tickets.length, MAX_DEPARTMENT_TICKETS)
assert.equal(combinedCap.truncated, true)
assert.deepEqual(combinedCap.tickets.map(row => row.status).filter((status, index, statuses) => index === 0 || status !== statuses[index - 1]), ['Pending', 'In Progress'])
assert.deepEqual(combinedCalls.slice(0, 3).map(call => call.status), ['Pending', 'In Progress', 'Completed'])

const parallelCalls: Partial<JobTicketListQuery>[] = []
const resolveFirstPages = new Map<JobTicketDto['status'], (items: JobTicketDto[]) => void>()
const parallelLoad = loadDepartmentTickets('Washing', new Date('2026-09-23T03:00:00Z'), async query => {
  parallelCalls.push(query)
  if (query.page === 1) {
    return await new Promise<Awaited<ReturnType<typeof listJobTickets>>>(resolve => {
      resolveFirstPages.set(query.status!, items => resolve({ items, pagination: { page: 1, perPage: query.perPage ?? 500 } }))
    })
  }
  const items = query.status === 'Pending' && query.page !== 4
    ? Array.from({ length: query.perPage ?? 500 }, (_, index) => ticket(`later-${query.page}-${index}`, 'order-soon', 'Pending')) : []
  return { items, pagination: { page: query.page ?? 1, perPage: query.perPage ?? 500 } }
})
assert.deepEqual(parallelCalls.map(call => call.status), ['Pending', 'In Progress', 'Completed'])
assert.equal(resolveFirstPages.size, 3)
resolveFirstPages.get('Completed')!([ticket('completed', 'order-soon', 'Completed', '2026-09-23T09:00:00+07:00')])
resolveFirstPages.get('In Progress')!(Array.from({ length: 500 }, (_, index) => ticket(`progress-${index}`, 'order-soon', 'In Progress')))
resolveFirstPages.get('Pending')!(Array.from({ length: 500 }, (_, index) => ticket(`pending-${index}`, 'order-soon', 'Pending')))
const parallelResult = await parallelLoad
assert.equal(parallelResult.tickets.length, MAX_DEPARTMENT_TICKETS)
assert.equal(parallelResult.truncated, true)
assert.equal(parallelResult.tickets[0]?.id, 'pending-0')
assert.equal(parallelResult.tickets[1499]?.id, 'later-3-499')
assert.equal(parallelResult.tickets[1500]?.id, 'progress-0')
assert.equal(parallelResult.tickets[1999]?.id, 'progress-499')
assert.ok(!parallelResult.tickets.some(row => row.status === 'Completed'))

console.log('department-work.dry-test: OK')
