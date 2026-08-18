import assert from 'node:assert/strict'
import { z } from 'zod'
import type { SheetContract } from '../../../../../server/shared/contracts/sheet-contract.js'
import type { SheetHeaderMap } from '../../../../../server/shared/repositories/sheet-header-map.js'
import { SheetRepository } from '../../../../../server/shared/repositories/sheet.repository.js'
import { buildSheetHeaderMap } from '../../../../../server/shared/repositories/sheet-header-map.js'
import { DuplicateRowKeyError } from '../../../../../server/shared/repositories/sheet-row-lookup.js'
import {
  DuplicatePrimaryKeyError,
  SheetsApiClient,
  WriteRejectedError,
  type SheetsApiAppendResponse,
  type SheetsApiValues,
} from '../../../../../server/shared/repositories/sheets-api.client.js'

process.env.TEST_SPREADSHEET_ID = 'spreadsheet-id'

const batchRowSchema = z.object({
  AppendID: z.string(),
  Label: z.string(),
})

type BatchRow = z.infer<typeof batchRowSchema>

const batchContract = {
  row: batchRowSchema,
  primaryKey: 'AppendID',
  sheetName: 'BatchAppendPreflight',
  spreadsheetId: 'TEST_SPREADSHEET_ID',
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract

const headerMap = buildSheetHeaderMap(
  ['AppendID', 'Label'],
  Object.keys(batchRowSchema.shape),
  'AppendID',
)

type MockCall = { method: 'readColumn' | 'appendRows'; args: readonly unknown[] }

function appendResponse(values: SheetsApiValues): SheetsApiAppendResponse {
  return {
    spreadsheetId: 'spreadsheet-id',
    updates: {
      updatedRows: values.length,
      updatedData: { values },
    },
  }
}

function mockClient(options: {
  calls: MockCall[]
  readColumn: SheetsApiClient['readColumn']
  appendRows: SheetsApiClient['appendRows']
}): SheetsApiClient {
  return {
    readColumn: async (columnLetter: string) => {
      options.calls.push({ method: 'readColumn', args: [columnLetter] })
      return options.readColumn(columnLetter)
    },
    appendRows: async (...args: Parameters<SheetsApiClient['appendRows']>) => {
      options.calls.push({ method: 'appendRows', args })
      return options.appendRows(...args)
    },
  } as unknown as SheetsApiClient
}

function batchRepository(
  client: SheetsApiClient,
  loadHeaderMap: () => Promise<SheetHeaderMap> = async () => headerMap,
): SheetRepository<BatchRow> {
  return new SheetRepository<BatchRow>({
    contract: batchContract,
    sheetsApiClient: client,
    sheetHeaderMapLoader: { load: loadHeaderMap },
  })
}

type DryTest = { name: string; run: () => Promise<void> }
const tests: DryTest[] = []

function test(name: string, run: () => Promise<void>): void {
  tests.push({ name, run })
}

test('a keyed batch performs one primary-key-column read, no per-key reads, and one append', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    readColumn: async () => [['AppendID'], ['unrelated-1'], ['unrelated-2']],
    appendRows: async () => appendResponse([
      ['incoming-1', 'one'],
      ['incoming-2', 'two'],
      ['incoming-3', 'three'],
    ]),
  })

  const returned = await batchRepository(client).batchAppend([
    { AppendID: 'incoming-1', Label: 'one' },
    { AppendID: 'incoming-2', Label: 'two' },
    { AppendID: 'incoming-3', Label: 'three' },
  ])

  assert.deepEqual(returned, [
    { AppendID: 'incoming-1', Label: 'one' },
    { AppendID: 'incoming-2', Label: 'two' },
    { AppendID: 'incoming-3', Label: 'three' },
  ])
  assert.deepEqual(calls.map((call) => call.method), ['readColumn', 'appendRows'])
  assert.deepEqual(calls[0]?.args, ['A'])
  assert.equal(calls.filter((call) => call.method === 'readColumn').length, 1)
  assert.equal(calls.filter((call) => call.method === 'appendRows').length, 1)
})

test('batch key validation consumes the returned key collection linearly overall as incoming keys grow', async () => {
  const existingCount = 64
  const incomingCount = 32
  let rowReads = 0
  const existingRows: SheetsApiValues = [
    ['AppendID'],
    ...Array.from({ length: existingCount }, (_, index) => [`existing-${index}`]),
  ]
  const instrumentedRows = new Proxy(existingRows, {
    get(target, property, receiver) {
      if (typeof property === 'string' && /^\d+$/.test(property)) {
        rowReads += 1
      }
      return Reflect.get(target, property, receiver)
    },
  })
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    readColumn: async () => instrumentedRows,
    appendRows: async () => appendResponse(
      Array.from({ length: incomingCount }, (_, index) => [`incoming-${index}`, `label-${index}`]),
    ),
  })

  await batchRepository(client).batchAppend(
    Array.from({ length: incomingCount }, (_, index) => ({
      AppendID: `incoming-${index}`,
      Label: `label-${index}`,
    })),
  )

  // A single scan is O(N), and checking K incoming keys against its index is
  // O(K). This bound rejects the former K full rescans without using timing.
  const maxLinearReads = existingRows.length * 3 + incomingCount * 2 + 16
  assert.ok(
    rowReads <= maxLinearReads,
    `expected linear key-row consumption, observed ${rowReads} accesses`,
  )
  assert.equal(calls.filter((call) => call.method === 'readColumn').length, 1)
})

test('an empty batch performs zero primary-key-column reads', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    readColumn: async () => {
      assert.fail('readColumn must not run for an empty batch')
      return [['AppendID']]
    },
    appendRows: async () => appendResponse([]),
  })

  await batchRepository(client).batchAppend([])

  assert.equal(calls.filter((call) => call.method === 'readColumn').length, 0)
})

test('a batch whose incoming keys are all blank performs zero primary-key-column reads', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    readColumn: async () => {
      assert.fail('readColumn must not run when every incoming key is blank')
      return [['AppendID']]
    },
    appendRows: async () => appendResponse([['', 'blank']]),
  })

  const returned = await batchRepository(client).batchAppend([{ AppendID: '', Label: 'blank' }])

  assert.deepEqual(returned, [{ AppendID: '', Label: 'blank' }])
  assert.equal(calls.filter((call) => call.method === 'readColumn').length, 0)
})

test('an intra-batch duplicate reads the key column before rejecting with the existing error class', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    readColumn: async () => [['AppendID']],
    appendRows: async () => {
      assert.fail('appendRows must not run for an intra-batch duplicate')
      return appendResponse([])
    },
  })

  await assert.rejects(
    () => batchRepository(client).batchAppend([
      { AppendID: 'same-key', Label: 'first' },
      { AppendID: 'same-key', Label: 'second' },
    ]),
    (error: unknown) => {
      assert.ok(error instanceof DuplicatePrimaryKeyError)
      assert.ok(error instanceof WriteRejectedError)
      assert.equal(error.certainty, 'rejected')
      return true
    },
  )
  assert.deepEqual(calls, [{ method: 'readColumn', args: ['A'] }])
})

test('one existing data-row match rejects with DuplicatePrimaryKeyError before append', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    readColumn: async () => [['AppendID'], ['existing-key']],
    appendRows: async () => {
      assert.fail('appendRows must not run for an existing duplicate')
      return appendResponse([])
    },
  })

  await assert.rejects(
    () => batchRepository(client).batchAppend([{ AppendID: 'existing-key', Label: 'duplicate' }]),
    (error: unknown) => {
      assert.ok(error instanceof DuplicatePrimaryKeyError)
      assert.ok(error instanceof WriteRejectedError)
      assert.equal(error.certainty, 'rejected')
      return true
    },
  )
  assert.deepEqual(calls, [{ method: 'readColumn', args: ['A'] }])
})

test('multiple existing matches preserve the dirty duplicate-row error', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    readColumn: async () => [['AppendID'], ['dirty-key'], ['dirty-key']],
    appendRows: async () => {
      assert.fail('appendRows must not run for dirty existing data')
      return appendResponse([])
    },
  })

  await assert.rejects(
    () => batchRepository(client).batchAppend([{ AppendID: 'dirty-key', Label: 'duplicate' }]),
    (error: unknown) => {
      assert.ok(error instanceof DuplicateRowKeyError)
      assert.ok(!(error instanceof DuplicatePrimaryKeyError))
      assert.ok(!(error instanceof WriteRejectedError))
      assert.match(error.message, /AppendID/)
      assert.match(error.message, /dirty-key/)
      return true
    },
  )
  assert.deepEqual(calls, [{ method: 'readColumn', args: ['A'] }])
})

test('unrelated duplicate existing keys do not reject a nonmatching batch', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    readColumn: async () => [['AppendID'], ['unrelated'], ['unrelated']],
    appendRows: async () => appendResponse([
      ['new-1', 'one'],
      ['new-2', 'two'],
    ]),
  })

  const returned = await batchRepository(client).batchAppend([
    { AppendID: 'new-1', Label: 'one' },
    { AppendID: 'new-2', Label: 'two' },
  ])

  assert.deepEqual(returned, [
    { AppendID: 'new-1', Label: 'one' },
    { AppendID: 'new-2', Label: 'two' },
  ])
  assert.deepEqual(calls.map((call) => call.method), ['readColumn', 'appendRows'])
})

test('header-only matches and existing numeric keys preserve current normalization semantics', async () => {
  const headerCalls: MockCall[] = []
  const headerClient = mockClient({
    calls: headerCalls,
    readColumn: async () => [['AppendID'], ['other-key']],
    appendRows: async () => appendResponse([['AppendID', 'header-value']]),
  })

  await batchRepository(headerClient).batchAppend([{ AppendID: 'AppendID', Label: 'header-value' }])
  assert.deepEqual(headerCalls.map((call) => call.method), ['readColumn', 'appendRows'])

  const numericCalls: MockCall[] = []
  const numericClient = mockClient({
    calls: numericCalls,
    readColumn: async () => [['AppendID'], [1001]],
    appendRows: async () => {
      assert.fail('appendRows must not run for a normalized numeric duplicate')
      return appendResponse([])
    },
  })

  await assert.rejects(
    () => batchRepository(numericClient).batchAppend([{ AppendID: '1001', Label: 'numeric' }]),
    (error: unknown) => {
      assert.ok(error instanceof DuplicatePrimaryKeyError)
      return true
    },
  )
  assert.deepEqual(numericCalls, [{ method: 'readColumn', args: ['A'] }])
})

test('a nonmatching batch appends unchanged full-width rows once after the key read', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    readColumn: async () => [['AppendID']],
    appendRows: async (rows, valueInputOption) => {
      assert.equal(valueInputOption, 'USER_ENTERED')
      assert.deepEqual(rows, [
        ['new-1', 'one'],
        ['new-2', 'two'],
      ])
      return appendResponse([
        ['new-1', 'one'],
        ['new-2', 'two'],
      ])
    },
  })

  const returned = await batchRepository(client).batchAppend([
    { AppendID: 'new-1', Label: 'one' },
    { AppendID: 'new-2', Label: 'two' },
  ])

  assert.deepEqual(returned, [
    { AppendID: 'new-1', Label: 'one' },
    { AppendID: 'new-2', Label: 'two' },
  ])
  assert.deepEqual(calls.map((call) => call.method), ['readColumn', 'appendRows'])
})

let failures = 0
for (const currentTest of tests) {
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

console.log(`passed - ${tests.length} sheet repository batch preflight dry-tests`)
