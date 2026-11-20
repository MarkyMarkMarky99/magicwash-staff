import assert from 'node:assert/strict'
import type { StockTakePreview, StockTakeReport, StockTakeSession } from '@/data/stock-takes/stock-take.service'
import {
  accountedSummary, canConfirmGap, codeLabel, conflictAction, errorText, lastTicketLabel, linkConfirmation, logisticsHint,
  missingResolution, planTotals, sessionActions, taskPick,
} from '@/features/stock-take/stock-take-report'

function session(status: StockTakeSession['status']): StockTakeSession {
  return { id: 'ST-1', status, openedAt: '2026-11-19 09:00:00', openedBy: 'staff-1', closedAt: null, closedBy: null, appliedAt: null, appliedBy: null, notes: null }
}

assert.equal(codeLabel('multiple_zones'), 'Scanned in more than one zone')
assert.equal(codeLabel('some_new_code'), 'some new code')

assert.equal(lastTicketLabel(null), 'No ticket')
assert.equal(lastTicketLabel({ id: 'T-1', department: 'Washing', taskCode: 'WSH-STANDARD', stepNo: 2, status: 'In Progress' }), 'Washing · WSH-STANDARD · step 2 · In Progress')
assert.equal(lastTicketLabel({ id: 'T-1', department: 'Washing', taskCode: null, stepNo: 1, status: 'Pending' }), 'Washing · step 1 · Pending')
assert.equal(logisticsHint([]), null)
assert.equal(logisticsHint([{ bagId: 'B1', status: 'Pending' }, { bagId: 'B2', status: null }]), 'Bag B1: Pending · Bag B2: no ticket')

assert.deepEqual(missingResolution('ORD-1', 'AB12cd34', 'LOST', ' ignored '), { resolution: { orderId: 'ORD-1', tag: 'AB12cd34', resolution: 'LOST', reason: null } })
assert.deepEqual(missingResolution('ORD-1', 'AB12cd34', 'RETURNED', '  Mali, 12 Nov  '), { resolution: { orderId: 'ORD-1', tag: 'AB12cd34', resolution: 'RETURNED', reason: 'Mali, 12 Nov' } })
assert.ok('error' in missingResolution('ORD-1', 'AB12cd34', 'OFF_SITE', '   '))
assert.ok('error' in missingResolution('ORD-1', 'AB12cd34', 'RETURNED', '=SUM(1)'))
assert.deepEqual(linkConfirmation('ORD-1', 'AB12cd34'), { orderId: 'ORD-1', tag: 'AB12cd34', resolution: 'LINK_CONFIRMED' })
assert.deepEqual(taskPick('ORD-1', 'AB12cd34', 'T-9'), { orderId: 'ORD-1', tag: 'AB12cd34', resolution: 'TASK_PICK', jobTicketId: 'T-9' })

assert.equal(canConfirmGap({ orderId: 'ORD-1', tag: 'AB12cd34', code: 'ticket_without_link', confirmed: false }), true)
assert.equal(canConfirmGap({ orderId: 'ORD-1', tag: 'AB12cd34', code: 'one_membership_source', confirmed: false }), true)
assert.equal(canConfirmGap({ orderId: 'ORD-1', tag: 'AB12cd34', code: 'ticket_without_link', confirmed: true }), false)
assert.equal(canConfirmGap({ orderId: 'ORD-1', tag: 'AB12cd34', code: 'missing_registration', confirmed: false }), false)
assert.equal(canConfirmGap({ orderId: 'ORD-1', tag: null, code: 'empty_order', confirmed: false }), false)

assert.equal(conflictAction({ orderId: 'ORD-1', tag: 'AB12cd34', code: 'multiple_order_claims', ticketIds: [] }), 'link')
assert.equal(conflictAction({ orderId: 'ORD-1', tag: 'AB12cd34', code: 'multiple_tasks', ticketIds: ['T-1', 'T-2'] }), 'task')
assert.equal(conflictAction({ orderId: 'ORD-1', tag: 'AB12cd34', code: 'multiple_tasks', ticketIds: [] }), null)
assert.equal(conflictAction({ orderId: null, tag: 'AB12cd34', code: 'multiple_zones', ticketIds: [] }), null)

assert.deepEqual(sessionActions(null), { canCancel: false, canResolve: false, canFinish: false })
assert.deepEqual(sessionActions(session('OPEN')), { canCancel: true, canResolve: false, canFinish: true })
assert.deepEqual(sessionActions(session('CLOSED')), { canCancel: true, canResolve: true, canFinish: true })
assert.deepEqual(sessionActions(session('APPLIED')), { canCancel: false, canResolve: false, canFinish: false })
assert.equal(sessionActions(session('CANCELLED')).canCancel, false)

const planned: StockTakePreview['planned'] = [
  { orderId: 'ORD-1', tag: 'AB12cd34', ticketCount: 3, changeCount: 2 },
  { orderId: 'ORD-2', tag: 'CD34ef56', ticketCount: 2, changeCount: 0 },
]
assert.deepEqual(planTotals(planned), { garments: 2, tickets: 5, changes: 2 })
assert.deepEqual(planTotals([]), { garments: 0, tickets: 0, changes: 0 })

const report = { orders: [{ accounted: true }, { accounted: false }, { accounted: true }] } as unknown as StockTakeReport
assert.deepEqual(accountedSummary(report), { orders: 3, accounted: 2 })

assert.equal(errorText(new Error('Finish the stock-take after applying corrections.')), 'Finish the stock-take after applying corrections.')
assert.equal(errorText('x'), 'Something went wrong. Try again')

console.log('stock-take-report.dry-test: OK')
