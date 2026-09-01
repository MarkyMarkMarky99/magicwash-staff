import assert from 'node:assert/strict'
import { z } from 'zod'
import type { SheetContract } from '../../../../../server/shared/contracts/sheet-contract.js'
import type { SheetHeaderMap } from '../../../../../server/shared/repositories/sheet-header-map.js'
import { SheetRepository } from '../../../../../server/shared/repositories/sheet.repository.js'
import { buildSheetHeaderMap } from '../../../../../server/shared/repositories/sheet-header-map.js'
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

type MockCall = { method: 'appendRows'; args: readonly unknown[] }

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
  appendRows: SheetsApiClient['appendRows']
}): SheetsApiClient {
  return {
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

test('a keyed batch performs one append without a primary-key-column read', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
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
  assert.deepEqual(calls.map((call) => call.method), ['appendRows'])
})

test('an empty batch preserves the existing append path', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    appendRows: async () => appendResponse([]),
  })

  await batchRepository(client).batchAppend([])

  assert.deepEqual(calls.map((call) => call.method), ['appendRows'])
})

test('a batch whose incoming keys are all blank performs one append', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    appendRows: async () => appendResponse([['', 'blank']]),
  })

  const returned = await batchRepository(client).batchAppend([{ AppendID: '', Label: 'blank' }])

  assert.deepEqual(returned, [{ AppendID: '', Label: 'blank' }])
  assert.deepEqual(calls.map((call) => call.method), ['appendRows'])
})

test('an intra-batch duplicate rejects before any write happens', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
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
  assert.deepEqual(calls, [])
})

test('a nonmatching batch appends unchanged full-width rows once', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
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
  assert.deepEqual(calls.map((call) => call.method), ['appendRows'])
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
