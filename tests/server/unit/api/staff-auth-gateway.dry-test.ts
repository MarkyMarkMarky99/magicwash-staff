import assert from 'node:assert/strict'
import type { VercelRequest } from '@vercel/node'
import { ApiGateway } from '../../../../server/shared/http/api-gateway.js'
import { ApiHandler } from '../../../../server/shared/http/api-handler.js'
import { ApiError } from '../../../../server/shared/http/api-error.js'
import type { StaffAuthenticator } from '../../../../server/shared/auth/staff-auth.js'
import { authenticateStaff } from '../../../../server/shared/auth/staff-auth.js'

const staff = { staffId: 'staff-id', email: 'worker@example.com', name: 'Worker', role: 'staff' as const }
const request = (path: string, authorization?: string) => ({
  method: 'GET', url: path, query: {}, headers: authorization ? { authorization } : {},
}) as VercelRequest

function gateway(authenticate: StaffAuthenticator) {
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
  }, authenticate)
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
  assert.equal(result.status, 200)
  assert.equal(result.body, undefined)
}
assert.equal(authCalls, 0)

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
assert.equal(authCalls, 5)

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
