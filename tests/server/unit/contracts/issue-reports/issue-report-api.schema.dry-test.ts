import assert from 'node:assert/strict'
import {
  issueReportApiContract,
  issueReportListQuerySchema,
  issueReportListResponseSchema,
  issueReportStatusSchema,
} from '../../../../../contracts/issue-reports/issue-report-api.schema.js'

const RESPONSE_FIELDS = [
  'issueReportId',
  'title',
  'description',
  'status',
  'screenshotUrl',
  'createdAt',
  'createdBy',
  'updatedAt',
  'updatedBy',
] as const

assert.deepEqual(issueReportStatusSchema.options, ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
assert.deepEqual(Object.keys(issueReportApiContract), ['query', 'request', 'response'])
assert.deepEqual(Object.keys(issueReportApiContract.query), ['list'])
assert.deepEqual(Object.keys(issueReportApiContract.request ?? {}), ['create', 'update'])
assert.deepEqual(Object.keys(issueReportApiContract.response), ['list', 'detail', 'create', 'update'])
assert.equal(issueReportApiContract.query.list, issueReportListQuerySchema)
assert.equal(issueReportApiContract.response.list, issueReportListResponseSchema)
assert.equal(issueReportApiContract.response.detail, issueReportListResponseSchema)
assert.equal(issueReportApiContract.response.create, issueReportListResponseSchema)
assert.equal(issueReportApiContract.response.update, issueReportListResponseSchema)

const defaults = issueReportListQuerySchema.parse({})
assert.deepEqual(defaults, {
  keyword: '', status: null, page: 1, perPage: 500, sortBy: 'createdAt', sortOrder: 'desc',
})
for (const input of [{ page: 0 }, { perPage: 501 }, { perPage: 1.5 }, { sortBy: 'title' }]) {
  assert.throws(() => issueReportListQuerySchema.parse(input), JSON.stringify(input))
}

const createSchema = issueReportApiContract.request?.create
const updateSchema = issueReportApiContract.request?.update
assert.ok(createSchema)
assert.ok(updateSchema)

assert.deepEqual(
  createSchema.parse({
    title: '  Broken dryer  ', description: '  Stops after five minutes  ', screenshotUrl: '  proof  ', createdBy: '  staff-1  ',
  }),
  { title: 'Broken dryer', description: 'Stops after five minutes', screenshotUrl: 'proof', createdBy: 'staff-1' },
)
assert.deepEqual(
  createSchema.parse({ title: 'Title', description: 'Description', createdBy: 'staff-1', status: 'CLOSED', issueReportId: 'ISS-deadbeef' }),
  { title: 'Title', description: 'Description', createdBy: 'staff-1' },
)
for (const input of [
  { title: '', description: 'Description', createdBy: 'staff-1' },
  { title: 'Title', description: ' ', createdBy: 'staff-1' },
  { title: 'Title', description: 'Description', createdBy: '' },
]) {
  assert.throws(() => createSchema.parse(input), JSON.stringify(input))
}

assert.deepEqual(
  updateSchema.parse({ status: 'RESOLVED', screenshotUrl: null, updatedBy: '  staff-2  ', updatedAt: 'client time', createdBy: 'client' }),
  { status: 'RESOLVED', screenshotUrl: null, updatedBy: 'staff-2' },
)
assert.deepEqual(updateSchema.parse({ title: '  Fixed  ', updatedBy: 'staff-2' }), { title: 'Fixed', updatedBy: 'staff-2' })
assert.throws(() => updateSchema.parse({ updatedBy: 'staff-2' }))
assert.throws(() => updateSchema.parse({ status: 'OPEN' }))

const dto = {
  issueReportId: 'ISS-3f8a1c92', title: 'Broken dryer', description: 'Stops after five minutes',
  status: 'OPEN', screenshotUrl: null, createdAt: '2026-08-26 10:30:00', createdBy: 'staff-1', updatedAt: null, updatedBy: null,
}
assert.deepEqual(issueReportListResponseSchema.parse(dto), dto)
assert.deepEqual(Object.keys(issueReportListResponseSchema.parse(dto)), RESPONSE_FIELDS)
assert.throws(() => issueReportListResponseSchema.parse({ ...dto, status: 'PENDING' }))

console.log('issue-report-api.schema.dry-test: OK')
