import assert from 'node:assert/strict'
import { z } from 'zod'
import type { SheetContract } from '../../../../../server/shared/contracts/sheet-contract.js'
import { SheetRepository } from '../../../../../server/shared/repositories/sheet.repository.js'
import { buildSheetHeaderMap } from '../../../../../server/shared/repositories/sheet-header-map.js'
import {
  SheetsApiClient,
  WriteCommittedUnreadableError,
  WriteRejectedError,
  WriteTransportError,
} from '../../../../../server/shared/repositories/sheets-api.client.js'

process.env.TEST_SPREADSHEET_ID = 'spreadsheet-id'

const appendRowSchema = z.object({
  AppendID: z.string(),
  Label: z.string(),
})

type AppendRow = z.infer<typeof appendRowSchema>

const appendContract = {
  row: appendRowSchema,
  primaryKey: 'AppendID',
  sheetName: 'AppendCertainty',
  spreadsheetId: 'TEST_SPREADSHEET_ID',
  writes: { append: true, update: false, delete: false },
} satisfies SheetContract

const headerMap = buildSheetHeaderMap(
  ['AppendID', 'Label'],
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

async function withImmediateTimers(
  run: (delays: number[]) => Promise<void>,
): Promise<void> {
  const delays: number[] = []
  const originalSetTimeout = globalThis.setTimeout
  globalThis.setTimeout = ((handler: unknown, delay?: number) => {
    delays.push(delay ?? 0)
    if (typeof handler === 'function') {
      handler()
    }
    return 0 as unknown as ReturnType<typeof setTimeout>
  }) as unknown as typeof setTimeout

  try {
    await run(delays)
  } finally {
    globalThis.setTimeout = originalSetTimeout
  }
}

function gvizResponse(
  columns: string[],
  values?: unknown[],
): Response {
  return new Response(
    `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify({
      version: '0.6',
      reqId: '0',
      status: 'ok',
      table: {
        cols: columns.map((id) => ({ id, type: 'string' })),
        rows: values === undefined
          ? []
          : [{ c: values.map((value) => (value === null ? null : { v: value })) }],
      },
    })});`,
  )
}

function mockSheetsApiClient(
  appendRows: SheetsApiClient['appendRows'],
): SheetsApiClient {
  return {
    appendRows,
    // The pre-write duplicate-key guard reads the primary key column before
    // every append. This suite is about GViz verification after the append
    // itself, so the lookup always reports "no existing row" (header row
    // only) and lets the guard fall through to appendRows unchanged.
    readColumn: async () => [['AppendID']],
  } as unknown as SheetsApiClient
}

function appendRepository(
  appendRows: SheetsApiClient['appendRows'],
): SheetRepository<AppendRow> {
  return new SheetRepository<AppendRow>({
    contract: appendContract,
    sheetsApiClient: mockSheetsApiClient(appendRows),
    sheetHeaderMapLoader: { load: async () => headerMap },
  })
}

async function verifyAfterUnknown(
  error: WriteTransportError | WriteCommittedUnreadableError,
  foundOnAttempt: number | undefined,
): Promise<void> {
  const row: AppendRow = { AppendID: `append-${error.name}`, Label: 'sent' }
  let gvizCalls = 0
  const repository = appendRepository(async () => {
    throw error
  })

  await withImmediateTimers(async (delays) => {
    await withMockFetch(
      async (url) => {
        gvizCalls += 1
        const parsed = new URL(url)
        assert.equal(parsed.searchParams.get('sheet'), 'AppendCertainty')
        assert.match(parsed.searchParams.get('tq') ?? '', /where A = '/)

        return foundOnAttempt !== undefined && gvizCalls >= foundOnAttempt
          ? gvizResponse(['A', 'B'], [row.AppendID, row.Label])
          : gvizResponse(['A', 'B'])
      },
      async () => {
        if (foundOnAttempt === undefined) {
          await assert.rejects(
            () => repository.append(row),
            (received: unknown) => {
              assert.strictEqual(received, error)
              return true
            },
          )
        } else {
          assert.deepEqual(await repository.append(row), row)
        }
      },
    )

    assert.equal(gvizCalls, foundOnAttempt ?? 3)
    assert.deepEqual(
      delays,
      foundOnAttempt === undefined || foundOnAttempt === 3
        ? [1_000, 2_000]
        : foundOnAttempt === 2
          ? [1_000]
          : [],
    )
  })
}

async function run(): Promise<void> {
  await verifyAfterUnknown(
    new WriteTransportError('APPEND', 'simulated timeout'),
    1,
  )
  console.log('ok - transport error plus first GViz verification match returns success')

  await verifyAfterUnknown(
    new WriteTransportError('APPEND', 'simulated timeout'),
    2,
  )
  console.log('ok - transport error plus second GViz verification match returns success')

  await verifyAfterUnknown(
    new WriteTransportError('APPEND', 'simulated timeout'),
    3,
  )
  console.log('ok - transport error plus third GViz verification match returns success')

  await verifyAfterUnknown(
    new WriteTransportError('APPEND', 'simulated timeout'),
    undefined,
  )
  console.log('ok - transport error plus no GViz match rethrows unchanged')

  await verifyAfterUnknown(
    new WriteCommittedUnreadableError('APPEND', 'unreadable response'),
    1,
  )
  console.log('ok - committed unreadable error plus GViz match returns success')

  await verifyAfterUnknown(
    new WriteCommittedUnreadableError('APPEND', 'unreadable response'),
    undefined,
  )
  console.log('ok - committed unreadable error plus no GViz match rethrows unchanged')

  const rejected = new WriteRejectedError('APPEND', 'bad request')
  const rejectedRepository = appendRepository(async () => {
    throw rejected
  })
  await withImmediateTimers(async (delays) => {
    await withMockFetch(
      async () => {
        assert.fail('WriteRejectedError must not trigger a GViz verification call')
        return gvizResponse(['A', 'B'])
      },
      async (calls) => {
        await assert.rejects(
          () => rejectedRepository.append({ AppendID: 'append-rejected', Label: 'sent' }),
          (received: unknown) => {
            assert.strictEqual(received, rejected)
            return true
          },
        )
        assert.equal(calls.length, 0)
      },
    )
    assert.deepEqual(delays, [])
  })
  console.log('ok - rejected error bypasses GViz verification')

  console.log('passed - append certainty dry tests')
}

run().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
