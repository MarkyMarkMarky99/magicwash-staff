import assert from 'node:assert/strict'
import type { OrderReportDto } from '@/data/order-reports/order-report.service'
import {
  barHeights,
  canStepForward,
  changePercent,
  chartBars,
  completionNote,
  dayOrderCounts,
  dayTiles,
  parseReportQuery,
  percentOf,
  reportQueryFor,
  serviceRows,
  shiftDate,
  stepDate,
  tileLabel,
} from '@/features/order-reports/utils/order-report'

const TODAY = '2026-10-05'

assert.equal(shiftDate('2026-10-05', -6), '2026-09-29')
assert.equal(shiftDate('2026-03-01', -1), '2026-02-28')
assert.equal(shiftDate('2026-12-31', 1), '2027-01-01')
assert.deepEqual(dayTiles(TODAY), [
  '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05',
])

assert.deepEqual(parseReportQuery({}, TODAY), { period: 'day', date: TODAY })
assert.deepEqual(parseReportQuery({ period: 'week', date: '2026-09-28' }, TODAY), { period: 'week', date: '2026-09-28' })
assert.deepEqual(parseReportQuery({ period: ['month', 'day'], date: ['2026-08-01'] }, TODAY), { period: 'month', date: '2026-08-01' })
assert.deepEqual(parseReportQuery({ period: 'year', date: '2026-10-04' }, TODAY), { period: 'day', date: '2026-10-04' })
assert.deepEqual(parseReportQuery({ period: 'week', date: 'nope' }, TODAY), { period: 'week', date: TODAY })
assert.deepEqual(parseReportQuery({ period: 'week', date: '2026-02-30' }, TODAY), { period: 'week', date: TODAY })
assert.deepEqual(parseReportQuery({ period: 'week', date: '2026-10-06' }, TODAY), { period: 'week', date: TODAY })
assert.deepEqual(parseReportQuery({ period: 'day', date: '2026-09-28' }, TODAY), { period: 'day', date: TODAY })
assert.deepEqual(parseReportQuery({ period: 'day', date: '2026-09-29' }, TODAY), { period: 'day', date: '2026-09-29' })
assert.deepEqual(parseReportQuery({ period: 'month', date: '2026-01-15' }, TODAY), { period: 'month', date: '2026-01-15' })
assert.deepEqual(parseReportQuery({ date: 5 }, TODAY), { period: 'day', date: TODAY })

assert.deepEqual(reportQueryFor({ period: 'day', date: TODAY }, TODAY), { period: undefined, date: undefined })
assert.deepEqual(reportQueryFor({ period: 'week', date: '2026-09-28' }, TODAY), { period: 'week', date: '2026-09-28' })
assert.deepEqual(reportQueryFor({ period: 'month', date: TODAY }, TODAY), { period: 'month', date: undefined })

assert.equal(canStepForward('day', TODAY, TODAY), false)
assert.equal(canStepForward('week', TODAY, TODAY), false)
assert.equal(canStepForward('week', '2026-10-04', TODAY), true)
assert.equal(canStepForward('month', '2026-10-01', TODAY), false)
assert.equal(canStepForward('month', '2026-09-30', TODAY), true)

assert.equal(stepDate('week', TODAY, -1, TODAY), '2026-09-28')
assert.equal(stepDate('week', '2026-09-28', 1, TODAY), TODAY)
assert.equal(stepDate('week', '2026-10-02', 1, TODAY), TODAY)
assert.equal(stepDate('month', TODAY, -1, TODAY), '2026-09-01')
assert.equal(stepDate('month', '2026-09-01', 1, TODAY), TODAY)
assert.equal(stepDate('month', '2026-01-01', -1, TODAY), '2025-12-01')
assert.equal(stepDate('month', '2025-12-01', 1, TODAY), '2026-01-01')

assert.equal(percentOf(3, 8), 38)
assert.equal(percentOf(0, 0), 0)
assert.equal(percentOf(5, 3), 100)
assert.equal(changePercent(48, 43), '+12%')
assert.equal(changePercent(40, 50), '-20%')
assert.equal(changePercent(10, 10), '0%')
assert.equal(changePercent(5, 0), null)
assert.deepEqual(barHeights([0, 5, 10], 118), [4, 59, 118])
assert.deepEqual(barHeights([0, 0], 118), [4, 4])
assert.equal(tileLabel(TODAY, TODAY), 'Today, Oct 5')
assert.equal(tileLabel('2026-10-04', TODAY), 'Sun, Oct 4')

const report = (overrides: Partial<OrderReportDto>): OrderReportDto => ({
  period: 'day',
  date: TODAY,
  range: { from: TODAY, to: TODAY },
  previousRange: { from: '2026-10-04', to: '2026-10-04' },
  totals: { orders: 8, pieces: 1204.5, cancelled: 1 },
  previousTotals: { orders: 5, pieces: 60 },
  status: { pending: 1, inProgress: 3, completed: 4 },
  byService: [
    { serviceType: 'WSIR', orders: 4, pieces: 54 },
    { serviceType: 'DRCL', orders: 2, pieces: 13 },
    { serviceType: 'IRON', orders: 2, pieces: 37 },
    { serviceType: 'WASH', orders: 0, pieces: 0 },
    { serviceType: 'OTHER', orders: 0, pieces: 0 },
  ],
  series: [
    { from: '2026-10-04', to: '2026-10-04', label: 'Sun', orders: 3 },
    { from: TODAY, to: TODAY, label: 'Mon', orders: 8 },
  ],
  sevenDayAverage: 6.3,
  ...overrides,
})

assert.equal(completionNote(report({})), '1,204.5 pieces · 1 cancelled · 127% of 7-day average (6.3)')
assert.equal(completionNote(report({ sevenDayAverage: 0 })), '1,204.5 pieces · 1 cancelled')
assert.equal(completionNote(report({ period: 'week' })), '1,204.5 pieces · 1 cancelled')
assert.equal(completionNote(report({ period: 'month' })), '1,204.5 pieces · 1 cancelled')

assert.deepEqual(serviceRows(report({})).map((row) => [row.key, row.label, row.orders, row.width]), [
  ['WSIR', 'Wash & iron', 4, 50],
  ['DRCL', 'Dry cleaning', 2, 25],
  ['IRON', 'Iron only', 2, 25],
  ['WASH', 'Wash only', 0, 0],
])
const withOther = report({
  byService: [...report({}).byService.slice(0, 4), { serviceType: 'OTHER', orders: 1, pieces: 2 }],
})
assert.equal(serviceRows(withOther).at(-1)?.label, 'Other')

assert.deepEqual(chartBars(report({}), TODAY).map((bar) => [bar.label, bar.value, bar.highlight]), [
  ['Sun', 3, false],
  ['Mon', 8, true],
])
const month = report({
  period: 'month',
  series: [
    { from: '2026-10-01', to: '2026-10-07', label: 'W1', orders: 20 },
    { from: '2026-10-08', to: '2026-10-14', label: 'W2', orders: 0 },
  ],
})
assert.deepEqual(chartBars(month, TODAY).map((bar) => bar.highlight), [true, false])
assert.deepEqual(chartBars(month, '2026-09-01').map((bar) => bar.highlight), [false, false])

assert.deepEqual([...dayOrderCounts(report({}))], [['2026-10-04', 3], [TODAY, 8]])
assert.deepEqual([...dayOrderCounts(month)], [])
