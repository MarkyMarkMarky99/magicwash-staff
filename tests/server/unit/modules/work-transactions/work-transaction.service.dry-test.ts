import assert from 'node:assert/strict'
import { WorkTransactionService } from '../../../../../server/modules/work-transactions/work-transaction.service.js'
import { ApiError } from '../../../../../server/shared/http/api-error.js'

let reads = 0
const service = new WorkTransactionService(() => ({
  async read() {
    reads += 1
    return [
      { id: 'e1', job_ticket_id: 'IRN-o1-tag1', type: 'EARN', minutes: 6, created_at: 'Date(2026,9,4,9,15,0)', created_by: 'staff-a' },
      { id: 'e2', job_ticket_id: 'WSH-o1-tag1', type: 'EARN', minutes: 2, created_at: '2026-10-03 18:00:00', created_by: 'staff-b' },
      { id: 'v1', job_ticket_id: 'WSH-o1-tag1', type: 'VOID', minutes: -2, created_at: '2026-10-04 10:00:00', created_by: 'admin-1' },
      { id: 'old', job_ticket_id: 'PCK-o1-tag1', type: 'EARN', minutes: 1, created_at: '2026-09-01 08:00:00', created_by: 'staff-a' },
      { id: 12345678 as unknown as string, job_ticket_id: 'XYZ-o2-tag2', type: 'EARN', minutes: '3' as unknown as number, created_at: '2026-10-04 11:00:00', created_by: 'staff-c' },
      { id: 'bad', job_ticket_id: 'IRN-o3-tag3', type: 'BONUS' as never, minutes: 9, created_at: '2026-10-04 11:00:00', created_by: 'staff-a' },
      { id: 'blank', job_ticket_id: '', type: 'EARN', minutes: 9, created_at: '2026-10-04 11:00:00', created_by: 'staff-a' },
    ]
  },
}))

const items = await service.list({ from: '2026-10-03', to: '2026-10-04' })
assert.equal(reads, 1)
assert.deepEqual(items, [
  { id: 'e1', jobTicketId: 'IRN-o1-tag1', department: 'Ironing', type: 'EARN', minutes: 6, staffId: 'staff-a', createdAt: '2026-10-04 09:15:00', createdBy: 'staff-a' },
  { id: 'e2', jobTicketId: 'WSH-o1-tag1', department: 'Washing', type: 'EARN', minutes: 2, staffId: 'staff-b', createdAt: '2026-10-03 18:00:00', createdBy: 'staff-b' },
  { id: 'v1', jobTicketId: 'WSH-o1-tag1', department: 'Washing', type: 'VOID', minutes: -2, staffId: 'staff-b', createdAt: '2026-10-04 10:00:00', createdBy: 'admin-1' },
  { id: '12345678', jobTicketId: 'XYZ-o2-tag2', department: null, type: 'EARN', minutes: 3, staffId: 'staff-c', createdAt: '2026-10-04 11:00:00', createdBy: 'staff-c' },
])

for (const query of [{}, { from: '2026-10-05', to: '2026-10-04' }, { from: '2026-08-01', to: '2026-10-04' }, { from: 'x', to: '2026-10-04' }]) {
  await assert.rejects(service.list(query), (error) => error instanceof ApiError)
}
assert.equal(reads, 1, 'an invalid query must not read the sheet')

console.log('work-transaction service dry test passed')
