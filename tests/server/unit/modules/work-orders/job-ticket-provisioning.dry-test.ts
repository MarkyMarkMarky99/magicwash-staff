import assert from 'node:assert/strict'
import { buildJobTickets } from '../../../../../server/modules/work-orders/job-ticket-provisioning.js'

const order = {
  orderId: 'order-1',
  customerId: 'customer-1',
  orderName: 'Order one',
  dueDate: '2026-09-30',
  notes: 'Rush',
  createdBy: 'staff-1',
}

const expectedRoutes = {
  WASH: ['Washing', 'Packaging'],
  WSIR: ['Washing', 'Ironing', 'Packaging'],
  DRCL: ['DryCleaning', 'Ironing', 'Packaging'],
  IRON: ['Ironing', 'Packaging'],
} as const

for (const [serviceType, departments] of Object.entries(expectedRoutes)) {
  const result = buildJobTickets(order, [{
    laundryItemId: `tag-${serviceType}`,
    serviceType,
    specialInstructions: 'Delicate',
  }], [])
  assert.deepEqual(result.rows.map((row) => row.department), departments)
  assert.deepEqual(result.rows.map((row) => row.step_no), departments.map((_value, index) => index + 1))
  assert.ok(result.rows.every((row) => row.scope === 'ITEM' && row.status === 'Pending'))
  assert.deepEqual(result.unroutableGarments, [])
}

const idempotent = buildJobTickets(order, [{
  laundryItemId: 'tag-1',
  serviceType: 'WSIR',
  specialInstructions: null,
}], [{ laundryItemId: 'tag-1', department: 'Washing' }])
assert.deepEqual(idempotent.rows.map((row) => row.department), ['Ironing', 'Packaging'])

const duplicatePhotos = buildJobTickets(order, [
  { laundryItemId: 'tag-2', serviceType: 'WASH', specialInstructions: null },
  { laundryItemId: 'tag-2', serviceType: 'WASH', specialInstructions: null },
], [])
assert.equal(duplicatePhotos.rows.length, 2)

const unroutable = buildJobTickets(order, [
  { laundryItemId: 'tag-3', serviceType: 'FOLD', specialInstructions: null },
  { laundryItemId: '', serviceType: 'WASH', specialInstructions: null },
], [])
assert.deepEqual(unroutable.rows, [])
assert.deepEqual(unroutable.unroutableGarments, [
  { laundryItemId: 'tag-3', serviceType: 'FOLD', reason: 'unsupportedServiceType' },
  { laundryItemId: '', serviceType: 'WASH', reason: 'missingLaundryItemId' },
])

console.log('job-ticket provisioning dry test passed')
