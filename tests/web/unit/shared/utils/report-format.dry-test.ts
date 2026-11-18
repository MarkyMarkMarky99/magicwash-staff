import assert from 'node:assert/strict'
import { barHeights, changePercent, formatCount, monthLabel, percentOf, shiftDate, shortDate, tileLabel, weekdayLabel } from '@/shared/utils/report-format'

assert.equal(shiftDate('2026-03-01', -1), '2026-02-28')
assert.equal(percentOf(1, 3), 33)
assert.equal(percentOf(5, 0), 0)
assert.equal(percentOf(9, 3), 100)
assert.equal(changePercent(48, 43), '+12%')
assert.equal(changePercent(5, 0), null)
assert.deepEqual(barHeights([0, 5, 10], 118), [4, 59, 118])
assert.equal(formatCount(1204.5), '1,204.5')
assert.equal(shortDate('2026-10-05'), 'Oct 5')
assert.equal(weekdayLabel('2026-10-05'), 'Mon')
assert.equal(monthLabel('2026-10-05'), 'October 2026')
assert.equal(tileLabel('2026-10-05', '2026-10-05'), 'Today, Oct 5')
assert.equal(tileLabel('2026-10-04', '2026-10-05'), 'Sun, Oct 4')

console.log('report-format dry test passed')
