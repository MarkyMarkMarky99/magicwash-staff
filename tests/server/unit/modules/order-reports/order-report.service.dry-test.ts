import assert from 'node:assert/strict'
import { orderReportResponseSchema } from '../../../../../contracts/order-reports/order-report-api.schema.js'
import { createOrderReportRoutes } from '../../../../../server/modules/order-reports/order-report.module.js'
import {
  OrderReportService,
  type OrderReportReader,
} from '../../../../../server/modules/order-reports/order-report.service.js'
import { ApiError } from '../../../../../server/shared/http/api-error.js'

let reads = 0
const reader: OrderReportReader = {
  async read(...args: unknown[]) {
    reads += 1
    assert.equal(args.length, 0, 'the report reads the whole sheet')
    return [
      { id: 'o1', received_date: 'Date(2026,9,5)', service_type: 'WSIR', status: 'PENDING', quantity: 3 },
      { id: 'o2', received_date: '2026-10-05', service_type: 'IRON', status: 'COMPLETED', quantity: null },
      { id: 'o3', received_date: '2026-10-05', service_type: 'DRCL', status: 'CANCELLED', quantity: 9 },
      { id: 'o4', received_date: '2026-10-04', service_type: 'WASH', status: 'APPROVED', quantity: 2 },
      { id: '', received_date: '2026-10-05', service_type: 'WASH', status: 'APPROVED', quantity: 2 },
      { id: 'o5', received_date: null, service_type: 'WASH', status: 'APPROVED', quantity: 2 },
    ] as never
  },
}

// 2026-10-05T18:00:00Z is already 2026-10-06 01:00 in Bangkok
let clockCalls = 0
const service = new OrderReportService(() => reader, () => {
  clockCalls += 1
  return new Date('2026-10-05T18:00:00Z')
})

const explicit = await service.get({ period: 'day', date: '2026-10-05' })
assert.equal(reads, 1)
assert.deepEqual(orderReportResponseSchema.parse(explicit), explicit)
assert.equal(explicit.date, '2026-10-05')
assert.deepEqual(explicit.totals, { orders: 2, pieces: 3, cancelled: 1 })
assert.deepEqual(explicit.previousTotals, { orders: 1, pieces: 2 })
assert.deepEqual(explicit.status, { pending: 1, inProgress: 0, completed: 1 })
assert.deepEqual(
  explicit.byService.map((entry) => [entry.serviceType, entry.orders]),
  [['WSIR', 1], ['DRCL', 0], ['IRON', 1], ['WASH', 0], ['OTHER', 0]],
)

assert.equal(explicit.days.length, 7)
assert.deepEqual(explicit.days.at(-1)?.totals, explicit.totals)

const defaulted = await service.get({ period: 'week' })
assert.equal(reads, 2)
assert.equal(defaulted.date, '2026-10-06', 'date defaults to the Bangkok calendar day')
assert.deepEqual(defaulted.range, { from: '2026-09-30', to: '2026-10-06' })
assert.deepEqual(defaulted.totals, { orders: 3, pieces: 5, cancelled: 1 })

for (const query of [{}, { period: 'year' }, { period: 'day', date: '2026-02-30' }]) {
  await assert.rejects(service.get(query), (error) => error instanceof ApiError && error.status === 422)
}
assert.equal(reads, 2, 'an invalid query must not read the sheet')

const failing = new OrderReportService(() => ({
  async read() {
    throw new Error('sheet unavailable')
  },
}))
await assert.rejects(failing.get({ period: 'day' }), /sheet unavailable/)

const routes = createOrderReportRoutes(service)
assert.ok(routes.collection)
assert.equal(routes.item, undefined)

const success = await routes.collection.handleRequest({
  method: 'GET',
  query: { period: 'month', date: '2026-10-05' },
  body: undefined,
  headers: {},
  params: {},
})
assert.equal(success.status, 200)
const successBody = success.body as { success: boolean; data: unknown }
assert.equal(successBody.success, true)
const monthReport = orderReportResponseSchema.parse(successBody.data)
assert.deepEqual(monthReport.range, { from: '2026-10-01', to: '2026-10-31' })
assert.deepEqual(monthReport.previousRange, { from: '2026-09-01', to: '2026-09-06' }, 'comparison uses today from the injected Bangkok clock, even with an explicit date')
assert.equal(clockCalls, 3, 'each valid report computes today once')

const invalid = await routes.collection.handleRequest({
  method: 'GET',
  query: { period: 'decade' },
  body: undefined,
  headers: {},
  params: {},
})
assert.equal(invalid.status, 422)

const wrongMethod = await routes.collection.handleRequest({
  method: 'POST',
  query: {},
  body: {},
  headers: {},
  params: {},
})
assert.equal(wrongMethod.status, 405)
assert.equal(wrongMethod.headers?.Allow, 'GET')

console.log('order-report service dry test passed')
