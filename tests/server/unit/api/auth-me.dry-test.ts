import assert from 'node:assert/strict'
import type { VercelRequest } from '@vercel/node'
import { ApiGateway } from '../../../../server/shared/http/api-gateway.js'
import { authRoutes } from '../../../../server/modules/auth/auth.module.js'

const staff = { email: 'Admin@Example.com', name: 'Admin', role: 'admin' as const }
const gateway = new ApiGateway({ auth: async () => authRoutes }, async () => staff)
const request = (method: string, path: string) => ({ method, url: path, query: {}, headers: {} }) as VercelRequest
const result = await gateway.handleRequest(request('GET', '/api/auth/me'))
assert.equal(result.status, 200)
assert.deepEqual((result.body as { data: unknown }).data, staff)
assert.equal(await gateway.handleRequest(request('GET', '/api/auth/other')).then((value) => value.status), 404)
const wrongMethod = await gateway.handleRequest(request('POST', '/api/auth/me'))
assert.equal(wrongMethod.status, 405)
assert.equal(wrongMethod.headers?.Allow, 'GET')

console.log('auth me dry test passed')
