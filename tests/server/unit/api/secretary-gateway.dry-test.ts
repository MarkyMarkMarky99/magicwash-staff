import assert from 'node:assert/strict'
import type { VercelRequest } from '@vercel/node'
import { ApiGateway } from '../../../../server/shared/http/api-gateway.js'
import { ApiHandler } from '../../../../server/shared/http/api-handler.js'
import { bodyWithSessionActor } from '../../../../server/shared/http/session-actor.js'
import { SheetsApiClient, type SheetsApiValues } from '../../../../server/shared/repositories/sheets-api.client.js'
import { findStaffByCardCode, getStaffList, invalidateStaffListCache, parseStaffList } from '../../../../server/shared/auth/staff-list.js'

const key = 'secretary-test-key'
const validHeaders = { 'x-secretary-key': key, 'x-assistant-id': 'AI-Owner1' }
const savedEnv = { ...process.env }
const originalReadRange = SheetsApiClient.prototype.readRange
const header = ['Email', 'Name', 'Role', 'Active', 'StaffId', 'Phone', 'Address', 'Position', 'StartDate', 'Departments']
const owner = ['owner@example.test', 'Owner', 'admin', true, 'Owner1', '', '', '', '', 'Washing, Ironing']
const assistant = ['assistant@example.invalid', 'Secretary', 'assistant', true, 'AI-Owner1']
const ai = ['ai@example.test', 'AI', 'staff', true, 'AI']
let rows: SheetsApiValues = [owner, assistant, ai]
let failRead = false
let moduleLoads = 0

const read = new ApiHandler({ GET: (req) => ({ status: 200, body: { actor: req.staff, email: req.email } }) })
const write = new ApiHandler({
  POST: (req) => ({ status: 200, body: bodyWithSessionActor(req, 'createdBy') }),
  PATCH: (req) => ({ status: 200, body: bodyWithSessionActor(req, 'updatedBy') }),
})
const routes = { collection: new ApiHandler({ GET: read.handleRequest, POST: write.handleRequest }),
  item: new ApiHandler({ GET: read.handleRequest, POST: write.handleRequest, PATCH: write.handleRequest }) }
const registry = Object.fromEntries(
  ['staff', 'customers', 'appointments', 'work-orders', 'job-tickets', 'work-transactions', 'portal', 'laundry-items', 'attendance'].map(module => [
    module, async () => { moduleLoads++; return routes },
  ]),
)
const noNormalAuth = async (): Promise<never> => { assert.fail('Secretary must never use Firebase authentication') }
const gateway = new ApiGateway(registry, noNormalAuth, noNormalAuth)

function call(path: string, method = 'GET', body?: unknown, headers: VercelRequest['headers'] = validHeaders,
  query: VercelRequest['query'] = {}) {
  return gateway.handleRequest({ url: path, method, body, headers, query } as VercelRequest)
}
async function forbidden(path = '/api/staff/directory', method = 'GET', body?: unknown,
  headers = validHeaders as VercelRequest['headers'], query?: VercelRequest['query']) {
  const before = moduleLoads
  assert.equal((await call(path, method, body, headers, query)).status, 403, `${method} ${path}`)
  assert.equal(moduleLoads, before, 'Permission checks precede loading the target module')
}

const appointment = {
  customerId: 'C1', customerName: 'Customer', customerCode: '001', phone: '021234567', address: 'Address',
  location: '', appointmentType: 'DELIVERY', appointmentDate: '2026-11-25', timeSlot: '10:00-12:00',
}
const reschedule = { appointmentDate: '2026-11-27', timeSlot: '10:00-12:00', status: 'PENDING' }
const completed = { status: 'COMPLETED' }
const cancelled = { status: 'CANCELLED' }
const close = { orderId: 'O1', department: 'Washing' }
const closeOrders = { orderIds: ['O1', 'O2'], department: 'Washing' }
const reopen = { ...close, reason: 'Wash again', ticketIds: ['T1'] }
const dayOff = { workDate: '2026-11-25' }

try {
  process.env.STAFF_SPREADSHEET_ID = 'dry-staff'
  process.env.SECRETARY_PROXY_KEY = key
  process.env.AI_SERVICE_KEY = 'legacy-key'
  invalidateStaffListCache()
  SheetsApiClient.prototype.readRange = async (range) => {
    if (failRead) throw new Error('Sheet unavailable')
    if (range === '1:1') return [header]
    if (range === 'A2:J') return rows
    assert.equal(range, 'A:I')
    return [header.slice(0, 9), ...rows.map(row => row.slice(0, 9))]
  }

  for (const configured of [undefined, '', '   ']) {
    if (configured === undefined) delete process.env.SECRETARY_PROXY_KEY
    else process.env.SECRETARY_PROXY_KEY = configured
    await forbidden()
  }
  process.env.SECRETARY_PROXY_KEY = key
  for (const value of [undefined, '', 'short', 'secretary-test-keY', [key]]) {
    await forbidden(undefined, 'GET', undefined, { ...validHeaders, 'x-secretary-key': value })
  }
  for (const value of [undefined, '', 'AI', 'AI-', 'ai-Owner1', 'AI-owner1', 'AI-Owner1 ', 'AI-Owner1\n', 'AI-Owner1, AI-Other', ['AI-Owner1']]) {
    await forbidden(undefined, 'GET', undefined, { ...validHeaders, 'x-assistant-id': value })
  }
  for (const header of ['authorization', 'x-print-api-key', 'x-operator-id', 'x-service-key']) {
    await forbidden(undefined, 'GET', undefined, { ...validHeaders, [header]: 'legacy-key' })
  }
  await forbidden(undefined, 'GET', undefined, { 'x-service-key': 'legacy-key', 'x-assistant-id': 'AI-Owner1' })

  for (const invalid of [
    [owner], [assistant], [owner, assistant, assistant], [owner, owner, assistant],
    [owner, [assistant[0]!, assistant[1]!, 'staff', true, assistant[4]!]],
    [owner, [assistant[0]!, assistant[1]!, 'assistant', false, assistant[4]!]],
    [[owner[0]!, owner[1]!, 'admin', false, owner[4]!], assistant],
    ...['device', 'assistant', ''].map(role => [[owner[0]!, owner[1]!, role, true, owner[4]!], assistant]),
  ]) {
    rows = invalid
    await forbidden()
  }
  rows = [owner, assistant, ai, ['ai-owner@example.invalid', 'Invalid Secretary', 'assistant', true, 'AI-AI']]
  await forbidden(undefined, 'GET', undefined, { ...validHeaders, 'x-assistant-id': 'AI-AI' })
  rows = [owner, assistant, ai]
  failRead = true
  await forbidden()
  failRead = false

  const expectedActor = { staffId: 'AI-Owner1', role: 'assistant', name: 'Secretary', email: 'assistant@example.invalid',
    onBehalfOf: { staffId: 'Owner1', role: 'admin', departments: ['Washing', 'Ironing'] } }
  for (const [path, query] of [
    ['/api/staff/directory', {}], ['/api/customers', { keyword: 'name', page: '1', perPage: '10' }],
    ['/api/customers/C1', {}], ['/api/appointments', { appointmentDate: '2026-11-25', page: '1', perPage: '1000' }],
    ['/api/appointments/A1', {}], ['/api/work-orders', { customerId: 'C1', page: '1', perPage: '500', sortOrder: 'desc' }],
    ['/api/job-tickets', { orderId: 'O1', page: '1', perPage: '500', sortBy: 'stepNo', sortOrder: 'asc' }],
    ['/api/job-tickets', { laundryItemId: 'T1' }], ['/api/job-tickets/department-work', { department: 'Washing' }],
    ['/api/attendance', { week: '2026-11-25' }],
    ['/api/[...path]', { path: ['staff', 'directory'] }],
  ] satisfies [string, VercelRequest['query']][]) {
    const result = await call(path, 'GET', undefined, validHeaders, query)
    assert.equal(result.status, 200, path)
    assert.deepEqual(result.body, { actor: expectedActor, email: undefined })
  }

  for (const path of [
    '/api/staff/secretary/Owner1', '/api/unknown', '/api/portal/orders', '/api/work-transactions', '/api/staff/me', '/api/staff', '/api/work-orders/O1',
    '/api/job-tickets/T1', '/api/staff/directory/extra', '/api/laundry-items/T1', '/api/customers/%ZZ', '/api',
    '/api/attendance/id', '/api/attendance/day-off',
  ]) await forbidden(path)
  for (const [path, query] of [
    ['/api/customers', { sortBy: 'customerIndex' }], ['/api/customers/C1', { keyword: 'x' }],
    ['/api/job-tickets', {}], ['/api/job-tickets', { orderId: 'O1', laundryItemId: 'T1' }],
    ['/api/job-tickets', { orderId: ['O1', 'O2'] }],
    ['/api/job-tickets/department-work', {}],
    ['/api/attendance', { week: ['2026-11-25'] }],
    ['/api/attendance', { week: '2026-11-25', staffId: 'Other' }],
    ['/api/attendance', { week: '2026-11-25', page: '1' }],
  ] satisfies [string, VercelRequest['query']][]) await forbidden(path, 'GET', undefined, validHeaders, query)

  const writes = [
    ['/api/job-tickets/complete-order', 'POST', close], ['/api/job-tickets/reopen', 'POST', reopen],
    ['/api/job-tickets/complete-orders', 'POST', closeOrders],
    ['/api/appointments', 'POST', appointment],
    ['/api/appointments', 'POST', { ...appointment, notes: 'note', vehicle: 'VAN', pickupOrderId: 'P1', deliveryOrderId: 'O1' }],
    ['/api/appointments/A1', 'PATCH', reschedule], ['/api/appointments/A1', 'PATCH', cancelled],
    ['/api/appointments/A1', 'PATCH', completed], ['/api/work-orders/O1', 'PATCH', completed],
    ['/api/attendance/day-off', 'POST', dayOff],
  ] as const
  for (const [path, method, body] of writes) {
    const actorField = method === 'POST' ? 'createdBy' : 'updatedBy'
    const result = await call(path, method, body)
    assert.equal(result.status, 200, path)
    assert.deepEqual(result.body, { ...body, [actorField]: 'AI-Owner1' })
    await forbidden(path, method, { ...body, [actorField]: 'Owner1' })
    await forbidden(path, method, { ...body, extra: true })
    await forbidden(path, method, [body])
    if (body === dayOff) await forbidden(path, method, body, validHeaders, { week: '2026-11-25' })
  }
  for (const [path, method, body] of [
    ['/api/job-tickets/start-order', 'POST', close], ['/api/job-tickets/complete-order', 'POST', { orderId: 'O1' }],
    ['/api/job-tickets/complete-orders', 'POST', close],
    ['/api/job-tickets/complete-orders', 'POST', { orderIds: ['O1'] }],
    ['/api/job-tickets/complete-orders', 'POST', { ...closeOrders, department: 'unknown' }],
    ['/api/job-tickets/complete-orders', 'GET', undefined],
    ['/api/job-tickets/reopen', 'POST', close], ['/api/job-tickets/reopen', 'POST', { ...reopen, department: 'unknown' }],
    ['/api/appointments', 'POST', { customerId: 'C1' }], ['/api/appointments/A1', 'PATCH', { status: 'PENDING' }],
    ['/api/appointments/A1', 'PATCH', { ...reschedule, status: 'COMPLETED' }],
    ['/api/appointments/A1', 'PATCH', { ...completed, deliveryOrderId: 'O2' }],
    ['/api/appointments/A1', 'PATCH', { ...cancelled, appointmentDate: '2026-11-25' }],
    ['/api/appointments/A1', 'PATCH', { status: 'CONFIRMED' }], ['/api/appointments/A1', 'DELETE', completed],
    ['/api/work-orders/O1', 'PATCH', cancelled], ['/api/work-orders', 'PATCH', completed],
    ['/api/attendance', 'POST', { staffId: 'Owner1', ...dayOff, status: 'DAY_OFF' }],
    ['/api/attendance/id', 'PATCH', dayOff], ['/api/attendance/id', 'DELETE', undefined],
    ['/api/attendance/day-off', 'PATCH', dayOff], ['/api/attendance/day-off', 'DELETE', undefined],
    ['/api/attendance/day-off', 'POST', {}], ['/api/attendance/day-off', 'POST', null],
    ['/api/attendance/day-off', 'POST', { ...dayOff, staffId: 'Other' }],
    ['/api/attendance/day-off', 'POST', { ...dayOff, status: 'LEAVE' }],
    ['/api/attendance/day-off', 'POST', { ...dayOff, notes: 'no' }],
  ] as const) await forbidden(path, method, body)

  // Warm the normal auth cache, then change the owner row without invalidating it.
  const activeStaff = await getStaffList()
  assert.equal(activeStaff.get('owner@example.test')?.role, 'admin')
  assert.equal(activeStaff.has('assistant@example.invalid'), false)
  assert.equal(parseStaffList([header, assistant]).get('assistant@example.invalid')?.role, 'assistant')
  assert.equal(await findStaffByCardCode('MWS-AI-Owner1'), undefined)
  assert.equal((await findStaffByCardCode('MWS-Owner1'))?.staffId, 'Owner1')
  rows = [[...owner.slice(0, 2), 'staff', ...owner.slice(3, 9), 'Packaging'], assistant, ai]
  for (const [path, method, body] of writes) {
    if (body === completed || body === dayOff) assert.equal((await call(path, method, body)).status, 200)
    else await forbidden(path, method, body)
  }
  for (const [path, body] of [
    ['/api/job-tickets/complete-order', close], ['/api/job-tickets/complete-orders', closeOrders], ['/api/job-tickets/reopen', reopen],
  ] as const) {
    assert.equal((await call(path, 'POST', { ...body, department: 'Packaging' })).status, 200)
  }
  const staffResult = await call('/api/staff/directory')
  assert.deepEqual(staffResult.body, { actor: { ...expectedActor, onBehalfOf: {
    staffId: 'Owner1', role: 'staff', departments: ['Packaging'],
  } }, email: undefined })
  assert.equal((await call('/api/attendance', 'GET', undefined, validHeaders, { week: '2026-11-25' })).status, 200)
  await forbidden('/api/attendance', 'POST', { staffId: 'Owner1', ...dayOff, status: 'DAY_OFF' })
  await forbidden('/api/attendance/id', 'PATCH', dayOff)
  await forbidden('/api/attendance/id', 'DELETE')

  await forbidden('/api/staff/secretary/Owner1', 'PATCH', { active: false })
  await forbidden('/api/staff/secretary/Owner1', 'PATCH', { active: true })

  const legacy = { 'x-service-key': 'legacy-key' }
  assert.deepEqual((await call('/api/work-orders/O1', 'PATCH', { ...completed, updatedBy: 'supplied' }, legacy)).body,
    { ...completed, updatedBy: 'AI' })
  assert.equal((await call('/api/work-transactions', 'GET', undefined, legacy)).status, 200)
  await forbidden('/api/work-transactions')
} finally {
  SheetsApiClient.prototype.readRange = originalReadRange
  invalidateStaffListCache()
  for (const name of ['STAFF_SPREADSHEET_ID', 'SECRETARY_PROXY_KEY', 'AI_SERVICE_KEY']) {
    if (savedEnv[name] === undefined) delete process.env[name]
    else process.env[name] = savedEnv[name]
  }
}
console.log('secretary gateway dry test passed')
