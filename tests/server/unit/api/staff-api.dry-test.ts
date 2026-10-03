import assert from 'node:assert/strict'
import type { VercelRequest } from '@vercel/node'
import { ApiGateway } from '../../../../server/shared/http/api-gateway.js'
import { ApiError } from '../../../../server/shared/http/api-error.js'
import { StaffService } from '../../../../server/modules/staff/staff.service.js'
import { SheetsApiClient, type SheetsApiValue } from '../../../../server/shared/repositories/sheets-api.client.js'
import { registerStaffBodySchema, staffSchema, updateStaffBodySchema } from '../../../../contracts/staff/staff-api.schema.js'

const previousSpreadsheetId = process.env.STAFF_SPREADSHEET_ID
process.env.STAFF_SPREADSHEET_ID = 'test-staff'
const { createStaffRoutes } = await import('../../../../server/modules/staff/staff.module.js')
if (previousSpreadsheetId === undefined) delete process.env.STAFF_SPREADSHEET_ID
else process.env.STAFF_SPREADSHEET_ID = previousSpreadsheetId

const header = ['Email', 'Name', 'Role', 'Active', 'StaffId', 'Phone', 'Address', 'Position', 'StartDate']
const rows: SheetsApiValue[][] = [
  ['OWNER@EXAMPLE.COM', 'Owner', 'admin', true, '', '0800000000', '', '', 46023],
  ['worker@example.com', 'Worker', 'staff', true, 'worker-id', 812345678, 'Home', 'Washing', '2026-01-01'],
  ['', 'Absent', 'admin', true, 'absent-id'],
  ['admin@example.com', 'Admin', 'admin', true, 'admin-id', '', '', '', ''],
  ['inactive@example.com', 'Inactive', 'staff', false, 'inactive-id', '', '', '', 'not-a-date'],
]
const writes: { url: string; body: Record<string, unknown> }[] = []
const fetchImpl: typeof fetch = async (input, init) => {
  const url = new URL(String(input))
  assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-access-token')
  if (!init?.method || init.method === 'GET') {
    assert.equal(url.searchParams.get('valueRenderOption'), 'UNFORMATTED_VALUE')
    const range = decodeURIComponent(url.pathname.split('/values/')[1]!)
    return Response.json({ values: range.endsWith('!1:1') ? [header] : rows })
  }
  const body = JSON.parse(String(init.body)) as Record<string, unknown>
  writes.push({ url: url.toString(), body })
  if (url.pathname.endsWith(':append')) {
    const values = body.values as SheetsApiValue[][]
    rows.push(values[0]!)
    return Response.json({ updates: {
      updatedRows: 1, updatedRange: `Staff!A${rows.length + 1}:I${rows.length + 1}`,
      updatedData: { values },
    } })
  }
  const data = body.data as { range: string; values: SheetsApiValue[][] }[]
  for (const change of data) {
    const match = /^Staff!([A-Z]+)(\d+)$/.exec(change.range)!
    const column = match[1]!.charCodeAt(0) - 65
    rows[Number(match[2]) - 2]![column] = change.values[0]![0]!
  }
  return Response.json({ responses: data.map(() => ({})) })
}
const service = new StaffService(new SheetsApiClient({
  spreadsheetId: 'test-staff', sheetName: 'Staff', fetchImpl,
  accessTokenProvider: async () => 'test-access-token',
}))
const routes = createStaffRoutes(service)
const gateway = new ApiGateway({ staff: async () => routes }, async () => {
  throw new Error('Staff requests must use identity authentication')
}, async (req) => {
  const token = req.headers.authorization
  if (typeof token !== 'string' || token === 'Bearer bad') throw ApiError.unauthorized()
  const email = token.slice('Bearer '.length).trim().toLowerCase()
  const listed = rows.find((row) => String(row[0]).toLowerCase() === email && row[3] === true)
  const role = listed?.[2]
  return { email, staff: role === 'admin' || role === 'staff' ? { staffId: String(listed![4] ?? '').trim(), email, name: String(listed![1]), role } : undefined }
})
const call = (method: string, path: string, email?: string, body?: unknown) => gateway.handleRequest({
  method, url: path, query: {}, headers: email ? { authorization: `Bearer ${email}` } : {}, body,
} as VercelRequest)
const data = (result: { body: unknown }) => (result.body as { data: unknown }).data

const previousProjectId = process.env.FIREBASE_PROJECT_ID
process.env.FIREBASE_PROJECT_ID = 'staff-test-project'
try {
  const realIdentityGateway = new ApiGateway({ staff: async () => routes }, async () => {
    throw new Error('Staff requests must not require the allowlist authenticator')
  })
  assert.equal((await realIdentityGateway.handleRequest({
    method: 'GET', url: '/api/staff', query: {}, headers: {},
  } as VercelRequest)).status, 200)
  assert.equal((await realIdentityGateway.handleRequest({
    method: 'GET', url: '/api/staff', query: {}, headers: { authorization: 'Bearer bad' },
  } as VercelRequest)).status, 401)
  for (const authorization of [undefined, 'Bearer bad']) {
    assert.equal((await realIdentityGateway.handleRequest({
      method: 'GET', url: '/api/staff/me', query: {},
      headers: authorization ? { authorization } : {},
    } as VercelRequest)).status, 401)
  }
} finally {
  if (previousProjectId === undefined) delete process.env.FIREBASE_PROJECT_ID
  else process.env.FIREBASE_PROJECT_ID = previousProjectId
}

for (const [method, path] of [
  ['GET', '/api/staff/me'], ['POST', '/api/staff'],
  ['GET', '/api/staff/worker-id'], ['PATCH', '/api/staff/worker-id'],
]) {
  assert.equal((await call(method!, path!)).status, 401)
  assert.equal((await call(method!, path!, 'bad')).status, 401)
}
const ownerMe = await call('GET', '/api/staff/me', 'owner@example.com')
assert.equal(ownerMe.status, 200)
assert.equal(staffSchema.parse(data(ownerMe)).startDate, '2026-01-01')
const junkDateMe = await call('GET', '/api/staff/me', 'inactive@example.com')
assert.equal(junkDateMe.status, 200)
assert.equal(staffSchema.parse(data(junkDateMe)).startDate, '')
for (const [value, expected] of [
  [46023.75, '2026-01-01'], [0, '1899-12-30'], ['2024-02-29', '2024-02-29'],
  ['2026-02-30', ''], ['46023', ''], [true, ''], [null, ''], [1e20, ''],
] as const) {
  rows[0]![8] = value
  const result = await call('GET', '/api/staff/me', 'owner@example.com')
  assert.equal(result.status, 200)
  assert.equal(staffSchema.parse(data(result)).startDate, expected)
}
rows[0]![8] = 46023
assert.equal((await call('GET', '/api/staff/me', 'new@example.com')).status, 404)
const registered = await call('POST', '/api/staff', ' NEW@EXAMPLE.COM ', {
  name: ' New Staff ', phone: ' 0812345678 ', address: ' Home ',
})
assert.equal(registered.status, 201)
const newStaff = staffSchema.parse(data(registered))
assert.match(newStaff.staffId, /^[0-9a-f]{8}$/)
assert.deepEqual(newStaff, {
  staffId: newStaff.staffId, email: 'new@example.com', name: 'New Staff', phone: '0812345678',
  address: 'Home', role: null, active: false, position: '', startDate: '',
})
assert.equal(new URL(writes[0]!.url).searchParams.get('valueInputOption'), 'RAW')
assert.deepEqual(writes[0]!.body.values, [[
  'new@example.com', 'New Staff', '', false, newStaff.staffId, '0812345678', 'Home', '', '',
]])
assert.equal((await call('POST', '/api/staff', 'New@Example.com', {
  name: 'Duplicate', phone: '0', address: 'Home',
})).status, 409)
assert.equal(writes.length, 1)
assert.equal((await call('POST', '/api/staff', 'OWNER@example.com', {
  name: 'Duplicate', phone: '0', address: 'Home',
})).status, 409)
assert.deepEqual(data(await call('GET', '/api/staff/me', 'new@example.com')), newStaff)
assert.equal(staffSchema.parse(data(await call('GET', '/api/staff/me', 'inactive@example.com'))).active, false)
assert.equal(staffSchema.parse(data(await call('GET', '/api/staff/me', 'worker@example.com'))).phone, '812345678')

for (const email of ['worker@example.com', 'new@example.com', 'inactive@example.com', 'unlisted@example.com']) {
  assert.equal((await call('GET', '/api/staff', email)).status, 200)
  for (const [method, path] of [['GET', '/api/staff/worker-id'], ['PATCH', '/api/staff/worker-id']]) {
    assert.equal((await call(method!, path!, email, { name: 'Changed' })).status, 403)
  }
}
assert.equal((await call('GET', '/api/staff', 'bad')).status, 401)
const listResult = await call('GET', '/api/staff')
assert.equal(listResult.status, 200)
const list = (data(listResult) as unknown[]).map((row) => staffSchema.parse(row))
assert.equal(list.length, 5)
assert.equal(list[0]!.staffId, '')
assert.equal(list[0]!.startDate, '2026-01-01')
assert.equal(list[1]!.startDate, '2026-01-01')
assert.equal(list.find((row) => row.staffId === 'inactive-id')!.startDate, '')
assert.equal(list.find((row) => row.staffId === 'inactive-id')!.active, false)
assert.deepEqual(list.find((row) => row.staffId === newStaff.staffId), newStaff)
assert.equal((await call('GET', '/api/staff/missing', 'admin@example.com')).status, 404)
assert.equal((await call('PATCH', '/api/staff/missing', 'admin@example.com', { active: true })).status, 404)
assert.equal((await call('PATCH', '/api/staff/absent-id', 'admin@example.com', { active: true })).status, 404)

const patched = await call('PATCH', '/api/staff/worker-id', 'admin@example.com', { phone: '0900000000', active: false })
assert.equal(patched.status, 200)
assert.equal(writes[1]!.body.valueInputOption, 'RAW')
assert.deepEqual(writes[1]!.body.data, [
  { range: 'Staff!F3', values: [['0900000000']] }, { range: 'Staff!D3', values: [[false]] },
])
const updated = staffSchema.parse(data(patched))
assert.equal(updated.phone, '0900000000')
assert.equal(updated.name, 'Worker')
assert.equal(updated.active, false)
for (const body of [{ role: 'staff' }, { active: false }, { role: 'admin' }, { active: true }]) {
  assert.equal((await call('PATCH', '/api/staff/admin-id', 'ADMIN@example.com', body)).status, 409)
}
assert.equal(writes.length, 2)
assert.equal((await call('PATCH', '/api/staff/admin-id', 'admin@example.com', { name: 'New Admin' })).status, 200)
assert.equal((await call('PATCH', `/api/staff/${newStaff.staffId}`, 'new@example.com', { name: 'Self edit' })).status, 403)

for (const body of [{}, { email: 'changed@example.com' }, { staffId: 'changed' }, { role: null }, { startDate: '2026-02-30' }]) {
  assert.equal((await call('PATCH', '/api/staff/worker-id', 'admin@example.com', body)).status, 422)
}
assert.equal(registerStaffBodySchema.safeParse({ name: ' ', phone: '0', address: 'Home' }).success, false)
assert.equal(registerStaffBodySchema.safeParse({ name: 'A', phone: '0', address: 'Home', email: 'x' }).success, false)
assert.equal(updateStaffBodySchema.safeParse({ startDate: '' }).success, true)
assert.equal(updateStaffBodySchema.safeParse({ startDate: '2026-10-03' }).success, true)

const reorderedHeader = ['Phone', 'StaffId', 'StartDate', 'Email', 'Position', 'Active', 'Address', 'Role', 'Name']
let appendValues: unknown
let updateValues: unknown
const reorderedService = new StaffService({
  readRange: async (range, options) => {
    assert.equal(options?.valueRenderOption, 'UNFORMATTED_VALUE')
    return range === '1:1' ? [reorderedHeader] : [[123, 'reordered-id', '', 'target@example.com', '', false, '', '', 'Target']]
  },
  appendRows: async (values, option) => {
    assert.equal(option, 'RAW')
    appendValues = values
    return { updates: { updatedRows: 1, updatedData: { values } } }
  },
  updateCells: async (values, option) => {
    assert.equal(option, 'RAW')
    updateValues = values
    return { responses: [] }
  },
})
assert.equal((await reorderedService.list())[0]!.phone, '123')
const reorderedStaff = await reorderedService.register('another@example.com', { name: 'Another', phone: '001', address: 'Home' })
assert.deepEqual(appendValues, [['001', reorderedStaff.staffId, '', 'another@example.com', '', false, 'Home', '', 'Another']])
await reorderedService.update('reordered-id', 'admin@example.com', { phone: '002', role: 'staff', active: true })
assert.deepEqual(updateValues, [
  { range: 'Staff!A2', values: [['002']] }, { range: 'Staff!H2', values: [['staff']] },
  { range: 'Staff!F2', values: [[true]] },
])
console.log('staff API dry test passed')
