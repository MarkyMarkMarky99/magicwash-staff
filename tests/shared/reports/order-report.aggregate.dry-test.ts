import assert from 'node:assert/strict'
import { orderReportResponseSchema } from '../../../contracts/order-reports/order-report-api.schema.js'
import {
  buildOrderReport,
  type OrderReportSourceRow,
} from '../../../shared/reports/order-report.aggregate.js'

function row(overrides: Record<string, unknown> = {}): OrderReportSourceRow {
  return {
    orderId: 'o',
    receivedDate: '2026-10-05',
    serviceType: 'WSIR',
    status: 'PENDING',
    quantity: 1,
    ...overrides,
  } as OrderReportSourceRow
}

const SERVICES = ['WSIR', 'DRCL', 'IRON', 'WASH', 'OTHER']

const empty = buildOrderReport([], 'day', '2026-10-05', '2026-10-05')
assert.deepEqual(orderReportResponseSchema.parse(empty), empty)
assert.deepEqual(empty.totals, { orders: 0, pieces: 0, cancelled: 0 })
assert.deepEqual(empty.previousTotals, { orders: 0, pieces: 0 })
assert.deepEqual(empty.status, { pending: 0, inProgress: 0, completed: 0 })
assert.deepEqual(empty.byService.map((entry) => entry.serviceType), SERVICES)
assert.ok(empty.byService.every((entry) => entry.orders === 0 && entry.pieces === 0))
assert.equal(empty.sevenDayAverage, 0)
assert.equal(empty.series.length, 7)
assert.ok(empty.series.every((entry) => entry.orders === 0))

// day: boundaries, previous day, ignored rows
const dayReport = buildOrderReport(
  [
    row({ orderId: 'a', receivedDate: '2026-10-05', quantity: 3 }),
    row({ orderId: 'b', receivedDate: 'Date(2026,9,5)', quantity: 2 }),
    row({ orderId: 'c', receivedDate: '2026-10-05 23:59:59', quantity: 1 }),
    row({ orderId: 'd', receivedDate: '2026-10-05T17:00:00Z', quantity: 4 }),
    row({ orderId: 'e', receivedDate: '2026-10-05T16:59:59Z', quantity: 5 }),
    row({ orderId: 'f', receivedDate: '2026-10-04', quantity: 7 }),
    row({ orderId: 'g', receivedDate: '2026-10-06', quantity: 9 }),
    row({ orderId: '', receivedDate: '2026-10-05', quantity: 11 }),
    row({ orderId: '  ', receivedDate: '2026-10-05', quantity: 11 }),
    row({ orderId: undefined, receivedDate: '2026-10-05', quantity: 11 }),
    row({ orderId: 'h', receivedDate: null, quantity: 11 }),
    row({ orderId: 'i', receivedDate: 'not a date', quantity: 11 }),
    row({ orderId: 'j', receivedDate: '2026-02-30', quantity: 11 }),
  ],
  'day',
  '2026-10-05',
  '2026-10-05',
)
assert.deepEqual(dayReport.range, { from: '2026-10-05', to: '2026-10-05' })
assert.deepEqual(dayReport.previousRange, { from: '2026-10-04', to: '2026-10-04' })
assert.deepEqual(dayReport.totals, { orders: 4, pieces: 3 + 2 + 1 + 5, cancelled: 0 })
assert.deepEqual(dayReport.previousTotals, { orders: 1, pieces: 7 })
assert.equal(dayReport.series.length, 7)
assert.deepEqual(dayReport.series[6], { from: '2026-10-05', to: '2026-10-05', label: 'Mon', orders: 4 })
assert.deepEqual(dayReport.series[5], { from: '2026-10-04', to: '2026-10-04', label: 'Sun', orders: 1 })
assert.deepEqual(dayReport.series[0], { from: '2026-09-29', to: '2026-09-29', label: 'Tue', orders: 0 })

// cancelled exclusion
const cancelledReport = buildOrderReport(
  [
    row({ orderId: 'a', status: 'PENDING', quantity: 2 }),
    row({ orderId: 'b', status: 'CANCELLED', quantity: 50, serviceType: 'IRON' }),
    row({ orderId: 'c', status: 'CANCELLED', quantity: 50, receivedDate: '2026-10-04' }),
  ],
  'day',
  '2026-10-05',
  '2026-10-05',
)
assert.deepEqual(cancelledReport.totals, { orders: 1, pieces: 2, cancelled: 1 })
assert.deepEqual(cancelledReport.previousTotals, { orders: 0, pieces: 0 })
assert.deepEqual(cancelledReport.status, { pending: 1, inProgress: 0, completed: 0 })
assert.equal(cancelledReport.byService.find((entry) => entry.serviceType === 'IRON')?.orders, 0)
assert.equal(cancelledReport.series[6]?.orders, 1)
assert.equal(cancelledReport.series[5]?.orders, 0)
assert.equal(cancelledReport.sevenDayAverage, 0.1)

// status grouping and OTHER bucket
const statusReport = buildOrderReport(
  [
    row({ orderId: '1', status: 'PENDING', serviceType: 'WSIR', quantity: 1 }),
    row({ orderId: '2', status: 'RECEIVED', serviceType: 'DRCL', quantity: 2 }),
    row({ orderId: '3', status: 'SUBMITTED', serviceType: 'IRON', quantity: 3 }),
    row({ orderId: '4', status: 'APPROVED', serviceType: 'WASH', quantity: 4 }),
    row({ orderId: '5', status: 'COMPLETED', serviceType: 'WSIR', quantity: 5 }),
    row({ orderId: '6', status: 'WEIRD', serviceType: 'XYZ', quantity: 6 }),
    row({ orderId: '7', status: null, serviceType: null, quantity: null }),
    row({ orderId: '8', status: undefined, serviceType: undefined, quantity: undefined }),
  ],
  'day',
  '2026-10-05',
  '2026-10-05',
)
assert.deepEqual(statusReport.totals, { orders: 8, pieces: 21, cancelled: 0 })
assert.deepEqual(statusReport.status, { pending: 1, inProgress: 3, completed: 1 })
assert.deepEqual(statusReport.byService, [
  { serviceType: 'WSIR', orders: 2, pieces: 6 },
  { serviceType: 'DRCL', orders: 1, pieces: 2 },
  { serviceType: 'IRON', orders: 1, pieces: 3 },
  { serviceType: 'WASH', orders: 1, pieces: 4 },
  { serviceType: 'OTHER', orders: 3, pieces: 6 },
])

// week: 7 days ending at date, previous 7 days before that
const weekReport = buildOrderReport(
  [
    row({ orderId: 'in-start', receivedDate: '2026-09-29', quantity: 1 }),
    row({ orderId: 'in-end', receivedDate: '2026-10-05', quantity: 2 }),
    row({ orderId: 'before', receivedDate: '2026-09-28', quantity: 10 }),
    row({ orderId: 'prev-start', receivedDate: '2026-09-22', quantity: 20 }),
    row({ orderId: 'prev-end', receivedDate: '2026-09-28', quantity: 30 }),
    row({ orderId: 'older', receivedDate: '2026-09-21', quantity: 40 }),
    row({ orderId: 'after', receivedDate: '2026-10-06', quantity: 50 }),
  ],
  'week',
  '2026-10-05',
  '2026-10-05',
)
assert.deepEqual(weekReport.range, { from: '2026-09-29', to: '2026-10-05' })
assert.deepEqual(weekReport.previousRange, { from: '2026-09-22', to: '2026-09-28' })
assert.deepEqual(weekReport.totals, { orders: 2, pieces: 3, cancelled: 0 })
assert.deepEqual(weekReport.previousTotals, { orders: 3, pieces: 60 })
assert.deepEqual(weekReport.series.map((entry) => entry.label), ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon'])
assert.deepEqual(weekReport.series.map((entry) => entry.orders), [1, 0, 0, 0, 0, 0, 1])
assert.equal(weekReport.series[0]?.from, '2026-09-29')
assert.equal(weekReport.series[6]?.to, '2026-10-05')

// week crossing a year boundary
const yearBoundary = buildOrderReport([row({ receivedDate: '2025-12-31' })], 'week', '2026-01-02', '2026-10-05')
assert.deepEqual(yearBoundary.range, { from: '2025-12-27', to: '2026-01-02' })
assert.deepEqual(yearBoundary.previousRange, { from: '2025-12-20', to: '2025-12-26' })
assert.equal(yearBoundary.totals.orders, 1)

// month: 31-day month, W1..W5 buckets, full range even for the current month
const monthRows = [
  '2026-10-01', '2026-10-07', '2026-10-08', '2026-10-14', '2026-10-15', '2026-10-21',
  '2026-10-22', '2026-10-28', '2026-10-29', '2026-10-31', '2026-11-01', '2026-09-30', '2026-09-01', '2026-09-05', '2026-09-06',
].map((receivedDate, index) => row({ orderId: `m${index}`, receivedDate, quantity: 1 }))
const octoberReport = buildOrderReport(monthRows, 'month', '2026-10-05', '2026-10-05')
assert.deepEqual(octoberReport.range, { from: '2026-10-01', to: '2026-10-31' })
assert.deepEqual(octoberReport.previousRange, { from: '2026-09-01', to: '2026-09-05' })
assert.deepEqual(octoberReport.totals, { orders: 10, pieces: 10, cancelled: 0 })
assert.deepEqual(octoberReport.previousTotals, { orders: 2, pieces: 2 })
assert.deepEqual(octoberReport.series, [
  { from: '2026-10-01', to: '2026-10-07', label: 'W1', orders: 2 },
  { from: '2026-10-08', to: '2026-10-14', label: 'W2', orders: 2 },
  { from: '2026-10-15', to: '2026-10-21', label: 'W3', orders: 2 },
  { from: '2026-10-22', to: '2026-10-28', label: 'W4', orders: 2 },
  { from: '2026-10-29', to: '2026-10-31', label: 'W5', orders: 2 },
])

const pastMonth = buildOrderReport(
  [
    row({ receivedDate: '2026-08-01', quantity: 2 }),
    row({ receivedDate: '2026-08-31', quantity: 3 }),
    row({ receivedDate: '2026-07-31', quantity: 10 }),
    row({ receivedDate: '2026-09-01', quantity: 20 }),
  ],
  'month',
  '2026-09-01',
  '2026-10-05',
)
assert.deepEqual(pastMonth.previousRange, { from: '2026-08-01', to: '2026-08-31' })
assert.deepEqual(pastMonth.previousTotals, { orders: 2, pieces: 5 })

const clampedMonth = buildOrderReport(
  [row({ receivedDate: '2026-02-28', quantity: 3 }), row({ receivedDate: '2026-03-01', quantity: 9 })],
  'month',
  '2026-03-31',
  '2026-03-31',
)
assert.deepEqual(clampedMonth.previousRange, { from: '2026-02-01', to: '2026-02-28' })
assert.deepEqual(clampedMonth.previousTotals, { orders: 1, pieces: 3 })

// month: 28-day February has no W5; leap February has W5 of one day
const february = buildOrderReport(
  [row({ receivedDate: '2026-02-28' }), row({ orderId: 'x', receivedDate: '2026-01-31' })],
  'month',
  '2026-02-10',
  '2026-10-05',
)
assert.deepEqual(february.range, { from: '2026-02-01', to: '2026-02-28' })
assert.deepEqual(february.previousRange, { from: '2026-01-01', to: '2026-01-31' })
assert.deepEqual(february.series.map((entry) => entry.label), ['W1', 'W2', 'W3', 'W4'])
assert.deepEqual(february.series[3], { from: '2026-02-22', to: '2026-02-28', label: 'W4', orders: 1 })
assert.deepEqual(february.previousTotals, { orders: 1, pieces: 1 })

const leapFebruary = buildOrderReport([row({ receivedDate: '2028-02-29' })], 'month', '2028-02-29', '2026-10-05')
assert.deepEqual(leapFebruary.range, { from: '2028-02-01', to: '2028-02-29' })
assert.deepEqual(leapFebruary.series.at(-1), { from: '2028-02-29', to: '2028-02-29', label: 'W5', orders: 1 })

const thirtyDay = buildOrderReport([], 'month', '2026-04-15', '2026-10-05')
assert.deepEqual(thirtyDay.series.at(-1), { from: '2026-04-29', to: '2026-04-30', label: 'W5', orders: 0 })

// month in January: previous month is December of the prior year
const january = buildOrderReport([], 'month', '2026-01-15', '2026-10-05')
assert.deepEqual(january.previousRange, { from: '2025-12-01', to: '2025-12-31' })

// cancelled in month counts only inside the range
const monthCancelled = buildOrderReport(
  [
    row({ orderId: 'a', status: 'CANCELLED', receivedDate: '2026-10-31' }),
    row({ orderId: 'b', status: 'CANCELLED', receivedDate: '2026-11-01' }),
  ],
  'month',
  '2026-10-05',
  '2026-10-05',
)
assert.deepEqual(monthCancelled.totals, { orders: 0, pieces: 0, cancelled: 1 })

// sevenDayAverage: always the 7 days ending at date, 1 decimal, independent of period
const averageRows = (count: number) =>
  Array.from({ length: count }, (_, index) => row({ orderId: `a${index}`, receivedDate: '2026-10-03' }))
assert.equal(buildOrderReport(averageRows(1), 'day', '2026-10-05', '2026-10-05').sevenDayAverage, 0.1)
assert.equal(buildOrderReport(averageRows(2), 'day', '2026-10-05', '2026-10-05').sevenDayAverage, 0.3)
assert.equal(buildOrderReport(averageRows(3), 'day', '2026-10-05', '2026-10-05').sevenDayAverage, 0.4)
assert.equal(buildOrderReport(averageRows(7), 'month', '2026-10-05', '2026-10-05').sevenDayAverage, 1)
assert.equal(buildOrderReport(averageRows(10), 'week', '2026-10-05', '2026-10-05').sevenDayAverage, 1.4)
assert.equal(buildOrderReport(averageRows(10), 'day', '2026-10-10', '2026-10-05').sevenDayAverage, 0)
assert.equal(buildOrderReport(averageRows(10), 'day', '2026-10-02', '2026-10-05').sevenDayAverage, 0)

// days: per-day detail for day and week, empty for month
assert.deepEqual(empty.days.map((entry) => entry.date), [
  '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05',
])
assert.ok(empty.days.every((entry) => entry.sevenDayAverage === 0 && entry.totals.orders === 0))
assert.deepEqual(octoberReport.days, [])
assert.deepEqual(february.days, [])
assert.deepEqual(weekReport.days.map((entry) => entry.date), weekReport.series.map((entry) => entry.from))
assert.deepEqual(weekReport.days.map((entry) => entry.totals.orders), weekReport.series.map((entry) => entry.orders))
assert.deepEqual(dayReport.days.map((entry) => entry.date), weekReport.days.map((entry) => entry.date))

const daysRows = [
  row({ orderId: 'p1', receivedDate: '2026-10-05', status: 'PENDING', serviceType: 'WSIR', quantity: 3 }),
  row({ orderId: 'p2', receivedDate: '2026-10-05', status: 'APPROVED', serviceType: 'XYZ', quantity: null }),
  row({ orderId: 'p3', receivedDate: '2026-10-05', status: 'COMPLETED', serviceType: 'IRON', quantity: 4 }),
  row({ orderId: 'p4', receivedDate: '2026-10-05', status: 'CANCELLED', serviceType: 'WASH', quantity: 50 }),
  row({ orderId: 'q1', receivedDate: '2026-10-03', status: 'RECEIVED', serviceType: 'DRCL', quantity: 2 }),
  row({ orderId: 'q2', receivedDate: '2026-10-03', status: 'CANCELLED', quantity: 9 }),
  row({ orderId: 'q3', receivedDate: '2026-10-03', status: 'WEIRD', serviceType: null, quantity: 1 }),
  row({ orderId: 'r1', receivedDate: '2026-09-29', status: 'PENDING', quantity: 6 }),
  row({ orderId: 'r2', receivedDate: '2026-09-28', status: 'PENDING', quantity: 60 }),
  row({ orderId: 'r3', receivedDate: '2026-10-06', status: 'PENDING', quantity: 70 }),
]
const detail = buildOrderReport(daysRows, 'week', '2026-10-05', '2026-10-05')
assert.equal(detail.days.length, 7)
for (const entry of detail.days) {
  const single = buildOrderReport(daysRows, 'day', entry.date, '2026-10-05')
  assert.deepEqual(entry.totals, single.totals, entry.date)
  assert.deepEqual(entry.status, single.status, entry.date)
  assert.deepEqual(entry.byService, single.byService, entry.date)
  assert.equal(entry.sevenDayAverage, single.sevenDayAverage, entry.date)
  assert.deepEqual(Object.keys(entry), ['date', 'totals', 'status', 'byService', 'sevenDayAverage'])
  assert.deepEqual(entry.byService.map((service) => service.serviceType), SERVICES)
}
assert.deepEqual(buildOrderReport(daysRows, 'day', '2026-10-05', '2026-10-05').days, detail.days)

const latest = detail.days[6]!
assert.equal(latest.date, '2026-10-05')
assert.deepEqual(latest.totals, { orders: 3, pieces: 7, cancelled: 1 })
assert.deepEqual(latest.status, { pending: 1, inProgress: 1, completed: 1 })
assert.deepEqual(latest.byService, [
  { serviceType: 'WSIR', orders: 1, pieces: 3 },
  { serviceType: 'DRCL', orders: 0, pieces: 0 },
  { serviceType: 'IRON', orders: 1, pieces: 4 },
  { serviceType: 'WASH', orders: 0, pieces: 0 },
  { serviceType: 'OTHER', orders: 1, pieces: 0 },
])
assert.equal(latest.sevenDayAverage, 0.9)

const earlier = detail.days[4]!
assert.equal(earlier.date, '2026-10-03')
assert.deepEqual(earlier.totals, { orders: 2, pieces: 3, cancelled: 1 })
assert.deepEqual(earlier.status, { pending: 0, inProgress: 1, completed: 0 })
assert.equal(earlier.byService[4]?.orders, 1)
assert.equal(earlier.sevenDayAverage, 0.6)

const firstDay = detail.days[0]!
assert.equal(firstDay.date, '2026-09-29')
assert.equal(firstDay.sevenDayAverage, 0.3)

for (const report of [dayReport, weekReport, octoberReport, february, statusReport, detail]) {
  assert.deepEqual(orderReportResponseSchema.parse(report), report)
  assert.deepEqual(report.byService.map((entry) => entry.serviceType), SERVICES)
}

console.log('order-report aggregate dry test passed')
