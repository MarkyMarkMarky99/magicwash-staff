import assert from 'node:assert/strict'
import {
  addSheetDateDays,
  formatSheetDate,
  formatSheetDateTime,
  getBangkokClock,
  getSheetDateCalendar,
  normalizeSheetDate,
  sheetDateDaysBetween,
} from '../../../../../src/shared/utils/sheet-date.ts'

function test(name: string, run: () => void): void {
  run()
  console.log(`✓ ${name}`)
}

test('normalizes civil GViz and legacy display dates without timezone shifts', () => {
  assert.equal(normalizeSheetDate('Date(2025,9,27)'), '2025-10-27')
  assert.equal(normalizeSheetDate('27 Oct 2025'), '2025-10-27')
  assert.equal(normalizeSheetDate('2025-10-27'), '2025-10-27')
})

test('normalizes GViz and sheet datetimes using Bangkok date semantics', () => {
  assert.equal(normalizeSheetDate('Date(2025,9,27,23,59,59)'), '2025-10-27')
  assert.equal(normalizeSheetDate('2025-10-27 23:59:59'), '2025-10-27')
  assert.equal(normalizeSheetDate('2025-10-27T18:00:00Z'), '2025-10-28')
})

test('formats invoice/order dates and payment instants through the shared utility', () => {
  assert.equal(formatSheetDate('2025-10-27'), '27 Oct 2025')
  assert.equal(formatSheetDateTime('2025-10-27 13:45:00'), '27 Oct 2025, 13:45')
  assert.equal(formatSheetDateTime('2025-10-27T18:00:00Z'), '28 Oct 2025, 01:00')
})

test('rejects malformed and impossible values', () => {
  assert.equal(normalizeSheetDate('Date(2025,9,27,1,2)'), null)
  assert.equal(normalizeSheetDate('Date(2025,1,31)'), null)
  assert.equal(normalizeSheetDate('2025-02-30'), null)
  assert.equal(normalizeSheetDate('2025-10-27Tnot-a-timestamp'), null)
})

test('adds calendar days to civil input without relying on host timezone', () => {
  assert.equal(addSheetDateDays('2025-12-31', 1), '2026-01-01')
  assert.equal(addSheetDateDays('2024-02-29', 1), '2024-03-01')
  assert.equal(sheetDateDaysBetween('2026-01-01', '2025-12-31'), 1)
  assert.deepEqual(getSheetDateCalendar('2025-10-27'), {
    iso: '2025-10-27', year: 2025, month: 10, day: 27, weekday: 1,
  })
})

test('reads current clock values in Bangkok rather than the host timezone', () => {
  assert.deepEqual(getBangkokClock(new Date('2025-10-27T18:00:00Z')), {
    date: '2025-10-28', weekday: 2, minutes: 60,
  })
})
