import assert from 'node:assert/strict'
import type { VercelRequest } from '@vercel/node'
import { ApiGateway } from '../../../../server/shared/http/api-gateway.js'
import { ApiHandler } from '../../../../server/shared/http/api-handler.js'
import { ApiError } from '../../../../server/shared/http/api-error.js'
import type { StaffAuthenticator, StaffIdentityAuthenticator } from '../../../../server/shared/auth/staff-auth.js'
import { authenticateStaff } from '../../../../server/shared/auth/staff-auth.js'

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
    portal: async () => ({
      collection: new ApiHandler({ GET: (req) => ({ status: 200, body: req.staff }) }),
    }),
    staff: async () => ({
      collection: new ApiHandler({ GET: (req) => ({ status: 200, body: req.staff }) }),
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

const previousProjectId = process.env.FIREBASE_PROJECT_ID
process.env.FIREBASE_PROJECT_ID = 'magicwashlaundry-a50ca'
try {
  const realGateway = gateway(authenticateStaff)
  assert.equal((await realGateway.handleRequest(request('/api/auth/me'))).status, 401)
  assert.equal((await realGateway.handleRequest(request('/api/auth/me', 'Bearer bad'))).status, 401)
} finally {
  if (previousProjectId === undefined) delete process.env.FIREBASE_PROJECT_ID
  else process.env.FIREBASE_PROJECT_ID = previousProjectId
}

console.log('staff auth gateway dry test passed')
