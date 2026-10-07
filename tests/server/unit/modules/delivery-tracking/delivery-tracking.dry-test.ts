import assert from 'node:assert/strict'
import { DeliveryTrackingService, type DeliveryTrackingServiceOptions } from '../../../../../server/modules/delivery-tracking/delivery-tracking.service.js'
import { ApiError } from '../../../../../server/shared/http/api-error.js'

const images = [
  { id: 'bag-2', order_id: 'order-1', image_type: 'WEIGHT', image_path: 'https://example.com/2.jpg', quantity: 3, created_at: '2026-10-08 09:02:00' },
  { id: 'bag-1', order_id: 'order-1', image_type: 'WEIGHT', image_path: 'https://example.com/1.jpg', quantity: 2, created_at: '2026-10-08 09:01:00' },
  { id: 'old-proof', order_id: 'order-1', image_type: 'DELIVERY', image_path: 'https://example.com/old.jpg', created_at: '2026-10-08 10:00:00' },
  { id: 'new-proof', order_id: 'order-1', image_type: 'DELIVERY', image_path: 'https://example.com/new.jpg', created_at: 'Date(2026,9,8,11,0,0)' },
  { id: 'pickup', order_id: 'order-1', image_type: 'PICKUP', image_path: 'https://example.com/pickup.jpg', created_at: '2026-10-08 13:00:00' },
  { id: 'other-proof', order_id: 'order-2', image_type: 'DELIVERY', image_path: 'https://example.com/other.jpg', created_at: '2026-10-09 12:00:00' },
]
let tickets: Awaited<ReturnType<NonNullable<DeliveryTrackingServiceOptions['readJobTickets']>>> = []
let orderStatus = 'APPROVED'
const service = new DeliveryTrackingService({
  async readImages(where) { return 'id' in where ? images.filter(row => row.id === where.id) : images },
  async readOrder(orderId) { assert.equal(orderId, 'order-1'); return { id: orderId, customer_id: 'customer-1', status: orderStatus as 'APPROVED', received_date: '2026-10-07' } },
  async readJobTickets(orderId) { assert.equal(orderId, 'order-1'); return tickets },
  async readCustomerIndex() { return 'TSK' },
})
for (const [status, label] of [
  ['Pending', 'Being cleaned'], ['Cancelled', 'Being cleaned'], ['In Progress', 'Out for delivery'], ['Completed', 'Delivered'],
] as const) {
  tickets = [{ id: 'LOG-order-1-bag-1-LOG-BAG', status, completed_at: 'Date(2026,9,8,12,34,56)' }]
  const result = await service.get('bag-1')
  assert.equal(result.statusLabel, label)
  assert.equal(result.deliveredAt, status === 'Completed' ? '2026-10-08 12:34:56' : null)
  assert.equal(result.proofOfDeliveryUrl, 'https://example.com/new.jpg')
  assert.equal(result.bagIndex, 1)
  assert.equal(result.bagCount, 2)
  assert.deepEqual(result.otherBags.map(bag => bag.orderImageId), ['bag-2'])
}
for (const completedAt of [null, '', '   ']) {
  tickets = [{ id: 'LOG-order-1-bag-1-LOG-BAG', status: 'Completed', completed_at: completedAt }]
  assert.equal((await service.get('bag-1')).deliveredAt, null)
}
tickets = [{ id: 'LOG-order-1-bag-2-LOG-BAG', status: 'Completed' }]
assert.equal((await service.get('bag-1')).statusLabel, 'Being cleaned')
orderStatus = 'COMPLETED'
assert.equal((await service.get('bag-1')).statusLabel, 'Ready for delivery')
images.find(row => row.id === 'new-proof')!.image_path = 'relative/proof.jpg'
assert.equal((await service.get('bag-1')).proofOfDeliveryUrl, null)
images.splice(images.findIndex(row => row.id === 'new-proof'), 1)
assert.equal((await service.get('bag-1')).proofOfDeliveryUrl, 'https://example.com/old.jpg')
images.splice(images.findIndex(row => row.id === 'old-proof'), 1)
assert.equal((await service.get('bag-1')).proofOfDeliveryUrl, null)
for (const id of ['missing', 'pickup']) {
  await assert.rejects(() => service.get(id), error => error instanceof ApiError && error.status === 404)
}
console.log('delivery tracking dry test passed')
