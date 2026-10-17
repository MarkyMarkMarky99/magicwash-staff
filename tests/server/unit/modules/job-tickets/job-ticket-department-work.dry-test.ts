import assert from 'node:assert/strict'
import type { z } from 'zod'
import { jobTicketResponseSchema } from '../../../../../contracts/job-tickets/job-ticket-api.schema.js'
import { JobTicketDepartmentWorkService, selectDepartmentWork } from '../../../../../server/modules/job-tickets/job-ticket-department-work.service.js'
import { jobTicketsRowSchema } from '../../../../../server/sheets/JobTickets/JobTickets.db-contract.js'
import { deriveGVizColumns, GVizQueryBuilder } from '../../../../../server/shared/repositories/utils/gviz-query.builder.js'

type JobTicketDbRow = z.infer<typeof jobTicketsRowSchema>
const today = '2026-10-17'
const pending: Partial<JobTicketDbRow> = { id: 'pending', order_id: 'open', status: 'Pending', deleted_at: null }
const older: Partial<JobTicketDbRow> = { id: 'older', order_id: 'open', status: 'Completed', completed_at: '2026-10-16 10:00:00', deleted_at: '' }
assert.deepEqual(selectDepartmentWork([older, pending], today), [older, pending])
assert.deepEqual(selectDepartmentWork([older], today), [])
assert.deepEqual(selectDepartmentWork([{ ...pending, status: 'In Progress' }, older], today), [{ ...pending, status: 'In Progress' }, older])

for (const completed_at of ['Date(2026,9,17,10,0,0)', '2026-10-17 10:00:00', '2026-10-18 10:00:00']) {
  const completed: Partial<JobTicketDbRow> = { ...older, completed_at }
  assert.deepEqual(selectDepartmentWork([completed], today), [completed])
}
assert.deepEqual(selectDepartmentWork([{ ...older, completed_at: null }], today), [])
const cancelled: Partial<JobTicketDbRow> = { ...pending, id: 'cancelled', status: 'Cancelled', completed_at: '2026-10-17 10:00:00' }
assert.deepEqual(selectDepartmentWork([cancelled, older], today), [])
assert.deepEqual(selectDepartmentWork([cancelled, pending, older], today), [pending, older])
assert.deepEqual(selectDepartmentWork([{ ...pending, deleted_at: '2026-10-17' }, older], today), [])
assert.deepEqual(selectDepartmentWork([pending, { ...older, deleted_at: '2026-10-17' }], today), [pending])
assert.deepEqual(selectDepartmentWork([{ ...pending, deleted_at: '' }, older], today), [{ ...pending, deleted_at: '' }, older])
assert.deepEqual(selectDepartmentWork([{ ...pending, deleted_at: undefined }, older], today), [{ ...pending, deleted_at: undefined }, older])

// GViz may return a number even though the persisted identifier contract is a string.
const numeric = { ...pending, order_id: 123 } as unknown as Partial<JobTicketDbRow>
const twin = { ...older, order_id: '123' }
assert.deepEqual(selectDepartmentWork([twin, numeric], today), [twin, numeric])
assert.deepEqual(selectDepartmentWork([{ ...older, order_id: undefined }, { ...pending, order_id: undefined }], today).length, 2)
const regression = Array.from({ length: 74 }, (_, index) => index < 71
  ? { ...pending, id: `ticket-${index}` } : { ...older, id: `ticket-${index}` })
assert.equal(selectDepartmentWork(regression, today).length, 74)

let reads = 0
let builders = 0
const source = { ...pending, department: 'Washing' as const, laundry_item_id: '09305753', work_minutes: 4, unexpected: 'hidden' }
const columns = deriveGVizColumns(jobTicketsRowSchema)
const service = new JobTicketDepartmentWorkService({
  repository: () => ({
    queryBuilder: () => {
      builders += 1
      return GVizQueryBuilder.fromColumns(columns)
    },
    readRaw: async query => {
      reads += 1
      assert.equal(query, `select * where ${columns.department} = 'Washing'`)
      assert.ok(!/limit|offset|join/i.test(query))
      return [source, older, { ...older, order_id: 'finished' }]
    },
  }),
  now: () => new Date('2026-10-16T18:00:00Z'),
})
const response = await service.list({ department: 'Washing', id: 'department-work' })
assert.equal(reads, 1)
assert.equal(builders, 1)
assert.deepEqual(response.map(row => row.id), ['pending', 'older'])
assert.deepEqual(Object.keys(response[0]), Object.keys(jobTicketResponseSchema.shape))
assert.equal(response[0].orderId, 'open')
assert.equal(response[0].laundryItemId, '09305753')
assert.equal(response[0].workMinutes, 4)
assert.ok(!('unexpected' in response[0]))
await assert.rejects(service.list({ department: 'washing' }), { status: 422 })
assert.equal(reads, 1, 'invalid query never reaches the repository')

const bangkokService = new JobTicketDepartmentWorkService({
  repository: () => ({ queryBuilder: () => GVizQueryBuilder.fromColumns(columns), readRaw: async () => [older] }),
  now: () => new Date('2026-10-16T18:00:00Z'),
})
assert.deepEqual(await bangkokService.list({ department: 'Washing' }), [], 'today uses the Bangkok day')
console.log('job-ticket-department-work.dry-test: OK (selection, 74-ticket regression, one query, projection, validation, Bangkok date)')
