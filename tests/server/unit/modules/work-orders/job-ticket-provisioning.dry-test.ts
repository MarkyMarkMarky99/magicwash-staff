import assert from 'node:assert/strict'
import {
  buildJobTicketId,
  buildJobTickets,
} from '../../../../../server/modules/work-orders/job-ticket-provisioning.js'

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

assert.deepEqual([
  buildJobTicketId('075f2236', 'AU829dj0', 'Tagging'),
  buildJobTicketId('075f2236', 'AU829dj0', 'Washing'),
  buildJobTicketId('075f2236', 'AU829dj0', 'DryCleaning'),
  buildJobTicketId('075f2236', 'AU829dj0', 'Ironing'),
  buildJobTicketId('075f2236', 'AU829dj0', 'Packaging'),
  buildJobTicketId('075f2236', 'AU829dj0', 'Logistics'),
], [
  'TAG-075f2236-AU829dj0',
  'WSH-075f2236-AU829dj0',
  'DRC-075f2236-AU829dj0',
  'IRN-075f2236-AU829dj0',
  'PCK-075f2236-AU829dj0',
  'LOG-075f2236-AU829dj0',
])

for (const [serviceType, departments] of Object.entries(expectedRoutes)) {
  const result = buildJobTickets(order, [{
    laundryItemId: `tag-${serviceType}`,
    serviceType,
    specialInstructions: 'Delicate',
    photoEvidenceUrl: 'https://example.test/before.jpg',
  }], [])
  assert.deepEqual(result.rows.map((row) => row.department), departments)
  assert.deepEqual(result.rows.map((row) => row.step_no), departments.map((_value, index) => index + 1))
  assert.ok(result.rows.every((row) => /^[A-Z]{3}-order-1-tag-/.test(row.id)))
  assert.ok(result.rows.every((row) => row.scope === 'ITEM' && row.status === 'Pending'))
  assert.ok(result.rows.every((row) => row.photo_evidence_url === 'https://example.test/before.jpg'))
  assert.deepEqual(result.unroutableGarments, [])
}

const idempotent = buildJobTickets(order, [{
  laundryItemId: 'tag-1',
  serviceType: 'WSIR',
  specialInstructions: null,
  photoEvidenceUrl: 'https://example.test/new.jpg',
}], [{ laundryItemId: 'tag-1', department: 'Washing' }])
assert.deepEqual(idempotent.rows.map((row) => row.department), ['Ironing', 'Packaging'])
assert.ok(idempotent.rows.every((row) => row.photo_evidence_url === 'https://example.test/new.jpg'))

const duplicatePhotos = buildJobTickets(order, [
  { laundryItemId: 'tag-2', serviceType: 'WASH', specialInstructions: null, photoEvidenceUrl: '' },
  { laundryItemId: 'tag-2', serviceType: 'WASH', specialInstructions: null, photoEvidenceUrl: 'https://example.test/first.jpg' },
  { laundryItemId: 'tag-2', serviceType: 'WASH', specialInstructions: null, photoEvidenceUrl: 'https://example.test/later.jpg' },
], [])
assert.equal(duplicatePhotos.rows.length, 2)
assert.ok(duplicatePhotos.rows.every((row) => row.photo_evidence_url === 'https://example.test/first.jpg'))

const emptyPhoto = buildJobTickets(order, [
  { laundryItemId: 'tag-empty', serviceType: 'WASH', specialInstructions: null, photoEvidenceUrl: '  ' },
], [])
assert.ok(emptyPhoto.rows.every((row) => row.photo_evidence_url === null))

const unroutable = buildJobTickets(order, [
  { laundryItemId: 'tag-3', serviceType: 'FOLD', specialInstructions: null, photoEvidenceUrl: null },
  { laundryItemId: '', serviceType: 'WASH', specialInstructions: null, photoEvidenceUrl: null },
], [])
assert.deepEqual(unroutable.rows, [])
assert.deepEqual(unroutable.unroutableGarments, [
  { laundryItemId: 'tag-3', serviceType: 'FOLD', reason: 'unsupportedServiceType' },
  { laundryItemId: '', serviceType: 'WASH', reason: 'missingLaundryItemId' },
])

console.log('job-ticket provisioning dry test passed')
