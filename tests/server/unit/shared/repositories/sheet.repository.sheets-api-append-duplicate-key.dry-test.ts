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

// This file pins the pre-write duplicate primary key guard for both append
// paths. The batch path must validate all prepared rows before its one write,
// including duplicate keys that are not in the sheet yet.

process.env.TEST_SPREADSHEET_ID = 'spreadsheet-id'

const appendRowSchema = z.object({
  AppendID: z.string(),
  Label: z.string(),
})

type AppendRow = z.infer<typeof appendRowSchema>

const appendContract = {
  row: appendRowSchema,
  primaryKey: 'AppendID',
  sheetName: 'AppendDuplicateKey',
  spreadsheetId: 'TEST_SPREADSHEET_ID',
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract

const headerMap = buildSheetHeaderMap(
  ['AppendID', 'Label'],
  Object.keys(appendRowSchema.shape),
  'AppendID',
)

// A header map whose orderedHeaders include the primary key column (so row
// serialization still produces a non-empty primary key value) but whose
// letterByName omits it -- the same "key column not in the header map"
// corruption findRowNumberByKey detects for UPDATE via SheetHeaderMapError.
// Deliberately hand-built rather than run through buildSheetHeaderMap,
// which forbids this state; the point is to exercise the defensive branch
// directly, mirroring how row-lookup.dry-test.ts does it.
const headerMapMissingPrimaryKeyLetter: SheetHeaderMap = {
  orderedHeaders: ['AppendID', 'Label'],
  width: 2,
  indexByName: { AppendID: 0, Label: 1 },
  letterByName: { Label: 'B' },
}

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

function appendRepository(
  client: SheetsApiClient,
  loadHeaderMap: () => Promise<SheetHeaderMap> = async () => headerMap,
): SheetRepository<AppendRow> {
  return new SheetRepository<AppendRow>({
    contract: appendContract,
    sheetsApiClient: client,
    sheetHeaderMapLoader: { load: loadHeaderMap },
  })
}

type DryTest = { name: string; run: () => Promise<void> }
const tests: DryTest[] = []

function test(name: string, run: () => Promise<void>): void {
  tests.push({ name, run })
}

test('an existing primary key rejects the append before any write happens', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    // A matching row (index 1, the first data row) means findRowNumberByKey
    // resolves to row number 2.
    readColumn: async () => [['AppendID'], ['append-1']],
    appendRows: async () => {
      assert.fail('appendRows must not run once a duplicate key is found')
      return appendResponse([])
    },
  })
  const repository = appendRepository(client)

  await assert.rejects(
    () => repository.append({ AppendID: 'append-1', Label: 'sent' }),
    (error: unknown) => {
      assert.ok(error instanceof DuplicatePrimaryKeyError)
      // The service layer classifies write failures by `instanceof
      // WriteRejectedError`; DuplicatePrimaryKeyError must keep working
      // with every existing classification with zero changes elsewhere.
      assert.ok(error instanceof WriteRejectedError)
      assert.equal((error as WriteRejectedError).certainty, 'rejected')
      return true
    },
  )

  // The duplicate check must run and reject before any write is attempted.
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.method, 'readColumn')
  assert.deepEqual(calls[0]?.args, ['A'])
})

test('no existing primary key proceeds to append normally', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    // Header row only -- no data rows, so findRowNumberByKey resolves null.
    readColumn: async () => [['AppendID']],
    appendRows: async () => appendResponse([['append-2', 'sent']]),
  })
  const repository = appendRepository(client)

  const returned = await repository.append({ AppendID: 'append-2', Label: 'sent' })

  // Same return shape append() already produces today: the sent row, not
  // an echoed one.
  assert.deepEqual(returned, { AppendID: 'append-2', Label: 'sent' })
  assert.equal(calls.length, 2)
  assert.equal(calls[0]?.method, 'readColumn')
  assert.deepEqual(calls[0]?.args, ['A'])
  assert.equal(calls[1]?.method, 'appendRows')
})

test('an empty primary key value skips the duplicate check entirely', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    readColumn: async () => {
      assert.fail('readColumn must not run when the primary key value is empty')
      return [['AppendID']]
    },
    // The echoed AppendID must match the empty sent value for
    // verifyRowIdentity to accept the write.
    appendRows: async () => appendResponse([['', 'sent']]),
  })
  const repository = appendRepository(client)

  const returned = await repository.append({ AppendID: '', Label: 'sent' })

  assert.deepEqual(returned, { AppendID: '', Label: 'sent' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.method, 'appendRows')
})

test('a header map missing the primary key column converts to a rejected write, mirroring UPDATE', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    readColumn: async () => {
      assert.fail('readColumn must not run: findRowNumberByKey fails before reading')
      return [['AppendID']]
    },
    appendRows: async () => {
      assert.fail('appendRows must not run once the primary-key lookup fails')
      return appendResponse([])
    },
  })
  const repository = appendRepository(
    client,
    async () => headerMapMissingPrimaryKeyLetter,
  )

  await assert.rejects(
    () => repository.append({ AppendID: 'append-3', Label: 'sent' }),
    (error: unknown) => {
      // findRowNumberByKey throws SheetHeaderMapError; updateThroughSheetsApi
      // converts that to a WriteRejectedError('UPDATE', message), and APPEND
      // must mirror the same conversion, not surface the raw error type.
      assert.ok(error instanceof WriteRejectedError)
      assert.ok(!(error instanceof DuplicatePrimaryKeyError))
      assert.match((error as Error).message, /AppendID/)
      return true
    },
  )

  assert.equal(calls.length, 0)
})

test('a duplicated existing key in corrupt sheet data propagates unchanged, mirroring UPDATE', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    // Two rows already share this key: corrupt sheet data.
    readColumn: async () => [['AppendID'], ['append-4'], ['append-4']],
    appendRows: async () => {
      assert.fail('appendRows must not run once the lookup finds corrupt data')
      return appendResponse([])
    },
  })
  const repository = appendRepository(client)

  await assert.rejects(
    () => repository.append({ AppendID: 'append-4', Label: 'sent' }),
    (error: unknown) => {
      // updateThroughSheetsApi only special-cases SheetHeaderMapError; every
      // other findRowNumberByKey error (including DuplicateRowKeyError)
      // propagates unchanged via `throw error`. APPEND must do the same,
      // not wrap it as a rejection or a DuplicatePrimaryKeyError.
      assert.ok(error instanceof DuplicateRowKeyError)
      assert.ok(!(error instanceof WriteRejectedError))
      assert.ok(!(error instanceof DuplicatePrimaryKeyError))
      return true
    },
  )

  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.method, 'readColumn')
})

test('an existing primary key rejects batchAppend before any write happens', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    readColumn: async () => [['AppendID'], ['append-5']],
    appendRows: async () => {
      assert.fail('appendRows must not run once a batch key is found')
      return appendResponse([])
    },
  })
  const repository = appendRepository(client)

  await assert.rejects(
    () => repository.batchAppend([{ AppendID: 'append-5', Label: 'sent' }]),
    (error: unknown) => {
      assert.ok(error instanceof DuplicatePrimaryKeyError)
      assert.ok(error instanceof WriteRejectedError)
      assert.equal(error.certainty, 'rejected')
      return true
    },
  )

  assert.deepEqual(calls, [{ method: 'readColumn', args: ['A'] }])
})

test('two matching primary keys in one batch reject before any write happens', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    readColumn: async () => [['AppendID']],
    appendRows: async () => {
      assert.fail('appendRows must not run once an intra-batch duplicate is found')
      return appendResponse([])
    },
  })
  const repository = appendRepository(client)

  await assert.rejects(
    () => repository.batchAppend([
      { AppendID: 'append-6', Label: 'first' },
      { AppendID: 'append-6', Label: 'second' },
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

test('an empty primary key value is written by batchAppend', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    readColumn: async () => [['AppendID']],
    appendRows: async () => appendResponse([['', 'sent']]),
  })
  const repository = appendRepository(client)

  const returned = await repository.batchAppend([{ AppendID: '', Label: 'sent' }])

  assert.deepEqual(returned, [{ AppendID: '', Label: 'sent' }])
  assert.equal(returned[0]?.AppendID, '')
  assert.equal(calls.filter((call) => call.method === 'appendRows').length, 1)
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

console.log(`passed - ${tests.length} sheet repository Sheets API append duplicate-key dry-tests`)
