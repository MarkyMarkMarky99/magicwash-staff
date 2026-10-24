import assert from 'node:assert/strict'
import { createLaundryItemRoutes, createLaundryItemService } from '../../../../../server/modules/laundry-items/laundry-item.module.js'
import type { ApiHandlerRequest } from '../../../../../server/shared/http/api-handler.js'

const reads: unknown[] = []
const writes: unknown[] = []
const service = createLaundryItemService(() => ({
  read: async query => {
    reads.push(query)
    return query?.id === 'new00001' ? [{ id: 'new00001', customer_id: 'customer-1' }] : []
  },
  append: async row => { writes.push(row); return row as never },
  update: async (_id, row) => { writes.push(row); return row as never },
}))
const registrations: unknown[] = []
const result = { registered: ['new00001'], alreadyRegistered: [], failed: [], aiTriggered: true }
const routes = createLaundryItemRoutes(service, {
  register: async (payload, actor) => { registrations.push({ payload, actor }); return result },
})
const body = { customerId: 'customer-1', garments: [{ tag: 'new00001', imageUrl: 'https://example.test/photo.jpg', itemId: null }], createdBy: 'spoofed' }
const request = (method: string, id = 'register'): ApiHandlerRequest => ({
  method, body, params: { id }, query: {}, headers: {},
  staff: { staffId: 'session-staff', email: 'staff@example.test', name: 'Staff', role: 'staff' },
})
const registered = await routes.item!.handleRequest(request('POST'))
assert.equal(registered.status, 201)
assert.deepEqual((registered.body as { data: unknown }).data, result)
assert.deepEqual(registrations, [{ payload: { ...body, createdBy: 'session-staff' }, actor: { staffId: 'session-staff' } }])
for (const method of ['GET', 'PATCH']) {
  const response = await routes.item!.handleRequest(request(method))
  assert.equal(response.status, 404)
  assert.equal((response.body as { error: { message: string } }).error.message, 'Route not found')
}
assert.equal((await routes.item!.handleRequest(request('POST', 'new00001'))).status, 404)
assert.equal((await routes.item!.handleRequest({ ...request('POST'), staff: undefined })).status, 401)
assert.equal(registrations.length, 1)
assert.equal(reads.length, 0)
assert.equal((await routes.item!.handleRequest(request('GET', 'new00001'))).status, 200)
const patch = { ...request('PATCH', 'new00001'), body: { notes: 'updated' } }
assert.equal((await routes.item!.handleRequest(patch)).status, 200)
assert.deepEqual(writes[0], { notes: 'updated', updated_by: 'session-staff' })
assert.equal((await routes.collection.handleRequest({ ...request('GET'), params: {} })).status, 200)
assert.equal((await routes.collection.handleRequest({ ...request('POST'), body: { id: 'new00002', customerId: 'customer-1' } })).status, 201)
assert.equal(writes.length, 2)
assert.equal((await routes.item!.handleRequest(request('DELETE'))).status, 405)
console.log('laundry-item register route dry tests passed')
