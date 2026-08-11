import assert from 'node:assert/strict'
import { z } from 'zod'
import type { SheetContract } from '../../../../../server/shared/contracts/sheet-contract.js'
import { ReadQueryDTO } from '../../../../../server/shared/dtos/read-query.dto.js'
import { SheetRepository } from '../../../../../server/shared/repositories/sheet.repository.js'

process.env.TEST_SPREADSHEET_ID = 'spreadsheet-id'

const widgetRowSchema = z.object({
  WidgetID: z.string(),
  NestedData: z.string(),
  Label: z.string().nullable(),
})

type WidgetRow = z.infer<typeof widgetRowSchema>

const widgetContract = {
  row: widgetRowSchema,
  primaryKey: 'WidgetID',
  sheetName: 'Widgets',
  spreadsheetId: 'TEST_SPREADSHEET_ID',
  writes: { append: true, update: true, delete: true },
} satisfies SheetContract

const readOnlyContract = {
  ...widgetContract,
  writes: { append: false, update: false, delete: false },
} satisfies SheetContract

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

function gvizResponse(
  columns: string[],
  values: unknown[],
): Response {
  return new Response(
    `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify({
      version: '0.6',
      reqId: '0',
      status: 'ok',
      table: {
        cols: columns.map((id) => ({ id, type: 'string' })),
        rows: [{ c: values.map((value) => ({ v: value })) }],
      },
    })});`,
  )
}

function widgetRepository(): SheetRepository<WidgetRow> {
  return new SheetRepository<WidgetRow>({
    contract: widgetContract,
  })
}

async function run(): Promise<void> {
  const repository = widgetRepository()

  await withMockFetch(
    async (url) => {
      assert.equal(new URL(url).pathname, '/spreadsheets/d/spreadsheet-id/gviz/tq')
      return gvizResponse(['A', 'B', 'C'], ['W-1', '{"items":[1]}', 'Ready'])
    },
    async (calls) => {
      const rows = await repository.read(new ReadQueryDTO({ id: 'W-1' }))
      const url = new URL(calls[0].url)

      assert.equal(url.searchParams.get('sheet'), 'Widgets')
      assert.match(url.searchParams.get('tq') ?? '', /where A = 'W-1'/)
      assert.deepEqual(rows, [
        { WidgetID: 'W-1', NestedData: '{"items":[1]}', Label: 'Ready' },
      ])
      assert.equal(typeof rows[0].NestedData, 'string')
      assert.equal('widgetId' in rows[0], false)
      assert.equal('nestedData' in rows[0], false)
    },
  )

  await withMockFetch(
    async (url) => {
      assert.match(new URL(url).searchParams.get('tq') ?? '', /^select B, C$/)
      return gvizResponse(['B', 'C'], ['{"items":[2]}', 'Projected'])
    },
    async () => {
      assert.deepEqual(
        await repository.read(new ReadQueryDTO({ select: ['NestedData', 'Label'] })),
        [{ NestedData: '{"items":[2]}', Label: 'Projected' }],
      )
    },
  )

  await withMockFetch(
    async (url) => {
      assert.doesNotMatch(new URL(url).searchParams.get('tq') ?? '', /where/)
      return gvizResponse(['A', 'B', 'C'], ['W-2', '{}', null])
    },
    async () => {
      await repository.read(new ReadQueryDTO({ id: '   ' }))
    },
  )

  await assert.rejects(
    () => repository.update('', {}),
    { message: 'Repository update requires a non-empty id' },
  )
  await assert.rejects(
    () => repository.delete('   ', 'operator-1'),
    { message: 'Repository delete requires a non-empty id' },
  )
  await assert.rejects(
    () => repository.delete('W-3', 'operator-1'),
    { message: 'delete is not supported yet' },
  )

  const readOnlyRepository = new SheetRepository<WidgetRow>({
    contract: readOnlyContract,
  })
  await withMockFetch(
    async () => {
      assert.fail('unsupported writes must not issue fetch')
      return jsonResponse({})
    },
    async (calls) => {
      await assert.rejects(
        () => readOnlyRepository.append({ Label: 'blocked' }),
        /append is not supported by sheet 'Widgets'/,
      )
      await assert.rejects(
        () => readOnlyRepository.update('W-1', { Label: 'blocked' }),
        /update is not supported by sheet 'Widgets'/,
      )
      await assert.rejects(
        () => readOnlyRepository.delete('W-1', 'operator-1'),
        /delete is not supported by sheet 'Widgets'/,
      )
      assert.equal(calls.length, 0)
    },
  )

  assert.throws(
    () =>
      new SheetRepository<WidgetRow>({
        contract: { ...widgetContract, spreadsheetId: undefined },
      }),
    /SheetRepository Sheets API writes require a spreadsheetId environment variable name/,
  )

  console.log('sheet repository dry tests passed')
}

run().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
