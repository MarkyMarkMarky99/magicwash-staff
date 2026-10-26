import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useJobTicketStore } from '@/data/job-tickets/job-ticket.store'
import type { JobTicketDto } from '@/data/job-tickets/job-ticket.service'
import { advanceSummary, completionPercentage, countDepartmentStatuses, filterTickets, groupDepartmentOrders, presentGunScan, readDepartment, readGrouper, readStatusFilter, recordScan, resolveScanTag, restoreScanQueue, sortDepartmentTickets, sortOrdersByScan, sortScannedFirst, statusForFilter, taskLabel, ticketSelectLabel, toggleTicketSelection } from '@/features/job-tickets/department-work'
import { presentScanPopup } from '@/features/job-tickets/scan-result'
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
assert.deepEqual(resolveScanTag('tag-a', scanTickets, 'Pending', [], 'Washing'), { entry: { ticketId: 'tag-a', orderId: 'order-1', tag: 'tag-a' }, ticket: selectionTicket, message: 'Queued' })
assert.equal(resolveScanTag('tag-b', scanTickets, 'Pending', [], 'Washing').message, 'Not in this tab')
assert.equal(resolveScanTag('tag-b', scanTickets, 'Pending', [], 'Washing').ticket, scanTickets[1])
assert.equal(resolveScanTag('missing', scanTickets, 'Pending', [], 'Washing').message, 'No job for this tag')
assert.equal(resolveScanTag('missing', scanTickets, 'Pending', [], 'Washing').ticket, undefined)
const queuedScan = resolveScanTag('tag-a', scanTickets, 'Pending', [{ ticketId: 'tag-a', orderId: 'order-1', tag: 'tag-a' }], 'Washing')
assert.equal(queuedScan.message, 'Already queued')
assert.equal(queuedScan.ticket, selectionTicket)
assert.deepEqual(restoreScanQueue([{ ticketId: 'tag-a' }, { ticketId: 'tag-a' }, { ticketId: 'tag-b' }, { ticketId: 'missing' }], scanTickets, 'Pending', 'Washing'), [{ ticketId: 'tag-a', orderId: 'order-1', tag: 'tag-a' }])
const taskTickets = [
  { ...ticket('wash-b', 'order-1', 'Pending'), laundryItemId: 'tag-m', taskCode: 'WSH-B', stepNo: 2 },
  { ...ticket('wash-a', 'order-1', 'Pending'), laundryItemId: 'tag-m', taskCode: 'WSH-A', stepNo: 1 },
  { ...ticket('wash-done', 'order-1', 'Completed'), laundryItemId: 'tag-solo', taskCode: 'WSH-A', stepNo: 1 },
  { ...ticket('wash-solo', 'order-1', 'Pending'), laundryItemId: 'tag-solo', taskCode: 'WSH-B', stepNo: 2 },
  { ...ticket('wash-legacy', 'order-1', 'Pending'), laundryItemId: 'tag-legacy', taskCode: null },
]
for (const tag of ['tag-m', 'tag-solo', 'tag-legacy', 'unknown']) {
  for (const status of ['Pending', 'In Progress'] as const) {
    for (const queue of [[], [{ ticketId: 'wash-solo', orderId: 'order-1', tag: 'tag-solo' }]]) {
      assert.deepEqual(resolveScanTag(`MWG-${tag}`, taskTickets, status, queue, 'Washing'), resolveScanTag(tag, taskTickets, status, queue, 'Washing'))
      assert.deepEqual(resolveScanTag(`mwg-${tag}`, taskTickets, status, queue, 'Washing'), resolveScanTag(tag, taskTickets, status, queue, 'Washing'))
    }
  }
}

assert.deepEqual(resolveScanTag('tag-m', taskTickets, 'Pending', [], 'Washing'), {
  ticket: taskTickets[0],
  message: '2 tasks for this tag (WSH-B, WSH-A). Select them from the list',
})
assert.deepEqual(resolveScanTag('tag-solo', taskTickets, 'Pending', [], 'Washing'), { entry: { ticketId: 'wash-solo', orderId: 'order-1', tag: 'tag-solo' }, ticket: taskTickets[3], message: 'Queued' })
assert.deepEqual(resolveScanTag('tag-solo', taskTickets, 'Pending', [{ ticketId: 'wash-solo', orderId: 'order-1', tag: 'tag-solo' }], 'Washing').message, 'Already queued')
assert.deepEqual(resolveScanTag('tag-legacy', taskTickets, 'Pending', [], 'Washing').entry?.ticketId, 'wash-legacy')
assert.deepEqual(resolveScanTag('tag-m', [taskTickets[0]!, { ...taskTickets[1]!, taskCode: null }], 'Pending', [], 'Washing'), {
  ticket: taskTickets[0],
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
const photoTicket = { ...ticket('tag-p', 'order-1', 'Pending'), photoEvidenceUrl: 'https://example.test/p.jpg' }
assert.deepEqual(presentGunScan('tag-p', photoTicket, { customerName: 'Task', customerIndex: 'C-07' }, 'Queued', 'success'), { title: 'tag-p', customerName: 'Task', message: 'Queued', tone: 'success', scan: { customerIndex: 'C-07', photoUrl: 'https://example.test/p.jpg', matched: true } })
assert.deepEqual(presentGunScan('zzz', undefined, undefined, 'No job for this tag', 'error'), { title: 'zzz', message: 'No job for this tag', tone: 'error', scan: { customerIndex: null, photoUrl: null, matched: false } })
assert.deepEqual(presentScanPopup({ title: 'x', message: 'm', tone: 'warning', matched: true, itemName: 'Shirt', photoUrl: null }), { title: 'x', customerName: undefined, message: 'm', tone: 'warning', scan: { customerIndex: null, photoUrl: null, matched: true, itemName: 'Shirt' } })
assert.deepEqual(presentScanPopup({ title: 'x', message: 'm', tone: 'error', matched: false, unmatchedText: '' }), { title: 'x', message: 'm', tone: 'error', scan: { customerIndex: null, photoUrl: null, matched: false, unmatchedText: '' } })
assert.deepEqual(recordScan(['a', 'b'], 'c'), ['a', 'b', 'c'])
assert.deepEqual(recordScan(['a', 'b', 'c'], 'a'), ['b', 'c', 'a'])
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
const scanRows = ['s1', 's2', 's3', 's4'].map((id, index) => ({ ...ticket(id, index < 2 ? 'order-soon' : 'order-late', 'Pending'), laundryItemId: id }))
const scanBase = sortDepartmentTickets(scanRows, orderInfo)
assert.deepEqual(scanBase.map(row => row.id), ['s1', 's2', 's3', 's4'])
assert.deepEqual(sortScannedFirst(scanBase, []).map(row => row.id), ['s1', 's2', 's3', 's4'])
assert.deepEqual(sortScannedFirst(scanBase, ['s3', 's2']).map(row => row.id), ['s2', 's3', 's1', 's4'])
assert.deepEqual(sortScannedFirst(scanBase, ['s3', 's2', 'gone']).map(row => row.id), ['s2', 's3', 's1', 's4'])
const scanOrders = groupDepartmentOrders(scanBase, orderInfo)
assert.deepEqual(sortOrdersByScan(scanOrders, []).map(order => order.orderId), ['order-soon', 'order-late'])
assert.deepEqual(sortOrdersByScan(scanOrders, ['s2', 's4']).map(order => order.orderId), ['order-late', 'order-soon'])
assert.deepEqual(sortOrdersByScan(scanOrders, ['s4', 's2']).map(order => order.orderId), ['order-soon', 'order-late'])
assert.deepEqual(sortOrdersByScan(scanOrders, ['s2', 's1']).map(order => order.tickets.map(row => row.id)), [['s1', 's2'], ['s3', 's4']])
assert.deepEqual(sortOrdersByScan(scanOrders, ['s1', 's2']).map(order => order.tickets.map(row => row.id)), [['s2', 's1'], ['s3', 's4']])
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
globalThis.fetch = (async input => {
  assert.equal(String(input), '/api/job-tickets/department-work?department=Washing')
  return new Response(JSON.stringify({
  success: true,
  data: [
    { ...ticket('numeric-full', 'order-soon', 'Pending'), laundryItemId: 18806075 },
    { ...ticket('alpha', 'order-late', 'Pending'), laundryItemId: 'Ab12Cd34' },
    { ...ticket('numeric-short', 'order-soon', 'In Progress'), laundryItemId: 9305753 },
    { ...ticket('missing', 'order-soon', 'Completed'), laundryItemId: null, completedAt: '2099-01-01 10:00:00' },
  ],
}), { status: 200, headers: { 'Content-Type': 'application/json' } })
}) as typeof fetch

let productionTickets: JobTicketDto[]
try {
  setActivePinia(createPinia())
  const store = useJobTicketStore()
  await store.loadDepartment('Washing')
  productionTickets = store.tickets
  store.$dispose()
} finally {
  globalThis.fetch = originalFetch
}
assert.deepEqual(productionTickets.map(row => row.laundryItemId), ['18806075', 'Ab12Cd34', '09305753', null])
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

console.log('department-work.dry-test: OK')
