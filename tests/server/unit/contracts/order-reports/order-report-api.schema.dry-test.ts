import assert from 'node:assert/strict'
import * as orderReportModule from '../../../../../contracts/order-reports/order-report-api.schema.js'

const {
  orderReportPeriodSchema,
  orderReportQuerySchema,
  orderReportResponseSchema,
  orderReportServiceTypeSchema,
} = orderReportModule

assert.deepEqual(new Set(Object.keys(orderReportModule)), new Set([
  'orderReportPeriodSchema',
  'orderReportQuerySchema',
  'orderReportResponseSchema',
  'orderReportServiceTypeSchema',
]))

assert.deepEqual(orderReportPeriodSchema.options, ['day', 'week', 'month'])
assert.deepEqual(orderReportServiceTypeSchema.options, ['WSIR', 'DRCL', 'IRON', 'WASH', 'OTHER'])

assert.deepEqual(orderReportQuerySchema.parse({ period: 'day' }), { period: 'day' })
assert.deepEqual(
  orderReportQuerySchema.parse({ period: 'month', date: '2026-02-28' }),
  { period: 'month', date: '2026-02-28' },
)
for (const invalid of [
  {},
  { date: '2026-10-05' },
  { period: 'year' },
  { period: 'day', date: '2026-13-01' },
  { period: 'day', date: '2026-02-30' },
  { period: 'day', date: '05/10/2026' },
  { period: 'day', date: '' },
]) {
  assert.equal(orderReportQuerySchema.safeParse(invalid).success, false, JSON.stringify(invalid))
}

const validResponse = {
  period: 'week',
  date: '2026-10-05',
  range: { from: '2026-09-29', to: '2026-10-05' },
  previousRange: { from: '2026-09-22', to: '2026-09-28' },
  totals: { orders: 3, pieces: 12, cancelled: 1 },
  previousTotals: { orders: 2, pieces: 5 },
  status: { pending: 1, inProgress: 1, completed: 1 },
  byService: ['WSIR', 'DRCL', 'IRON', 'WASH', 'OTHER'].map((serviceType) => ({ serviceType, orders: 0, pieces: 0 })),
  series: [{ from: '2026-10-05', to: '2026-10-05', label: 'Mon', orders: 1 }],
  sevenDayAverage: 0.4,
  days: [{
    date: '2026-10-05',
    totals: { orders: 1, pieces: 4, cancelled: 0 },
    status: { pending: 1, inProgress: 0, completed: 0 },
    byService: ['WSIR', 'DRCL', 'IRON', 'WASH', 'OTHER'].map((serviceType) => ({ serviceType, orders: 0, pieces: 0 })),
    sevenDayAverage: 0.1,
  }],
}

assert.deepEqual(Object.keys(orderReportResponseSchema.shape), [
  'period', 'date', 'range', 'previousRange', 'totals', 'previousTotals', 'status',
  'byService', 'series', 'sevenDayAverage', 'days',
])
assert.deepEqual(Object.keys(orderReportResponseSchema.shape.totals.shape), ['orders', 'pieces', 'cancelled'])
assert.deepEqual(Object.keys(orderReportResponseSchema.shape.previousTotals.shape), ['orders', 'pieces'])
assert.deepEqual(Object.keys(orderReportResponseSchema.shape.status.shape), ['pending', 'inProgress', 'completed'])
assert.deepEqual(orderReportResponseSchema.parse(validResponse), validResponse)
assert.deepEqual(orderReportResponseSchema.parse({ ...validResponse, days: [] }), { ...validResponse, days: [] })

for (const invalid of [
  { ...validResponse, period: 'year' },
  { ...validResponse, date: 'x' },
  { ...validResponse, range: { from: '2026-09-29' } },
  { ...validResponse, totals: { orders: -1, pieces: 0, cancelled: 0 } },
  { ...validResponse, byService: [{ serviceType: 'BOGUS', orders: 0, pieces: 0 }] },
  { ...validResponse, series: [{ from: '2026-10-05', to: '2026-10-05', orders: 1 }] },
  { ...validResponse, sevenDayAverage: undefined },
  { ...validResponse, days: undefined },
  { ...validResponse, days: [{ ...validResponse.days[0], date: 'x' }] },
  { ...validResponse, days: [{ ...validResponse.days[0], sevenDayAverage: undefined }] },
]) {
  assert.equal(orderReportResponseSchema.safeParse(invalid).success, false)
}

console.log('order-report api schema dry test passed')
