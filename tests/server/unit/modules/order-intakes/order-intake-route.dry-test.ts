import assert from 'node:assert/strict'
import { routeRegistry } from '../../../../../server/api/route-registry.js'
import { createOrderIntakeRoutes } from '../../../../../server/modules/order-intakes/order-intake.module.js'

assert.ok((await routeRegistry['order-intakes']()).collection)
let creates = 0
const body = { customerId: 'customer-1' }
const routes = createOrderIntakeRoutes({ async create(payload, actor) {
  creates++
  assert.equal(payload, body)
  assert.equal(actor, 'session-staff')
  return { orderId: 'order001', status: 'APPROVED', ticketsCreated: 4, failed: [] }
} })
const request = { method: 'POST', headers: {}, params: {}, query: {}, body }
assert.equal((await routes.collection!.handleRequest(request)).status, 401)
assert.equal(creates, 0)
const response = await routes.collection!.handleRequest({ ...request,
  staff: { staffId: 'session-staff', email: 'staff@example.test', name: 'Staff', role: 'staff' },
})
assert.equal(response.status, 201)
assert.equal(creates, 1)
assert.equal((await routes.collection!.handleRequest({ ...request, method: 'GET' })).status, 405)
assert.equal(routes.item, undefined)
console.log('order-intake route dry test passed')
