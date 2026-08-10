import assert from 'node:assert/strict'
import { z } from 'zod'
import type { SheetContract } from '../../../../../server/shared/contracts/sheet-contract.js'
import { SheetRepository } from '../../../../../server/shared/repositories/sheet.repository.js'
import { buildSheetHeaderMap } from '../../../../../server/shared/repositories/sheet-header-map.js'
import { WriteRowIdentityMismatchError } from '../../../../../server/shared/repositories/sheet-row-identity.js'

process.env.TEST_SPREADSHEET_ID = 'spreadsheet-id'
process.env.TEST_SCRIPT_URL = 'https://script.example/exec'

const appendRowSchema = z.object({
  AppendID: z.string(),
  BeforeNullable: z.string(),
  NullableMiddle: z.string().nullable(),
  AfterNullable: z.string(),
})

type AppendRow = z.infer<typeof appendRowSchema>

const sheetsApiContract = {
  row: appendRowSchema,
  primaryKey: 'AppendID',
  sheetName: 'SyntheticAppends',
  spreadsheetId: 'TEST_SPREADSHEET_ID',
  writeTransport: 'sheets-api',
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

const sheetLibContract = {
  row: appendRowSchema,
  primaryKey: 'AppendID',
  sheetName: 'SyntheticSheetLibAppends',
  spreadsheetId: 'TEST_SPREADSHEET_ID',
  target: 'SyntheticAppend',
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract

const headerMap = buildSheetHeaderMap(
  ['AppendID', 'BeforeNullable', 'NullableMiddle', 'AfterNullable'],
  Object.keys(appendRowSchema.shape),
  'AppendID',
)

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
      updatedRows: 1,
      updatedData: { values },
    },
  })
}

function requestBody(call: FetchCall): Record<string, unknown> {
  return JSON.parse(String(call.init?.body)) as Record<string, unknown>
}

function sheetsApiRepository(
  contract: SheetContract = sheetsApiContract,
): SheetRepository<AppendRow> {
  return new SheetRepository<AppendRow>({
    contract,
    sheetHeaderMapLoader: { load: async () => headerMap },
    sheetsApiClientOptions: {
      accessTokenProvider: async () => 'test-access-token',
    },
  })
}

function defaultSheetsApiRepository(
  contract: SheetContract = sheetsApiContract,
): SheetRepository<AppendRow> {
  return new SheetRepository<AppendRow>({
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

test('Sheets API append does not look up the row first', async () => {
  await withMockFetch(
    async (_url, init) => {
      assert.equal(init?.method, 'POST')
      return appendResponse([['append-1', 'before', 'middle', 'after']])
    },
    async (calls) => {
      const repository = sheetsApiRepository()
      await repository.append({
        AppendID: 'append-1',
        BeforeNullable: 'before',
        NullableMiddle: 'middle',
        AfterNullable: 'after',
      })
      assert.equal(calls.length, 1)
    },
  )
})

test('Sheets API append sends a full-width row with middle blanks preserved', async () => {
  await withMockFetch(
    async (_url, init) => {
      assert.deepEqual(JSON.parse(String(init?.body)), {
        majorDimension: 'ROWS',
        values: [['append-2', 'before', '', 'after']],
      })
      return appendResponse([['append-2', 'before', '', 'after']])
    },
    async () => {
      const repository = sheetsApiRepository()
      await repository.append({
        AppendID: 'append-2',
        BeforeNullable: 'before',
        AfterNullable: 'after',
      })
    },
  )
})

test('Sheets API append uses one USER_ENTERED request option', async () => {
  await withMockFetch(
    async (url) => {
      const parsed = new URL(url)
      assert.equal(parsed.searchParams.get('valueInputOption'), 'USER_ENTERED')
      assert.equal(parsed.searchParams.getAll('valueInputOption').length, 1)
      return appendResponse([['append-3', 'before', 'middle', 'after']])
    },
    async () => {
      const repository = sheetsApiRepository()
      await repository.append({
        AppendID: 'append-3',
        BeforeNullable: 'before',
        NullableMiddle: 'middle',
        AfterNullable: 'after',
      })
    },
  )
})

test('a conflicting valueInput declaration is rejected before fetch', async () => {
  await withMockFetch(
    async () => {
      assert.fail('a conflicting valueInput declaration must not send a request')
      return jsonResponse({})
    },
    async (calls) => {
      const repository = defaultSheetsApiRepository(conflictingValueInputContract)
      await assert.rejects(
        () => repository.append({ AppendID: 'append-4' }),
        /Column 'NullableMiddle' declares valueInput 'RAW'.*USER_ENTERED request policy/,
      )
      assert.equal(calls.length, 0)
    },
  )
})

test('append returns the sent full-width row instead of the echoed row', async () => {
  await withMockFetch(
    async () => {
      return appendResponse([['append-5', 'echo-different', 'echo-middle', 'after']])
    },
    async () => {
      const repository = sheetsApiRepository()
      const returned = await repository.append({
        AppendID: 'append-5',
        BeforeNullable: 'before',
        AfterNullable: 'after',
      })

      assert.deepEqual(returned, {
        AppendID: 'append-5',
        BeforeNullable: 'before',
        NullableMiddle: '',
        AfterNullable: 'after',
      })
    },
  )
})

test('an append echo with a different primary key is rejected', async () => {
  await withMockFetch(
    async () => appendResponse([['different-key', 'before', 'middle', 'after']]),
    async () => {
      const repository = sheetsApiRepository()
      await assert.rejects(
        () =>
          repository.append({
            AppendID: 'append-6',
            BeforeNullable: 'before',
            NullableMiddle: 'middle',
            AfterNullable: 'after',
          }),
        (error: unknown) => {
          assert.ok(error instanceof WriteRowIdentityMismatchError)
          return true
        },
      )
    },
  )
})

test('a contract without writeTransport still appends through SheetLib', async () => {
  const repository = new SheetRepository<AppendRow>({
    contract: sheetLibContract,
    scriptUrl: 'TEST_SCRIPT_URL',
  })

  await withMockFetch(
    async (_url, init) => {
      assert.deepEqual(requestBody({ url: '', init }), {
        resource: 'sheet',
        action: 'APPEND',
        target: 'SyntheticAppend',
        data: { AppendID: 'append-7' },
      })
      return jsonResponse({
        status: 'ok',
        target: 'SyntheticAppend',
        data: { AppendID: 'append-7' },
      })
    },
    async () => {
      assert.deepEqual(await repository.append({ AppendID: 'append-7' }), {
        AppendID: 'append-7',
      })
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

console.log(`passed - ${tests.length} sheet repository Sheets API append dry-tests`)
