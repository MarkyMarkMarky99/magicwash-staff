import assert from 'node:assert/strict'
import { intakeFixture, intakePayload } from './order-intake.fixture.js'

for (const count of [10, 50]) {
  const fixture = intakeFixture(intakePayload(count))
  assert.equal((await fixture.save()).status, 201)
  assert.deepEqual(fixture.gviz, { Items: 1, LaundryItems: 1, WorkRates: 1 })
  assert.deepEqual(fixture.reads, { Staff: 1, LaundryItems: 2, OrderForm: 2 })
  assert.deepEqual(fixture.writes, {
    LaundryItems: 1, OrderForm: 2, OrderItemForms: 1, OrderGarments: 1,
    OrderImages: 1, JobTickets: 1, WorkTransactions: 1,
  })
  assert.equal(fixture.rows.OrderItemForms!.length, 3)
  assert.equal(fixture.rows.OrderGarments!.length, count)
  assert.equal(fixture.rows.OrderImages!.length, 2)
  assert.equal(fixture.rows.JobTickets!.length, count * 4)
  assert.equal(fixture.rows.WorkTransactions!.length, count)
  for (const counts of [fixture.gviz, fixture.reads, fixture.writes] as Record<string, number>[]) for (const key of Object.keys(counts)) delete counts[key]
  assert.equal((await fixture.save()).status, 201)
  assert.deepEqual(fixture.gviz, { Items: 1, LaundryItems: 1 })
  assert.deepEqual(fixture.reads, { LaundryItems: 2, OrderForm: 2 })
  assert.deepEqual(fixture.writes, {
    LaundryItems: 1, OrderForm: 2, OrderItemForms: 1, OrderGarments: 1,
    OrderImages: 1, JobTickets: 1, WorkTransactions: 1,
  })
}

const minimalPayload = intakePayload()
minimalPayload.images = []
const minimal = intakeFixture(minimalPayload, undefined, false)
minimal.deps.staff = async () => new Map()
await minimal.save()
assert.deepEqual(minimal.gviz, { Items: 1, LaundryItems: 1, WorkRates: 1 })
assert.deepEqual(minimal.reads, { OrderForm: 2 })
assert.deepEqual(minimal.writes, { OrderForm: 2, OrderItemForms: 1, OrderGarments: 1, JobTickets: 1 })
console.log('order-intake call budget dry test passed: cold 3 GViz / 5 Sheets reads / 8 writes; warm 2 / 4 / 8, for 10 and 50 garments')
