import assert from 'node:assert/strict'
import { normalizeSheetTimestamp } from '../../../../../shared/utils/bangkok-datetime.js'

const cases = [
  ['2026-07-13T11:00:23.534631+00:00', '2026-07-13 18:00:23'],
  ['2026-07-13T11:00:23Z', '2026-07-13 18:00:23'],
  ['2026-08-27 17:58:33', '2026-08-27 17:58:33'],
  ['Date(2026,7,25,12,0,0)', '2026-08-25 12:00:00'],
  ['', ''],
  [null, ''],
] as const

for (const [input, expected] of cases) {
  const output = normalizeSheetTimestamp(input)
  assert.equal(output, expected)
  assert.equal(output.includes('T'), false)
  assert.equal(output.includes('Z'), false)
  assert.equal(output.includes('+'), false)
}

console.log('bangkok datetime dry test passed')
