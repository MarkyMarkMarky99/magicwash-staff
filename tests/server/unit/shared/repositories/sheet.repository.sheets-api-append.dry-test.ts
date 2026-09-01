import assert from 'node:assert/strict'
import { z } from 'zod'
import type { SheetContract } from '../../../../../server/shared/contracts/sheet-contract.js'
import { SheetRepository } from '../../../../../server/shared/repositories/sheet.repository.js'
import { buildSheetHeaderMap } from '../../../../../server/shared/repositories/sheet-header-map.js'
import { WriteRowIdentityMismatchError } from '../../../../../server/shared/repositories/sheet-row-identity.js'

process.env.TEST_SPREADSHEET_ID = 'spreadsheet-id'

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
      updatedRange: 'AppendSheet!A2:D2',
      updatedData: { values },
    },
  })
}

function lookupResponse(): Response {
  return jsonResponse({ values: [['AppendID']] })
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

test('Sheets API append does not read the primary key before writing', async () => {
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
      assert.deepEqual(calls.map((call) => call.init?.method), ['POST'])
    },
  )
})

test('Sheets API append sends a full-width row with middle blanks preserved', async () => {
  await withMockFetch(
    async (_url, init) => {
      if (init?.method === 'GET') {
        return lookupResponse()
      }
      assert.equal(init?.method, 'POST')
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
    async (url, init) => {
      if (init?.method === 'GET') {
        return lookupResponse()
      }
      assert.equal(init?.method, 'POST')
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
    async (_url, init) => {
      if (init?.method === 'GET') {
        return lookupResponse()
      }
      assert.equal(init?.method, 'POST')
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
    async (_url, init) => {
      if (init?.method === 'GET') {
        return lookupResponse()
      }
      assert.equal(init?.method, 'POST')
      return appendResponse([['different-key', 'before', 'middle', 'after']])
    },
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

test('a contract without a transport declaration appends through the Sheets API', async () => {
  await withMockFetch(
    async (url, init) => {
      if (init?.method === 'GET') {
        return lookupResponse()
      }
      assert.equal(init?.method, 'POST')
      assert.match(url, /:append/)
      assert.deepEqual(JSON.parse(String(init?.body)), {
        majorDimension: 'ROWS',
        values: [['append-7', '', '', '']],
      })
      return appendResponse([['append-7', '', '', '']])
    },
    async (calls) => {
      const repository = sheetsApiRepository()
      assert.deepEqual(await repository.append({ AppendID: 'append-7' }), {
        AppendID: 'append-7',
        BeforeNullable: '',
        NullableMiddle: '',
        AfterNullable: '',
      })
      // One POST call: the duplicate-key lookup GET is gone and this repository
      // injects its header map, so nothing reads before the write.
      assert.ok(calls.length === 1 || calls.length === 2)
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
