import assert from 'node:assert/strict'
import { resolveRoute } from '../../../../server/api/route-registry.js'
import { orderItemService } from '../../../../server/modules/order-items/order-item.module.js'

const original = orderItemService.reassignQuantities
let calls = 0
orderItemService.reassignQuantities = async (payload: unknown) => {
  calls += 1
  assert.deepEqual(payload, { items: [{ orderItemId: 'item-1', quantity: 2 }], updatedBy: 'staff-1' })
  return { items: [] }
}
try {
  const routes = await resolveRoute('order-items')
  const request = (method: string, id: string) => ({
    method, query: {}, headers: {}, params: { id },
    body: { items: [{ orderItemId: 'item-1', quantity: 2 }], updatedBy: 'staff-1' },
  })
  const result = await routes.item!.handleRequest(request('POST', 'reassign-quantities'))
  assert.equal(result.status, 200)
  assert.deepEqual((result.body as { data: unknown }).data, { items: [] })
  assert.equal((await routes.item!.handleRequest(request('GET', 'reassign-quantities'))).status, 404)
  assert.equal((await routes.item!.handleRequest(request('PATCH', 'reassign-quantities'))).status, 404)
  assert.equal((await routes.item!.handleRequest(request('POST', 'item-1'))).status, 404)
  assert.equal(calls, 1)
} finally {
  orderItemService.reassignQuantities = original
}

console.log('order-item reassign route registry dry test passed')
