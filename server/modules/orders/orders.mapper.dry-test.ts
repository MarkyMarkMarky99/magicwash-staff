import assert from 'node:assert/strict'
import { orderListQuerySchema } from '../../../contracts/orders/order-api.schema.js'
import { parseOrThrow } from '../../shared/http/validate.js'
import { mapOrderRow, normalizeGVizDate, toNullableNumber } from './orders.mapper.js'

const baseRow = {
  orderId: 'AFT-1001',
  customerId: 'customer-1',
  orderNumber: '1001',
  receivedDate: 'Date(2026,6,21)',
  dueDate: 'Date(2026,6,23)',
  serviceType: 'ซักรีด',
  status: 'CONFIRM',
  quantity: '3',
  note: 'Call before delivery',
  itemsJson: JSON.stringify([
    {
      id: 'item-1',
      description: 'Shirt',
      service_type: 'ซักรีด',
      quantity: '2',
    },
  ]),
}

const tests: Array<{ name: string; run: () => void }> = []

function test(name: string, run: () => void) {
  tests.push({ name, run })
}

test('maps item keys, order quantity, and GViz dates', () => {
  assert.deepEqual(mapOrderRow(baseRow), {
    orderId: 'AFT-1001',
    customerId: 'customer-1',
    orderNumber: '1001',
    receivedDate: '2026-07-21',
    dueDate: '2026-07-23',
    serviceType: 'ซักรีด',
    status: 'CONFIRM',
    quantity: 3,
    note: 'Call before delivery',
    items: [
      {
        id: 'item-1',
        description: 'Shirt',
        serviceType: 'ซักรีด',
        quantity: 2,
      },
    ],
  })
})

test('malformed itemsJson safely becomes an empty item list', () => {
  assert.deepEqual(mapOrderRow({ ...baseRow, itemsJson: '{bad json' }).items, [])
})

test('non-array itemsJson safely becomes an empty item list', () => {
  assert.deepEqual(mapOrderRow({ ...baseRow, itemsJson: JSON.stringify({ id: 'not-an-array' }) }).items, [])
})

test('non-object array entries are filtered before item mapping', () => {
  const itemsJson = JSON.stringify([
    null,
    'stray string',
    42,
    { id: 'item-2', description: 'Towel', service_type: 'ซักแห้ง', quantity: '1' },
  ])

  assert.deepEqual(mapOrderRow({ ...baseRow, itemsJson }).items, [
    { id: 'item-2', description: 'Towel', serviceType: 'ซักแห้ง', quantity: 1 },
  ])
})

test('null, undefined, and empty-string quantities remain null', () => {
  assert.equal(toNullableNumber(null), null)
  assert.equal(toNullableNumber(undefined), null)
  assert.equal(toNullableNumber(''), null)
  assert.equal(mapOrderRow({ ...baseRow, quantity: null }).quantity, null)
  assert.equal(mapOrderRow({ ...baseRow, quantity: undefined }).quantity, null)
  assert.deepEqual(
    mapOrderRow({
      ...baseRow,
      itemsJson: JSON.stringify([
        { id: 'null', quantity: null },
        { id: 'empty', quantity: '' },
      ]),
    }).items,
    [
      { id: 'null', description: null, serviceType: null, quantity: null },
      { id: 'empty', description: null, serviceType: null, quantity: null },
    ],
  )
})

test('invalid numeric values become null without breaking the row', () => {
  assert.equal(toNullableNumber('not-a-number'), null)
  assert.equal(toNullableNumber(Symbol('unsafe')), null)
  assert.equal(mapOrderRow({ ...baseRow, quantity: 'not-a-number' }).quantity, null)
})

test('GViz date serials use the zero-indexed month correction', () => {
  assert.equal(normalizeGVizDate('Date(2026,0,1)'), '2026-01-01')
  assert.equal(normalizeGVizDate('Date(2026,11,31)'), '2026-12-31')
  assert.equal(normalizeGVizDate('2026-07-21'), '2026-07-21')
  assert.equal(normalizeGVizDate(null), null)
})

test('missing customerId fails list-query validation instead of reading all orders', () => {
  assert.throws(
    () => parseOrThrow(orderListQuerySchema, {}),
    /Invalid request payload/,
  )
})

for (const item of tests) {
  item.run()
}

console.log(`${tests.length} orders mapper dry tests passed`)
