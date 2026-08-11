import assert from 'node:assert/strict'

import {
  SheetHeaderMapError,
  SheetHeaderMapResolver,
  buildRowRange,
  buildSheetHeaderMap,
  columnLetterForIndex,
} from '../../../../../server/shared/repositories/sheet-header-map.js'

type DryTest = { readonly name: string; readonly run: () => Promise<void> }
const tests: DryTest[] = []

function test(name: string, run: () => Promise<void>): void {
  tests.push({ name, run })
}

const knownColumns = ['OrderID', 'Customer', 'Status'] as const
const primaryKey = 'OrderID'

function mapFor(liveHeaders: readonly unknown[]) {
  return buildSheetHeaderMap(liveHeaders, knownColumns, primaryKey)
}

function expectSyncError(run: () => unknown, message: RegExp): void {
  let thrown: unknown
  try {
    run()
  } catch (error: unknown) {
    thrown = error
  }
  assert.ok(thrown instanceof SheetHeaderMapError)
  assert.match(thrown.message, message)
}

function deferred<T>(): {
  readonly promise: Promise<T>
  readonly resolve: (value: T) => void
  readonly reject: (error: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

test('uses the live header order for indexes and letters', async () => {
  const result = mapFor(['Status', 'OrderID', 'Customer'])

  assert.deepEqual(result.orderedHeaders, ['Status', 'OrderID', 'Customer'])
  assert.equal(result.width, 3)
  assert.deepEqual(result.indexByName, { Status: 0, OrderID: 1, Customer: 2 })
  assert.deepEqual(result.letterByName, { Status: 'A', OrderID: 'B', Customer: 'C' })
})

test('keeps unknown extra live columns and reports their width and address', async () => {
  const result = mapFor(['Status', 'ExtraLiveColumn', 'OrderID', 'Customer', '   ', ''])

  assert.deepEqual(result.orderedHeaders, ['Status', 'ExtraLiveColumn', 'OrderID', 'Customer'])
  assert.equal(result.width, 4)
  assert.equal(result.indexByName.ExtraLiveColumn, 1)
  assert.equal(result.letterByName.ExtraLiveColumn, 'B')
})

test('trims trailing empty or whitespace headers but rejects an empty header in the middle', async () => {
  const result = mapFor(['OrderID', 'Customer', 'Status', '', '  '])
  assert.deepEqual(result.orderedHeaders, ['OrderID', 'Customer', 'Status'])
  assert.equal(result.width, 3)

  expectSyncError(
    () => mapFor(['OrderID', '  ', 'Customer', 'Status']),
    /empty or whitespace-only inside/i,
  )
})

test('rejects duplicate exact live headers', async () => {
  expectSyncError(
    () => mapFor(['OrderID', 'Customer', 'Status', 'Customer']),
    /duplicate live header 'Customer'/i,
  )
})

test('rejects a known column missing from the live header', async () => {
  expectSyncError(
    () => mapFor(['OrderID', 'Customer']),
    /known column 'Status' is missing/i,
  )
})

test('rejects a primary key absent from known columns', async () => {
  expectSyncError(
    () => buildSheetHeaderMap(['OrderID', 'Customer', 'Status'], knownColumns, 'NotKnown'),
    /primary key 'NotKnown' is not present in the known columns/i,
  )
})

test('rejects a primary key missing from the live header', async () => {
  expectSyncError(
    () => buildSheetHeaderMap(['Customer', 'Status'], ['Customer', 'Status', 'OrderID'], 'OrderID'),
    /(?:known column|primary key) 'OrderID' is missing from the live header row/i,
  )
})

test('rejects a non-string header at the external boundary', async () => {
  expectSyncError(
    () => mapFor(['OrderID', 'Customer', 42, 'Status']),
    /header at index 2 must be a string/i,
  )
})

test('converts zero-based indexes through and beyond Z', async () => {
  assert.equal(columnLetterForIndex(0), 'A')
  assert.equal(columnLetterForIndex(25), 'Z')
  assert.equal(columnLetterForIndex(26), 'AA')
  assert.equal(columnLetterForIndex(51), 'AZ')
  assert.equal(columnLetterForIndex(52), 'BA')
  assert.equal(columnLetterForIndex(701), 'ZZ')
  assert.equal(columnLetterForIndex(702), 'AAA')
})

test('rejects invalid column indexes', async () => {
  for (const invalid of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    expectSyncError(
      () => columnLetterForIndex(invalid),
      /column index must be a non-negative integer/i,
    )
  }
})

test('builds full-row A1 ranges from the header width', async () => {
  assert.equal(buildRowRange(buildSheetHeaderMap(['OrderID'], ['OrderID'], 'OrderID'), 1), 'A1:A1')
  assert.equal(buildRowRange(mapFor(['OrderID', 'Customer', 'Status']), 5), 'A5:C5')

  const wideHeaders = [
    'OrderID',
    'Customer',
    'Status',
    ...Array.from({ length: 24 }, (_, index) => `Extra${index}`),
  ]
  assert.equal(buildRowRange(mapFor(wideHeaders), 12), 'A12:AA12')
})

test('rejects invalid row numbers when building a row range', async () => {
  const headerMap = mapFor(['OrderID', 'Customer', 'Status'])

  for (const invalid of [0, -1, 1.5]) {
    expectSyncError(
      () => buildRowRange(headerMap, invalid),
      /row number must be a positive integer/i,
    )
  }
})

test('rejects a zero-width header map when building a row range', async () => {
  expectSyncError(
    () => buildRowRange({
      orderedHeaders: [],
      width: 0,
      indexByName: {},
      letterByName: {},
    }, 1),
    /zero-width header map/i,
  )
})

test('resolver construction is lazy and does not read', async () => {
  let reads = 0
  const resolver = new SheetHeaderMapResolver(async () => {
    reads += 1
    return mapFor(['OrderID', 'Customer', 'Status'])
  })

  assert.equal(reads, 0)
  assert.ok(resolver)
})

test('resolver caches a successful sequential load by identity', async () => {
  let reads = 0
  const resolvedMap = mapFor(['Status', 'OrderID', 'Customer'])
  const resolver = new SheetHeaderMapResolver(async () => {
    reads += 1
    return resolvedMap
  })

  const first = await resolver.load()
  const second = await resolver.load()

  assert.equal(reads, 1)
  assert.strictEqual(first, resolvedMap)
  assert.strictEqual(second, first)
  assert.deepEqual(second.orderedHeaders, ['Status', 'OrderID', 'Customer'])
})

test('resolver coalesces concurrent first loads with an in-flight promise', async () => {
  let reads = 0
  const pending = deferred<ReturnType<typeof mapFor>>()
  const resolver = new SheetHeaderMapResolver(() => {
    reads += 1
    return pending.promise
  })

  const first = resolver.load()
  const second = resolver.load()
  assert.equal(reads, 1)
  assert.strictEqual(first, second)

  const resolvedMap = mapFor(['OrderID', 'Customer', 'Status'])
  pending.resolve(resolvedMap)
  const [firstResult, secondResult] = await Promise.all([first, second])
  assert.strictEqual(firstResult, resolvedMap)
  assert.strictEqual(secondResult, resolvedMap)
})

test('resolver clears a failed in-flight load so the next call retries', async () => {
  let reads = 0
  const firstFailure = new Error('temporary header read failure')
  const successfulMap = mapFor(['OrderID', 'Customer', 'Status'])
  const resolver = new SheetHeaderMapResolver(async () => {
    reads += 1
    if (reads === 1) {
      throw firstFailure
    }
    return successfulMap
  })

  let observedFailure: unknown
  try {
    await resolver.load()
  } catch (error: unknown) {
    observedFailure = error
  }
  assert.strictEqual(observedFailure, firstFailure)

  const retryResult = await resolver.load()
  assert.equal(reads, 2)
  assert.strictEqual(retryResult, successfulMap)
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

console.log(`passed - ${orderedTests.length} header-map dry-tests`)
