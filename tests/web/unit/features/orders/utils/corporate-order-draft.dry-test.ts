import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addedLine,
  countedLineCount,
  defaultOrderDates,
  dueStubLabel,
  mergeListLines,
  parseCountInput,
  receivedLabel,
  stepCount,
  totalCounted,
  turnaround,
} from '@/features/orders/utils/corporate-order-draft'

const towel = { itemCode: 'ITM-0001', nameEn: 'Bath towel', nameTh: 'ผ้าเช็ดตัว', imageUrl: null }
const sheet = { itemCode: 'ITM-0002', nameEn: null, nameTh: 'ผ้าปูที่นอน', imageUrl: null }

test('defaults to received today and due two days later in Bangkok', () => {
  assert.deepEqual(defaultOrderDates(new Date('2026-10-13T20:00:00Z')), { receivedDate: '2026-10-14', dueDate: '2026-10-16' })
  assert.deepEqual(defaultOrderDates(new Date('2026-12-30T05:00:00Z')), { receivedDate: '2026-12-30', dueDate: '2027-01-01' })
})

test('an empty count is not counted and zero is a real count', () => {
  assert.equal(parseCountInput(''), null)
  assert.equal(parseCountInput('0'), 0)
  assert.equal(parseCountInput('a1b2'), 12)
  assert.equal(parseCountInput('123456'), 1234)
  const lines = mergeListLines([], [towel, sheet]).map((line, index) => ({ ...line, counted: [0, null][index]! }))
  assert.equal(countedLineCount(lines), 1)
  assert.equal(totalCounted(lines), 0)
})

test('stepping starts at one, floors at zero and never counts an untouched line down', () => {
  assert.equal(stepCount(null, 1), 1)
  assert.equal(stepCount(null, -1), null)
  assert.equal(stepCount(1, -1), 0)
  assert.equal(stepCount(0, -1), 0)
  assert.equal(stepCount(9999, 1), 9999)
})

test('refreshing the item list keeps counts and added lines', () => {
  const current = [
    { ...mergeListLines([], [towel])[0]!, counted: 7 },
    { ...mergeListLines([], [sheet])[0]!, counted: 3 },
    addedLine('added-1', '  Curtain ', 2),
  ]
  const merged = mergeListLines(current, [towel])
  assert.deepEqual(merged.map((line) => [line.key, line.counted, line.added]), [
    ['ITM-0001', 7, false],
    ['added-1', 2, true],
  ])
  assert.equal(merged[1]!.nameTh, 'Curtain')
  assert.equal(merged[1]!.itemCode, null)
})

test('date labels and turnaround', () => {
  assert.deepEqual(dueStubLabel('2026-10-15'), { day: '15', month: 'Thu · Oct' })
  assert.deepEqual(dueStubLabel(''), { day: '–', month: 'Set date' })
  assert.equal(receivedLabel('2026-10-13'), 'Tue 13 Oct')
  assert.deepEqual(turnaround('2026-10-13', '2026-10-15'), { label: '2 days', valid: true })
  assert.deepEqual(turnaround('2026-10-13', '2026-10-14'), { label: '1 day', valid: true })
  assert.deepEqual(turnaround('2026-10-13', '2026-10-13'), { label: 'Same day', valid: true })
  assert.deepEqual(turnaround('2026-10-13', '2026-10-12'), { label: 'Due is before received', valid: false })
  assert.deepEqual(turnaround('', '2026-10-12'), { label: 'Set both dates', valid: false })
})
