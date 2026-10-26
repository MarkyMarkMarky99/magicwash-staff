import assert from 'node:assert/strict'
import { ApiError } from '../../../../../server/shared/http/api-error.js'
import { intakeFixture, intakePayload } from './order-intake.fixture.js'

async function invalid(change: (data: ReturnType<typeof intakePayload>, fixture: ReturnType<typeof intakeFixture>) => void, status: number, detail?: string, expectedTags?: string[]) {
  const data = intakePayload()
  const fixture = intakeFixture(data)
  change(data, fixture)
  await assert.rejects(() => fixture.service.create(data, 'staff-1'), (error: unknown) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, status)
    if (detail) assert.deepEqual(error.details, { [detail]: expectedTags })
    return true
  })
  assert.deepEqual(fixture.writes, {})
  return fixture
}

for (const [field, value] of [
  ['customerId', ''], ['receivedDate', '2026-02-30'], ['dueDate', 'bad'], ['serviceType', 'BAD'],
  ['orderName', 1], ['note', 1], ['items', []], ['images', [{ imageType: 'WEIGHT', imageUrl: 'bad' }]],
  ['createdBy', 'spoofed'],
] as const) {
  const fixture = await invalid(data => { Object.assign(data, { [field]: value }) }, 422)
  assert.deepEqual(fixture.gviz, {})
}
await invalid(data => { data.items[0]!.tags = [] }, 422)
await invalid(data => { data.items[0]!.tags.push(data.items[0]!.tags[0]!) }, 422)
await invalid(data => { data.items[1]!.tags.push(data.items[0]!.tags[0]!) }, 422)
await invalid(data => { data.items[0]!.tags[0] = 'bad' }, 422)
const unknownItem = await invalid(data => { data.items[0]!.itemId = 'unknown' }, 400)
assert.deepEqual(unknownItem.gviz, { Items: 1 })
const missing = await invalid((_data, fixture) => { fixture.registered.splice(0, 1) }, 400, 'unregisteredTags', ['TAG00000'])
assert.deepEqual(missing.gviz, { Items: 1, LaundryItems: 2 })
const conflict = await invalid((_data, fixture) => {
  const row = fixture.registered.shift()!
  fixture.others.push({ ...row, customer_id: 'another' })
}, 409, 'conflictingTags', ['TAG00000'])
assert.deepEqual(conflict.gviz, { Items: 1, LaundryItems: 2 })
await invalid((_data, fixture) => { fixture.registered[0]!.item_id = 'item0002' }, 400, 'typeMismatchTags', ['TAG00000'])
await invalid((_data, fixture) => { Object.assign(fixture.registered[0]!, { deleted_at: '2026-10-25 10:00:00' }) }, 400, 'unregisteredTags', ['TAG00000'])
for (const imageUrl of ['bad', 'http://firebasestorage.googleapis.com/file', 'https://example.test/file', 'https://firebasestorage.googleapis.com.evil.test/file']) {
  const fixture = await invalid(data => { data.images[0]!.imageUrl = imageUrl }, 400)
  assert.deepEqual(fixture.gviz, { Items: 1, LaundryItems: 1 })
}
const unauthorized = intakeFixture()
await assert.rejects(() => unauthorized.service.create(intakePayload(), ''), (error: unknown) => error instanceof ApiError && error.status === 422)
assert.deepEqual(unauthorized.calls, [])

const fixture = intakeFixture()
const result = await fixture.save()
assert.equal(result.status, 201)
assert.equal((result.body as { success: boolean }).success, true)
const response = (result.body as { data: { orderId: string, status: string, ticketsCreated: number, failed: string[] } }).data
assert.match(response.orderId, /^[a-z0-9]{8}$/)
assert.deepEqual(response, { orderId: response.orderId, status: 'APPROVED', ticketsCreated: 40, failed: [] })
assert.deepEqual(fixture.calls.slice(-8), ['LaundryItems', 'OrderForm', 'OrderItemForms', 'OrderGarments', 'OrderImages', 'JobTickets', 'WorkTransactions', 'OrderForm status'])
assert.deepEqual(fixture.rows.OrderForm, [{
  id: response.orderId, customer_id: 'customer-1', received_date: '2026-10-25', due_date: '2026-10-27',
  service_type: 'WSIR', status: 'PENDING', quantity: 10, note: 'Rush', created_by: 'staff-1',
  order_name: 'Intake', order_description: null,
}, { id: response.orderId, status: 'APPROVED', updated_by: 'staff-1' }])
assert.deepEqual(fixture.rows.OrderItemForms!.map(row => ({ ...row, id: undefined })), intakePayload().items.map(item => ({
  id: undefined, order_id: response.orderId, item_id: item.itemId, description: `เสื้อ ${item.itemId.slice(-1)}`, quantity: item.tags.length,
  price: null, category: null, service_type: 'WSIR', special_instructions: null, created_by: 'staff-1',
})))
for (const [index, item] of intakePayload().items.entries()) {
  const line = fixture.rows.OrderItemForms![index]!
  assert.match(String(line.id), /^[a-z0-9]{8}$/)
  for (const tag of item.tags) {
    const row = fixture.rows.OrderGarments!.find(row => row.laundry_item_id === tag)!
    assert.match(String(row.id), /^[a-z0-9]{8}$/)
    assert.deepEqual(row, { id: row.id, order_id: response.orderId, laundry_item_id: tag, orderitem_id: line.id,
      status: 'RECEIVED', notes: null, created_at: '2026-10-25 10:00:00', created_by: 'staff-1',
      updated_at: null, updated_by: null, deleted_at: null, deleted_by: null })
  }
}
assert.equal(fixture.rows.OrderImages!.length, 2)
for (const [index, image] of fixture.rows.OrderImages!.entries()) {
  assert.deepEqual(image, { id: image.id, customer_id: 'customer-1', delivery_id: null, order_id: response.orderId,
    image_type: intakePayload().images[index]!.imageType, image_path: intakePayload().images[index]!.imageUrl,
    quantity: null, notes: null, created_by: 'staff-1' })
}
assert.equal(fixture.rows.WorkTransactions!.length, 10)
assert.ok(fixture.rows.WorkTransactions!.every(row => row.created_by === 'staff-1' && row.minutes === 3))
assert.ok(fixture.rows.JobTickets!.every(row => row.photo_evidence_url === `https://firebasestorage.googleapis.com/${row.laundry_item_id}`))
assert.equal(fixture.rows.LaundryItems!.length, 3)

for (const failure of ['LaundryItems', 'OrderForm']) {
  const failed = intakeFixture(intakePayload(), failure)
  await assert.rejects(() => failed.service.create(intakePayload(), 'staff-1'), /unavailable/)
  assert.equal(failed.calls.at(-1), failure)
  assert.equal(failed.rows.OrderForm?.some(row => row.status === 'APPROVED') ?? false, false)
}
for (const failure of ['OrderItemForms', 'OrderGarments']) {
  const failed = intakeFixture(intakePayload(), failure)
  const result = await failed.service.create(intakePayload(), 'staff-1')
  assert.equal(result.status, 'PENDING')
  assert.deepEqual(result.failed, failure === 'OrderItemForms' ? ['OrderItemForms', 'OrderGarments'] : ['OrderGarments'])
  assert.equal(failed.calls.at(-1), failure)
  assert.equal(failed.rows.OrderForm?.some(row => row.status === 'APPROVED') ?? false, false)
}
for (const failure of ['OrderImages', 'JobTickets', 'WorkTransactions']) {
  const failed = intakeFixture(intakePayload(), failure)
  const result = await failed.service.create(intakePayload(), 'staff-1')
  assert.deepEqual(result.failed, [failure])
  assert.equal(result.status, failure === 'JobTickets' ? 'PENDING' : 'APPROVED')
  assert.equal(result.ticketsCreated, failure === 'JobTickets' ? 0 : 40)
  if (failure === 'JobTickets') {
    assert.equal(failed.calls.includes('WorkTransactions'), false)
    assert.equal(failed.calls.includes('OrderForm status'), false)
  }
}
const statusFailure = intakeFixture(intakePayload(), 'OrderForm status')
const statusResult = await statusFailure.service.create(intakePayload(), 'staff-1')
assert.equal(statusResult.status, 'PENDING')
assert.equal(statusResult.ticketsCreated, 40)
assert.deepEqual(statusResult.failed, ['OrderForm status'])
console.log('order-intake service dry test passed')
