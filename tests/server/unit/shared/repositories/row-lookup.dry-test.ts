import assert from 'node:assert/strict'

import {
  DuplicateRowKeyError,
  findRowNumberByKey,
} from '../../../../../server/shared/repositories/sheet-row-lookup.js'
import {
  buildSheetHeaderMap,
  SheetHeaderMapError,
} from '../../../../../server/shared/repositories/sheet-header-map.js'

type DryTest = { readonly name: string; readonly run: () => Promise<void> }
const tests: DryTest[] = []

function test(name: string, run: () => Promise<void>): void {
  tests.push({ name, run })
}

test('returns the real row number for the first data row and resolves its column letter', async () => {
  const headerMap = buildSheetHeaderMap(['Name', 'OrderID'], ['Name', 'OrderID'], 'OrderID')
  let requestedColumn = ''

  const rowNumber = await findRowNumberByKey(
    headerMap,
    'OrderID',
    'order-1',
    async (columnLetter) => {
      requestedColumn = columnLetter
      return [['OrderID'], ['order-1'], ['order-2']]
    },
  )

  assert.equal(requestedColumn, 'B')
  assert.equal(rowNumber, 2)
})

test('returns the real row number for the last returned data row', async () => {
  const headerMap = buildSheetHeaderMap(['OrderID'], ['OrderID'], 'OrderID')

  const rowNumber = await findRowNumberByKey(
    headerMap,
    'OrderID',
    'order-2',
    async () => [['OrderID'], ['order-1'], ['order-2']],
  )

  assert.equal(rowNumber, 3)
})

test('returns null when the key is not found', async () => {
  const headerMap = buildSheetHeaderMap(['OrderID'], ['OrderID'], 'OrderID')

  const rowNumber = await findRowNumberByKey(
    headerMap,
    'OrderID',
    'missing',
    async () => [['OrderID'], ['order-1']],
  )

  assert.equal(rowNumber, null)
})

test('does not match a key that only appears in the header row', async () => {
  const headerMap = buildSheetHeaderMap(['OrderID'], ['OrderID'], 'OrderID')

  const rowNumber = await findRowNumberByKey(
    headerMap,
    'OrderID',
    'OrderID',
    async () => [['OrderID'], ['order-1']],
  )

  assert.equal(rowNumber, null)
})

test('normalizes numeric sheet values and requested keys before comparing', async () => {
  const headerMap = buildSheetHeaderMap(['OrderID'], ['OrderID'], 'OrderID')

  const rowNumber = await findRowNumberByKey(
    headerMap,
    'OrderID',
    '1001',
    async () => [['OrderID'], [1001]],
  )

  assert.equal(rowNumber, 2)
})

test('throws with the colliding rows when a key is duplicated', async () => {
  const headerMap = buildSheetHeaderMap(['OrderID'], ['OrderID'], 'OrderID')

  await assert.rejects(
    () => findRowNumberByKey(
      headerMap,
      'OrderID',
      'order-1',
      async () => [['OrderID'], ['order-1'], ['order-2'], ['order-1']],
    ),
    (error: unknown) => {
      assert.ok(error instanceof DuplicateRowKeyError)
      assert.match(error.message, /OrderID/)
      assert.match(error.message, /order-1/)
      assert.match(error.message, /2, 4/)
      return true
    },
  )
})

test('rejects a key column that is missing from the header map before reading', async () => {
  const headerMap = buildSheetHeaderMap(['OrderID'], ['OrderID'], 'OrderID')
  let readCalled = false

  await assert.rejects(
    () => findRowNumberByKey(
      headerMap,
      'MissingID',
      'order-1',
      async () => {
        readCalled = true
        return [['MissingID'], ['order-1']]
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof SheetHeaderMapError)
      assert.match(error.message, /MissingID/)
      return true
    },
  )

  assert.equal(readCalled, false)
})

test('does not match an empty key and tolerates trailing blank rows being omitted', async () => {
  const headerMap = buildSheetHeaderMap(['OrderID'], ['OrderID'], 'OrderID')

  const missingRow = await findRowNumberByKey(
    headerMap,
    'OrderID',
    'missing',
    async () => [['OrderID'], ['order-1']],
  )
  const emptyKeyRow = await findRowNumberByKey(
    headerMap,
    'OrderID',
    '',
    async () => [['OrderID'], [''], ['order-1']],
  )

  assert.equal(missingRow, null)
  assert.equal(emptyKeyRow, null)
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

console.log(`passed - ${orderedTests.length} row-lookup dry-tests`)
