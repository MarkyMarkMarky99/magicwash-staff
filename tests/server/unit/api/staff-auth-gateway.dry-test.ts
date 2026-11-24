import assert from 'node:assert/strict'
import type { VercelRequest } from '@vercel/node'
import { ApiGateway } from '../../../../server/shared/http/api-gateway.js'
import { ApiHandler } from '../../../../server/shared/http/api-handler.js'
import { ApiError } from '../../../../server/shared/http/api-error.js'
import { bodyWithSessionActor } from '../../../../server/shared/http/session-actor.js'
import type { StaffAuthenticator, StaffIdentityAuthenticator } from '../../../../server/shared/auth/staff-auth.js'
import { authenticateStaff } from '../../../../server/shared/auth/staff-auth.js'
import { invalidateStaffListCache } from '../../../../server/shared/auth/staff-list.js'
import { SheetsApiClient } from '../../../../server/shared/repositories/sheets-api.client.js'

const staff = { staffId: 'staff-id', email: 'worker@example.com', name: 'Worker', role: 'staff' as const }
const request = (path: string, authorization?: string) => ({
  method: 'GET', url: path, query: {}, headers: authorization ? { authorization } : {},
}) as VercelRequest

function gateway(authenticate: StaffAuthenticator, authenticateIdentity?: StaffIdentityAuthenticator) {
  return new ApiGateway({
    auth: async () => ({
      collection: new ApiHandler({}),
      item: new ApiHandler({ GET: (req) => ({ status: 200, body: req.staff }) }),
    }),
    sample: async () => ({
      collection: new ApiHandler({ GET: (req) => ({ status: 200, body: req.staff }) }),
    }),
    orders: async () => ({
      collection: new ApiHandler({ GET: (req) => ({ status: 200, body: req.staff }) }),
    }),
    invoices: async () => ({
      collection: new ApiHandler({ GET: (req) => ({ status: 200, body: req.staff }) }),
      item: new ApiHandler({
        GET: (req) => ({ status: 200, body: req.staff }),
        PATCH: (req) => ({ status: 200, body: req.staff }),
      }),
    }),
    'laundry-items': async () => ({
      collection: new ApiHandler({ GET: (req) => ({ status: 200, body: req.staff }) }),
      item: new ApiHandler({
        PATCH: (req) => ({ status: 200, body: { staff: req.staff, payload: bodyWithSessionActor(req, 'updatedBy') } }),
      }),
    }),
    appointments: async () => ({
      collection: new ApiHandler({ GET: (req) => ({ status: 200, body: req.staff }), POST: (req) => ({ status: 201, body: bodyWithSessionActor(req, 'createdBy') }) }),
      item: new ApiHandler({ GET: (req) => ({ status: 200, body: req.staff }), PATCH: (req) => ({ status: 200, body: bodyWithSessionActor(req, 'updatedBy') }) }),
    }),
    'job-tickets': async () => ({
      collection: new ApiHandler({ GET: req => ({ status: 200, body: req.staff }) }),
      item: new ApiHandler({ GET: req => ({ status: 200, body: req.staff }), POST: req => ({ status: 200, body: req.staff }) }),
    }),
    'work-orders': async () => ({
      collection: new ApiHandler({ GET: req => ({ status: 200, body: req.staff }) }),
      item: new ApiHandler({ GET: req => ({ status: 200, body: req.staff }), PATCH: req => ({ status: 200, body: bodyWithSessionActor(req, 'updatedBy') }) }),
    }),
    customers: async () => ({
      collection: new ApiHandler({ GET: (req) => ({ status: 200, body: req.staff }) }),
      item: new ApiHandler({ GET: (req) => ({ status: 200, body: req.staff }) }),
    }),
    'work-transactions': async () => ({
      collection: new ApiHandler({ GET: (req) => ({ status: 200, body: req.staff }), POST: (req) => ({ status: 200, body: req.staff }) }),
      item: new ApiHandler({ GET: (req) => ({ status: 200, body: req.staff }) }),
    }),
    portal: async () => ({
      collection: new ApiHandler({ GET: (req) => ({ status: 200, body: req.staff }) }),
    }),
    staff: async () => ({
      collection: new ApiHandler({ GET: (req) => ({ status: 200, body: req.staff }) }),
      item: new ApiHandler({ GET: (req) => ({ status: 200, body: req.staff }) }),
    }),
  }, authenticate, authenticateIdentity)
}

let authCalls = 0
const fakeAuth: StaffAuthenticator = async (req) => {
  authCalls += 1
  const token = req.headers.authorization
  if (token === undefined || token === 'Bearer bad') throw ApiError.unauthorized()
  if (token === 'Bearer unlisted' || token === 'Bearer inactive') throw ApiError.forbidden()
  return staff
}

const api = gateway(fakeAuth)
for (const path of ['/api/sample', '/api/orders']) {
  const result = await api.handleRequest(request(path))
  assert.equal(result.status, 401)
  for (const token of ['Bearer bad', 'Bearer unlisted', 'Bearer inactive', 'Bearer good']) {
    const authenticated = await api.handleRequest(request(path, token))
    assert.equal(authenticated.status, token === 'Bearer bad' ? 401 : token === 'Bearer good' ? 200 : 403)
    if (token === 'Bearer good') assert.deepEqual(authenticated.body, staff)
  }
}
assert.equal(authCalls, 10)

for (const token of [undefined, 'Bearer bad']) {
  const result = await api.handleRequest(request('/api/auth/me', token))
  assert.equal(result.status, 401)
}
for (const token of ['Bearer unlisted', 'Bearer inactive']) {
  const result = await api.handleRequest(request('/api/auth/me', token))
  assert.equal(result.status, 403)
}
const allowed = await api.handleRequest(request('/api/auth/me', 'Bearer good'))
assert.equal(allowed.status, 200)
assert.deepEqual(allowed.body, staff)
assert.equal(authCalls, 15)

const callsBeforePublic = authCalls
assert.equal((await api.handleRequest(request('/api/portal'))).status, 200)
assert.equal((await api.handleRequest(request('/api/unknown'))).status, 404)
assert.equal(authCalls, callsBeforePublic)

let moduleLoads = 0
const protectedGateway = new ApiGateway({
  orders: async () => {
    moduleLoads += 1
    throw new Error('Unauthorized requests must not load modules')
  },
}, fakeAuth)
assert.equal((await protectedGateway.handleRequest(request('/api/orders'))).status, 401)
assert.equal(moduleLoads, 0)

let identityCalls = 0
const staffGateway = gateway(fakeAuth, async (req) => {
  identityCalls += 1
  if (!req.headers.authorization) throw ApiError.unauthorized()
  return { email: staff.email, staff }
})
assert.equal((await staffGateway.handleRequest(request('/api/staff'))).status, 401)
assert.equal(identityCalls, 1)

const previousPrintKey = process.env.PRINT_API_KEY
try {
  process.env.PRINT_API_KEY = 'print-secret'
  const printRequest = (path: string, key: string | string[], method = 'GET') => {
    const req = request(path)
    req.method = method
    req.headers['x-print-api-key'] = key
    return req
  }
  const callsBeforePrint = authCalls
  const printed = await api.handleRequest(printRequest('/api/invoices/X', 'print-secret'))
  assert.equal(printed.status, 200)
  assert.equal(printed.body, undefined)
  assert.equal(authCalls, callsBeforePrint)
  for (const key of ['wrong-secret', 'short', ['print-secret']]) {
    assert.equal((await api.handleRequest(printRequest('/api/invoices/X', key))).status, 401)
  }
  for (const [path, method] of [
    ['/api/invoices/X', 'PATCH'], ['/api/invoices', 'GET'],
    ['/api/orders', 'GET'], ['/api/invoices/X/extra', 'GET'],
  ]) {
    assert.equal((await api.handleRequest(printRequest(path!, 'print-secret', method))).status, 401)
  }
  const tokenRequest = printRequest('/api/invoices/X', 'wrong-secret')
  tokenRequest.headers.authorization = 'Bearer good'
  assert.deepEqual((await api.handleRequest(tokenRequest)).body, staff)
  delete process.env.PRINT_API_KEY
  assert.equal((await api.handleRequest(printRequest('/api/invoices/X', 'print-secret'))).status, 401)
  process.env.PRINT_API_KEY = '   '
  assert.equal((await api.handleRequest(printRequest('/api/invoices/X', '   '))).status, 401)
} finally {
  if (previousPrintKey === undefined) delete process.env.PRINT_API_KEY
  else process.env.PRINT_API_KEY = previousPrintKey
}

const previousAiKey = process.env.AI_SERVICE_KEY
const previousStaffSheet = process.env.STAFF_SPREADSHEET_ID
const previousProjectId = process.env.FIREBASE_PROJECT_ID
const originalReadRange = SheetsApiClient.prototype.readRange
let aiActive = true
let aiPresent = true
SheetsApiClient.prototype.readRange = async () => [
  ['Email', 'Name', 'Role', 'Active', 'StaffId'],
  ...(aiPresent ? [['ai@example.com', 'Appointment assistant', 'staff', aiActive, 'AI']] : []),
]
process.env.STAFF_SPREADSHEET_ID = 'dry-test-staff'
process.env.FIREBASE_PROJECT_ID = 'magicwashlaundry-a50ca'
invalidateStaffListCache()
try {
  process.env.AI_SERVICE_KEY = 'ai-service-secret'
  const serviceRequest = (path = '/api/laundry-items/Ab12Cd34', key: string | string[] = 'ai-service-secret', method = 'PATCH') => {
    const req = request(path)
    req.method = method
    req.headers['x-service-key'] = key
    req.body = { itemId: 'shirt' }
    return req
  }
  const callsBeforeAi = authCalls
  const aiStaff = { staffId: 'AI', name: 'Appointment assistant', email: 'ai@example.com', role: 'staff' }
  for (const body of [{ itemId: 'shirt' }, { itemId: 'shirt', updatedBy: 'spoofed' }]) {
    const req = serviceRequest()
    req.body = body
    const result = await api.handleRequest(req)
    assert.equal(result.status, 200)
    assert.deepEqual(result.body, { staff: aiStaff, payload: { itemId: 'shirt', updatedBy: 'AI' } })
  }
  for (const field of ['notes', 'washProgram', 'imageUrl', 'customerId', 'createdBy', 'unknown']) {
    const req = serviceRequest()
    req.body = { itemId: 'shirt', [field]: 'not allowed' }
    const result = await api.handleRequest(req)
    assert.equal(result.status, 403)
    assert.match(JSON.stringify(result.body), /only update itemId/)
  }
  assert.equal(authCalls, callsBeforeAi)
  for (const path of ['/api/appointments', '/api/appointments/APPT-1', '/api/customers', '/api/customers/CUST-1']) {
    assert.deepEqual((await api.handleRequest(serviceRequest(path, undefined, 'GET'))).body, aiStaff)
  }
  for (const [path, method] of [
    ['/api/job-tickets/department-work', 'GET'], ['/api/job-tickets', 'GET'],
    ['/api/job-tickets?orderId=o1&page=2&perPage=1', 'GET'],
    ['/api/job-tickets?laundryItemId=tag1&page=2&perPage=1', 'GET'],
    ['/api/work-orders', 'GET'], ['/api/work-transactions', 'GET'], ['/api/work-transactions?from=2026-11-01&to=2026-11-02', 'GET'],
    ['/api/staff/directory', 'GET'],
    ['/api/job-tickets/complete-order', 'POST'], ['/api/job-tickets/reopen', 'POST'],
    ['/api/job-tickets/complete-orders', 'POST'],
  ]) assert.deepEqual((await api.handleRequest(serviceRequest(path, undefined, method))).body, aiStaff)
  for (const [path, method, actorField, status] of [
    ['/api/appointments', 'POST', 'createdBy', 201],
    ['/api/appointments/APPT-1', 'PATCH', 'updatedBy', 200],
  ] as const) {
    const req = serviceRequest(path, undefined, method)
    req.body = { appointmentDate: '2026-11-18', notes: 'Allowed appointment fields', [actorField]: 'spoofed' }
    const result = await api.handleRequest(req)
    assert.equal(result.status, status)
    assert.deepEqual(result.body, { ...req.body, [actorField]: 'AI' })
  }
  {
    const req = serviceRequest('/api/work-orders/o1', undefined, 'PATCH')
    req.body = { status: 'COMPLETED', updatedBy: 'spoofed' }
    const result = await api.handleRequest(req)
    assert.equal(result.status, 200)
    assert.deepEqual(result.body, { status: 'COMPLETED', updatedBy: 'AI' })
  }
  for (const body of [{ status: 'CANCELLED' }, { status: 'APPROVED' }, { status: 'COMPLETED', note: 'x' }, { dueDate: '2026-11-18' }]) {
    const req = serviceRequest('/api/work-orders/o1', undefined, 'PATCH')
    req.body = body
    const result = await api.handleRequest(req)
    assert.equal(result.status, 403)
    assert.match(JSON.stringify(result.body), /only set work order status to COMPLETED/)
  }
  assert.equal(authCalls, callsBeforeAi)
  for (const active of [false, true]) {
    aiActive = active
    aiPresent = !active
    invalidateStaffListCache()
    for (const [path, method] of [['/api/appointments', 'POST'], ['/api/customers', 'GET'], ['/api/laundry-items/Ab12Cd34', 'PATCH'], ['/api/job-tickets', 'GET'], ['/api/job-tickets/reopen', 'POST'], ['/api/job-tickets/complete-order', 'POST'], ['/api/job-tickets/complete-orders', 'POST'], ['/api/work-orders', 'GET'], ['/api/work-transactions', 'GET'], ['/api/staff/directory', 'GET']]) {
      const result = await api.handleRequest(serviceRequest(path, undefined, method))
      assert.equal(result.status, 403)
      assert.match(JSON.stringify(result.body), /AI is not an active staff member/)
    }
  }
  aiActive = aiPresent = true
  invalidateStaffListCache()
  for (const [path, method] of [
    ['/api/laundry-items/Ab12Cd34', 'GET'], ['/api/laundry-items/Ab12Cd34', 'POST'],
    ['/api/laundry-items/Ab12Cd34', 'DELETE'], ['/api/laundry-items', 'PATCH'],
    ['/api/laundry-items', 'POST'], ['/api/laundry-items/Ab12Cd34/extra', 'PATCH'],
    ['/api/invoices/X', 'PATCH'],
    ['/api/appointments', 'PATCH'], ['/api/appointments/APPT-1', 'POST'],
    ['/api/appointments/APPT-1', 'DELETE'], ['/api/appointments/APPT-1/extra', 'GET'],
    ['/api/customers', 'POST'], ['/api/customers/CUST-1', 'PATCH'],
    ['/api/job-tickets/ticket1', 'GET'], ['/api/job-tickets/ticket1', 'PATCH'],
    ['/api/job-tickets/start-order', 'POST'], ['/api/job-tickets/advance', 'POST'],
    ['/api/job-tickets', 'POST'], ['/api/job-tickets/department-work', 'POST'],
    ['/api/job-tickets/reopen', 'GET'], ['/api/job-tickets/complete-order', 'GET'],
    ['/api/job-tickets/complete-orders', 'GET'], ['/api/job-tickets/complete-orders/extra', 'POST'],
    ['/api/job-tickets/reopen/extra', 'POST'], ['/api/work-orders/o1', 'GET'],
    ['/api/work-orders', 'POST'], ['/api/work-orders', 'PATCH'], ['/api/work-orders/o1', 'DELETE'],
    ['/api/work-transactions', 'POST'], ['/api/work-transactions/w1', 'GET'], ['/api/work-transactions', 'DELETE'],
    ['/api/staff', 'GET'], ['/api/staff/worker-id', 'GET'], ['/api/staff/me', 'GET'],
    ['/api/staff', 'POST'], ['/api/staff/worker-id', 'PATCH'],
    ['/api/staff/directory', 'POST'], ['/api/staff/directory', 'PATCH'], ['/api/staff/directory/extra', 'GET'],
  ]) {
    assert.equal((await api.handleRequest(serviceRequest(path!, 'ai-service-secret', method))).status, 401)
  }
  for (const key of ['wrong-key-secret!', 'short', ['ai-service-secret']]) {
    assert.equal((await api.handleRequest(serviceRequest(undefined, key))).status, 401)
    assert.equal((await api.handleRequest(serviceRequest('/api/staff/directory', key, 'GET'))).status, 401)
  }
  const noKey = serviceRequest()
  delete noKey.headers['x-service-key']
  assert.equal((await api.handleRequest(noKey)).status, 401)
  const tokenRequest = serviceRequest(undefined, 'wrong-key')
  tokenRequest.headers.authorization = 'Bearer good'
  tokenRequest.body = { notes: 'normal staff update' }
  assert.deepEqual((await api.handleRequest(tokenRequest)).body, {
    staff, payload: { notes: 'normal staff update', updatedBy: staff.staffId },
  })
  for (const key of [undefined, '', '   ']) {
    if (key === undefined) delete process.env.AI_SERVICE_KEY
    else process.env.AI_SERVICE_KEY = key
    assert.equal((await api.handleRequest(serviceRequest())).status, 401)
    assert.equal((await api.handleRequest(serviceRequest('/api/staff/directory', undefined, 'GET'))).status, 401)
  }
  const realGateway = gateway(authenticateStaff)
  assert.equal((await realGateway.handleRequest(request('/api/auth/me'))).status, 401)
  assert.equal((await realGateway.handleRequest(request('/api/auth/me', 'Bearer bad'))).status, 401)
} finally {
  SheetsApiClient.prototype.readRange = originalReadRange
  invalidateStaffListCache()
  if (previousStaffSheet === undefined) delete process.env.STAFF_SPREADSHEET_ID
  else process.env.STAFF_SPREADSHEET_ID = previousStaffSheet
  if (previousAiKey === undefined) delete process.env.AI_SERVICE_KEY
  else process.env.AI_SERVICE_KEY = previousAiKey
  if (previousProjectId === undefined) delete process.env.FIREBASE_PROJECT_ID
  else process.env.FIREBASE_PROJECT_ID = previousProjectId
}

console.log('staff auth gateway dry test passed')
