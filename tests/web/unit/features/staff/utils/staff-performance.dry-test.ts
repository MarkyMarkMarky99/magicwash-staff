import assert from 'node:assert/strict'
import type { WorkTransactionDto } from '@/data/work-transactions/work-transaction.service'
import {
  averageWorkedDay,
  dailyMinutes,
  daysEndingAt,
  rankStaff,
  summarizeDay,
} from '@/features/staff/utils/staff-performance'

const row = (values: Partial<WorkTransactionDto>): WorkTransactionDto => ({
  id: 'id', jobTicketId: 'IRN-o-t', department: 'Ironing', type: 'EARN', minutes: 6,
  staffId: 'a', createdAt: '2026-10-04 09:00:00', createdBy: 'a', ...values,
})

assert.deepEqual(daysEndingAt('2026-10-04', 3), ['2026-10-02', '2026-10-03', '2026-10-04'])
assert.deepEqual(daysEndingAt('2026-03-01', 2), ['2026-02-28', '2026-03-01'])

const rows = [
  row({ id: '1' }),
  row({ id: '2', department: 'Packaging', jobTicketId: 'PCK-o-t', minutes: 1 }),
  row({ id: '3', minutes: 6, jobTicketId: 'IRN-o-u' }),
  row({ id: '4', type: 'VOID', minutes: -6, jobTicketId: 'IRN-o-u', createdBy: 'admin' }),
  row({ id: '5', department: null, jobTicketId: 'XYZ', minutes: 2 }),
  row({ id: '6', staffId: 'b', minutes: 30 }),
  row({ id: '7', createdAt: '2026-10-03 23:59:59', minutes: 12 }),
]

assert.deepEqual(summarizeDay(rows, 'a', '2026-10-04'), {
  minutes: 9,
  jobs: 3,
  byDepartment: [
    { department: 'Ironing', jobs: 1, minutes: 6 },
    { department: null, jobs: 1, minutes: 2 },
    { department: 'Packaging', jobs: 1, minutes: 1 },
  ],
})
assert.deepEqual(summarizeDay(rows, 'a', '2026-10-01'), { minutes: 0, jobs: 0, byDepartment: [] })

assert.deepEqual(dailyMinutes(rows, 'a', ['2026-10-03', '2026-10-04']), [12, 9])
assert.deepEqual(rankStaff(rows, ['2026-10-04']), [{ staffId: 'b', minutes: 30 }, { staffId: 'a', minutes: 9 }])
assert.deepEqual(rankStaff(rows, ['2026-10-01']), [])

assert.equal(averageWorkedDay([0, 10, 0, 20]), 15)
assert.equal(averageWorkedDay([0, 0]), 0)

console.log('staff performance dry test passed')
