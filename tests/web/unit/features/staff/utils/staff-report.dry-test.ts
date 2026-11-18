import assert from 'node:assert/strict'
import {
  assignmentAccess,
  dayRing,
  dayStats,
  departmentBreakdown,
  versusAverageNote,
  weekBars,
} from '@/features/staff/utils/staff-report'

assert.deepEqual(dayRing(120, 150), { percentage: 80, completed: 120, total: 150, label: '120', caption: 'Work score', countText: '120 of 150 min' })
assert.equal(dayRing(300, 150).percentage, 100)
assert.deepEqual(dayRing(40, 0), { percentage: 0, completed: 40, total: 0, label: '40', caption: 'Work score', countText: '40 min' })

assert.equal(versusAverageNote(0, 150), 'No work recorded')
assert.equal(versusAverageNote(30, 0), 'First day with work this week')
assert.equal(versusAverageNote(75, 150), '50% of 7-day average (150 min)')

assert.deepEqual(dayStats(3, 1, 4, 150).map((stat) => [stat.key, stat.value, stat.share, stat.tone]), [
  ['jobs', 3, 100, 'info'],
  ['rank', '#1', 100, 'lime'],
  ['average', 150, 100, 'warning'],
])
assert.deepEqual(dayStats(0, 0, 4, 0).map((stat) => [stat.value, stat.share]), [[0, 0], ['–', 0], [0, 0]])
assert.equal(dayStats(1, 4, 4, 10)[1]!.share, 25)
assert.equal(dayStats(1, 2, 4, 10)[1]!.label, 'Rank of 4 that day')

assert.deepEqual(departmentBreakdown(
  { minutes: 100, byDepartment: [{ department: 'Ironing', jobs: 3, minutes: 75 }, { department: null, jobs: 1, minutes: 25 }] },
  { Ironing: 'Ironing' },
), [
  { key: 'Ironing', label: 'Ironing', detail: '3 jobs', value: 75, width: 75 },
  { key: 'other', label: 'Other', detail: '1 jobs', value: 25, width: 25 },
])
assert.equal(departmentBreakdown({ minutes: 0, byDepartment: [{ department: 'Ironing', jobs: 1, minutes: 0 }] }, {})[0]!.width, 0)
assert.equal(departmentBreakdown({ minutes: 5, byDepartment: [{ department: 'Washing', jobs: 1, minutes: 5 }] }, {})[0]!.label, 'Washing')

assert.deepEqual(weekBars(['2026-10-04', '2026-10-05'], [0, 12], '2026-10-05'), [
  { key: '2026-10-04', label: 'Sun', value: 0, highlight: false },
  { key: '2026-10-05', label: 'Mon', value: 12, highlight: true },
])

assert.deepEqual(assignmentAccess('admin', 'a1', 'b2'), { visible: true, staffId: 'b2' })
assert.deepEqual(assignmentAccess('admin', 'a1', 'a1'), { visible: true, staffId: 'a1' })
assert.deepEqual(assignmentAccess('staff', 'b2', 'b2'), { visible: true, staffId: null })
assert.deepEqual(assignmentAccess('staff', 'a1', 'b2'), { visible: false, staffId: null })
assert.deepEqual(assignmentAccess('device', 'd1', 'd1'), { visible: false, staffId: null })
assert.deepEqual(assignmentAccess(null, null, 'b2'), { visible: false, staffId: null })

console.log('staff-report dry test passed')
