import assert from 'node:assert/strict'
import { buildEarnRows } from '../../../../../server/modules/work-transactions/work-transaction-earn.js'

const ticket = { id: 'TAG-order-tag', department: 'Tagging' as const, status: 'Completed' as const, work_minutes: 3, scanned_by: 'tagger-1' }
const rows = buildEarnRows([ticket, { ...ticket, id: 'TAG-order-zero', work_minutes: 0 }])
assert.equal(rows.length, 2)
assert.match(rows[0]!.id, /^[a-z0-9]{8}$/)
assert.notEqual(rows[0]!.id, rows[1]!.id)
assert.deepEqual(rows[0], { id: rows[0]!.id, job_ticket_id: ticket.id, type: 'EARN', minutes: 3, notes: null, created_by: 'tagger-1' })
assert.equal(rows[1]!.minutes, 0)
for (const invalid of [
  { ...ticket, department: 'Washing' as const },
  { ...ticket, status: 'Pending' as const },
  { ...ticket, status: 'In Progress' as const },
  { ...ticket, work_minutes: null },
  { ...ticket, work_minutes: undefined },
  { ...ticket, work_minutes: NaN },
  { ...ticket, work_minutes: Infinity },
  { ...ticket, work_minutes: -Infinity },
  { ...ticket, scanned_by: null },
  { ...ticket, scanned_by: '' },
  { ...ticket, scanned_by: '  ' },
]) {
  assert.deepEqual(buildEarnRows([invalid]), [])
}
assert.deepEqual(buildEarnRows([]), [])
assert.equal(ticket.work_minutes, 3)
assert.equal(ticket.scanned_by, 'tagger-1')
console.log('work-transaction EARN dry test passed')
