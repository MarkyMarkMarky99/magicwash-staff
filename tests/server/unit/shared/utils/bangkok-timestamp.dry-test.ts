import assert from 'node:assert/strict'

import { formatBangkokTimestamp } from '../../../../../server/shared/utils/bangkok-timestamp.js'

type DryTest = { readonly name: string; readonly run: () => Promise<void> }
const tests: DryTest[] = []

function test(name: string, run: () => Promise<void>): void {
  tests.push({ name, run })
}

test('formats the known SheetLib Bangkok timestamp', async () => {
  assert.equal(
    formatBangkokTimestamp(new Date('2026-04-01T00:34:56.000Z')),
    '2026-04-01 07:34:56',
  )
})

test('crosses the UTC day boundary when shifted to Bangkok', async () => {
  assert.equal(
    formatBangkokTimestamp(new Date('2026-03-31T18:00:00.000Z')),
    '2026-04-01 01:00:00',
  )
})

test('preserves the final second of the Bangkok calendar day', async () => {
  assert.equal(
    formatBangkokTimestamp(new Date('2026-12-31T16:59:59.000Z')),
    '2026-12-31 23:59:59',
  )
})

const orderedTests = process.env.REVERSE_TESTS === '1' ? [...tests].reverse() : tests
let failures = 0

for (const currentTest of orderedTests) {
  try {
    await currentTest.run()
    console.log(`ok - ${currentTest.name}`)
  } catch (error: unknown) {
    failures += 1
    console.error(`not ok - ${currentTest.name}`)
    console.error(error)
  }
}

if (failures !== 0) {
  throw new Error(`${failures} dry-test(s) failed.`)
}

console.log(`passed - ${orderedTests.length} Bangkok timestamp dry-tests`)
