import assert from 'node:assert/strict'
import { z } from 'zod'
import type { SheetContract } from '../../../../../server/shared/contracts/sheet-contract.js'
import { SheetRepository } from '../../../../../server/shared/repositories/sheet.repository.js'
import { buildSheetHeaderMap } from '../../../../../server/shared/repositories/sheet-header-map.js'
import { WriteRowIdentityMismatchError } from '../../../../../server/shared/repositories/sheet-row-identity.js'
import { WriteCommittedUnreadableError } from '../../../../../server/shared/repositories/sheets-api.client.js'

process.env.TEST_SPREADSHEET_ID = 'spreadsheet-id'

const batchAppendRowSchema = z.object({
  AppendID: z.string(),
  BeforeNullable: z.string(),
  NullableMiddle: z.string().nullable(),
  AfterNullable: z.string(),
})

type BatchAppendRow = z.infer<typeof batchAppendRowSchema>

const sheetsApiContract = {
  row: batchAppendRowSchema,
  primaryKey: 'AppendID',
  sheetName: 'SyntheticBatchAppends',
  spreadsheetId: 'TEST_SPREADSHEET_ID',
  valueInput: {
    AppendID: 'USER_ENTERED',
    BeforeNullable: 'USER_ENTERED',
    NullableMiddle: 'USER_ENTERED',
    AfterNullable: 'USER_ENTERED',
  },
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract

const conflictingValueInputContract = {
  ...sheetsApiContract,
  valueInput: { NullableMiddle: 'RAW' },
} satisfies SheetContract

const headerMap = buildSheetHeaderMap(
  ['AppendID', 'BeforeNullable', 'NullableMiddle', 'AfterNullable'],
  Object.keys(batchAppendRowSchema.shape),
  'AppendID',
)

const threeBatchRows: Array<Partial<BatchAppendRow>> = [
  {
    AppendID: 'batch-1',
    BeforeNullable: 'before-1',
    // NullableMiddle omitted
    AfterNullable: 'after-1',
  },
  {
    AppendID: 'batch-2',
    // BeforeNullable omitted
    NullableMiddle: 'middle-2',
    AfterNullable: 'after-2',
  },
  {
    AppendID: 'batch-3',
    BeforeNullable: 'before-3',
    NullableMiddle: 'middle-3',
    // AfterNullable omitted
  },
]

const expectedSentValues = [
  ['batch-1', 'before-1', '', 'after-1'],
  ['batch-2', '', 'middle-2', 'after-2'],
  ['batch-3', 'before-3', 'middle-3', ''],
]

interface FetchCall {
  url: string
  init?: RequestInit
}

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>

async function withMockFetch(
  handler: FetchHandler,
  run: (calls: FetchCall[]) => Promise<void>,
): Promise<void> {
  const calls: FetchCall[] = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const call = { url: String(input), init }
    calls.push(call)
    return handler(call.url, call.init)
  }

  try {
    await run(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function appendResponse(values: unknown[][]): Response {
  return jsonResponse({
    spreadsheetId: 'spreadsheet-id',
    updates: {
      updatedRows: values.length,
      updatedData: { values },
    },
  })
}

function sheetsApiRepository(
  contract: SheetContract = sheetsApiContract,
): SheetRepository<BatchAppendRow> {
  return new SheetRepository<BatchAppendRow>({
    contract,
    sheetHeaderMapLoader: { load: async () => headerMap },
    sheetsApiClientOptions: {
      accessTokenProvider: async () => 'test-access-token',
    },
  })
}

function defaultSheetsApiRepository(
  contract: SheetContract = sheetsApiContract,
): SheetRepository<BatchAppendRow> {
  return new SheetRepository<BatchAppendRow>({
    contract,
    sheetsApiClientOptions: {
      accessTokenProvider: async () => 'test-access-token',
    },
  })
}

type DryTest = { name: string; run: () => Promise<void> }
const tests: DryTest[] = []

function test(name: string, run: () => Promise<void>): void {
  tests.push({ name, run })
}

test('Sheets API batchAppend issues exactly one appendRows request with all rows', async () => {
  await withMockFetch(
    async (_url, init) => {
      assert.equal(init?.method, 'POST')
      const body = JSON.parse(String(init?.body)) as { values: unknown[][] }
      assert.equal(body.values.length, threeBatchRows.length)
      return appendResponse(expectedSentValues)
    },
    async (calls) => {
      const repository = sheetsApiRepository()
      await repository.batchAppend(threeBatchRows)
      assert.equal(calls.length, 1)
    },
  )
})

test('every batch row is full header width with blanks at omitted middle columns', async () => {
  await withMockFetch(
    async (_url, init) => {
      assert.deepEqual(JSON.parse(String(init?.body)), {
        majorDimension: 'ROWS',
        values: expectedSentValues,
      })
      return appendResponse(expectedSentValues)
    },
    async () => {
      const repository = sheetsApiRepository()
      await repository.batchAppend(threeBatchRows)
    },
  )
})

test('Sheets API batchAppend uses one USER_ENTERED request option', async () => {
  await withMockFetch(
    async (url) => {
      const parsed = new URL(url)
      assert.equal(parsed.searchParams.get('valueInputOption'), 'USER_ENTERED')
      assert.equal(parsed.searchParams.getAll('valueInputOption').length, 1)
      return appendResponse(expectedSentValues)
    },
    async () => {
      const repository = sheetsApiRepository()
      await repository.batchAppend(threeBatchRows)
    },
  )
})

test('a conflicting valueInput declaration is rejected before any request is sent', async () => {
  await withMockFetch(
    async () => {
      assert.fail('a conflicting valueInput declaration must not send a request')
      return jsonResponse({})
    },
    async (calls) => {
      const repository = defaultSheetsApiRepository(conflictingValueInputContract)
      await assert.rejects(
        () => repository.batchAppend([{ AppendID: 'batch-conflict' }]),
        /Column 'NullableMiddle' declares valueInput 'RAW'.*USER_ENTERED request policy/,
      )
      assert.equal(calls.length, 0)
    },
  )
})

test('batchAppend returns the sent full-width rows instead of the echoed rows', async () => {
  // Echo differs in a non-key column so a later switch to reading the echo fails.
  const differingEcho = [
    ['batch-1', 'echo-different-1', '', 'after-1'],
    ['batch-2', '', 'echo-different-2', 'after-2'],
    ['batch-3', 'before-3', 'middle-3', 'echo-different-3'],
  ]

  await withMockFetch(
    async () => appendResponse(differingEcho),
    async () => {
      const repository = sheetsApiRepository()
      const returned = await repository.batchAppend(threeBatchRows)

      assert.deepEqual(returned, [
        {
          AppendID: 'batch-1',
          BeforeNullable: 'before-1',
          NullableMiddle: '',
          AfterNullable: 'after-1',
        },
        {
          AppendID: 'batch-2',
          BeforeNullable: '',
          NullableMiddle: 'middle-2',
          AfterNullable: 'after-2',
        },
        {
          AppendID: 'batch-3',
          BeforeNullable: 'before-3',
          NullableMiddle: 'middle-3',
          AfterNullable: '',
        },
      ])
    },
  )
})

test('a mismatched primary key in a non-first echoed row throws WriteRowIdentityMismatchError', async () => {
  const echoWithBadSecondKey = [
    ['batch-1', 'before-1', '', 'after-1'],
    ['wrong-key', '', 'middle-2', 'after-2'],
    ['batch-3', 'before-3', 'middle-3', ''],
  ]

  await withMockFetch(
    async () => appendResponse(echoWithBadSecondKey),
    async () => {
      const repository = sheetsApiRepository()
      await assert.rejects(
        () => repository.batchAppend(threeBatchRows),
        (error: unknown) => {
          assert.ok(error instanceof WriteRowIdentityMismatchError)
          return true
        },
      )
    },
  )
})

test('a row-count mismatch is committed-but-unreadable, never a rejection', async () => {
  await withMockFetch(
    async () =>
      // API confirms a write but returns fewer rows than sent — never "rejected".
      jsonResponse({
        spreadsheetId: 'spreadsheet-id',
        updates: {
          updatedRows: 1,
          updatedData: {
            values: [['batch-1', 'before-1', '', 'after-1']],
          },
        },
      }),
    async () => {
      const repository = sheetsApiRepository()
      await assert.rejects(
        () => repository.batchAppend(threeBatchRows),
        (error: unknown) => {
          assert.ok(error instanceof WriteCommittedUnreadableError)
          assert.notEqual(
            (error as WriteCommittedUnreadableError).certainty,
            'rejected',
          )
          assert.equal((error as WriteCommittedUnreadableError).certainty, 'unknown')
          return true
        },
      )
    },
  )
})

test('a contract without a transport declaration batchAppends through the Sheets API', async () => {
  await withMockFetch(
    async (url, init) => {
      assert.match(url, /:append/)
      assert.deepEqual(JSON.parse(String(init?.body)), {
        majorDimension: 'ROWS',
        values: expectedSentValues,
      })
      return appendResponse(expectedSentValues)
    },
    async (calls) => {
      const repository = sheetsApiRepository()
      assert.deepEqual(await repository.batchAppend(threeBatchRows), [
        {
          AppendID: 'batch-1',
          BeforeNullable: 'before-1',
          NullableMiddle: '',
          AfterNullable: 'after-1',
        },
        {
          AppendID: 'batch-2',
          BeforeNullable: '',
          NullableMiddle: 'middle-2',
          AfterNullable: 'after-2',
        },
        {
          AppendID: 'batch-3',
          BeforeNullable: 'before-3',
          NullableMiddle: 'middle-3',
          AfterNullable: '',
        },
      ])
      assert.equal(calls.length, 1)
    },
  )
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

console.log(
  `passed - ${tests.length} sheet repository Sheets API batchAppend dry-tests`,
)
