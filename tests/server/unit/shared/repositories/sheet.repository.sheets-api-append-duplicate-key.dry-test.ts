import assert from 'node:assert/strict'
import { z } from 'zod'
import type { SheetContract } from '../../../../../server/shared/contracts/sheet-contract.js'
import { SheetRepository } from '../../../../../server/shared/repositories/sheet.repository.js'
import { buildSheetHeaderMap } from '../../../../../server/shared/repositories/sheet-header-map.js'
import {
  DuplicatePrimaryKeyError,
  SheetsApiClient,
  WriteRejectedError,
  type SheetsApiAppendResponse,
  type SheetsApiValues,
} from '../../../../../server/shared/repositories/sheets-api.client.js'

// This file pins the in-batch duplicate primary key guard. Remote duplicate
// lookup is intentionally absent from both append paths.

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
): SheetRepository<AppendRow> {
  return new SheetRepository<AppendRow>({
    contract: appendContract,
    sheetsApiClient: client,
    sheetHeaderMapLoader: { load: async () => headerMap },
  })
}

type DryTest = { name: string; run: () => Promise<void> }
const tests: DryTest[] = []

function test(name: string, run: () => Promise<void>): void {
  tests.push({ name, run })
}

test('no existing primary key proceeds to append normally', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    readColumn: async () => [['AppendID']],
    appendRows: async () => appendResponse([['append-1', 'sent']]),
  })
  const repository = appendRepository(client)

  assert.deepEqual(
    await repository.append({ AppendID: 'append-1', Label: 'sent' }),
    { AppendID: 'append-1', Label: 'sent' },
  )
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.method, 'appendRows')
})

test('an empty primary key value skips the duplicate check entirely', async () => {
  const calls: MockCall[] = []
  const client = mockClient({
    calls,
    readColumn: async () => {
      assert.fail('readColumn must not run when the primary key value is empty')
      return [['AppendID']]
    },
    appendRows: async () => appendResponse([['', 'sent']]),
  })
  const repository = appendRepository(client)

  const returned = await repository.append({ AppendID: '', Label: 'sent' })

  assert.deepEqual(returned, { AppendID: '', Label: 'sent' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.method, 'appendRows')
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

  assert.deepEqual(calls, [])
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
