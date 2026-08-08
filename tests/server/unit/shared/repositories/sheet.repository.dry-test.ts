import assert from 'node:assert/strict'
import { z } from 'zod'
import type { SheetContract } from '../../../../../server/shared/contracts/sheet-contract.js'
import { ReadQueryDTO } from '../../../../../server/shared/dtos/read-query.dto.js'
import { SheetRepository } from '../../../../../server/shared/repositories/sheet.repository.js'
import {
  SheetLibRejectedError,
  SheetLibTransportError,
} from '../../../../../server/shared/repositories/sheetlib-errors.js'

process.env.TEST_SPREADSHEET_ID = 'spreadsheet-id'
process.env.TEST_SCRIPT_URL = 'https://script.example/exec'

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
  target: 'Widget',
  writes: { append: true, update: true, delete: true },
} satisfies SheetContract

const readOnlyContract = {
  ...widgetContract,
  writes: { append: false, update: false, delete: false },
} satisfies SheetContract

const noTargetContract = {
  row: widgetRowSchema,
  primaryKey: 'WidgetID',
  sheetName: 'NoTargetWidgets',
  spreadsheetId: 'TEST_SPREADSHEET_ID',
  writes: { append: true, update: true, delete: false },
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

function requestBody(call: FetchCall): Record<string, unknown> {
  return JSON.parse(String(call.init?.body)) as Record<string, unknown>
}

function widgetRepository(): SheetRepository<WidgetRow> {
  return new SheetRepository<WidgetRow>({
    contract: widgetContract,
    scriptUrl: 'TEST_SCRIPT_URL',
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

  await withMockFetch(
    async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      if (body.action === 'APPEND') {
        return jsonResponse({
          status: 'ok',
          target: 'Widget',
          data: { WidgetID: 'W-3', NestedData: '{}', Label: 'New' },
        })
      }
      return jsonResponse({
        status: 'ok',
        target: 'Widget',
        data: { WidgetID: 'W-3', NestedData: '{}', Label: 'Updated' },
      })
    },
    async (calls) => {
      assert.deepEqual(
        await repository.append({ NestedData: '{}', Label: 'New' }),
        { WidgetID: 'W-3', NestedData: '{}', Label: 'New' },
      )
      assert.deepEqual(
        await repository.update('W-3', { WidgetID: 'wrong', Label: 'Updated' }),
        { WidgetID: 'W-3', NestedData: '{}', Label: 'Updated' },
      )
      assert.deepEqual(requestBody(calls[0]), {
        resource: 'sheet',
        action: 'APPEND',
        target: 'Widget',
        data: { NestedData: '{}', Label: 'New' },
      })
      assert.deepEqual(requestBody(calls[1]), {
        resource: 'sheet',
        action: 'UPDATE',
        target: 'Widget',
        key_value: 'W-3',
        data: { Label: 'Updated' },
      })
    },
  )

  await withMockFetch(
    async () =>
      jsonResponse({
        status: 'ok',
        target: 'Widget',
        data: { WidgetID: 'W-3', NestedData: '{}', Label: null },
      }),
    async (calls) => {
      assert.deepEqual(await repository.delete('W-3', 'operator-1'), {
        WidgetID: 'W-3',
        NestedData: '{}',
        Label: null,
      })
      assert.deepEqual(requestBody(calls[0]), {
        resource: 'sheet',
        action: 'DELETE',
        target: 'Widget',
        key_value: 'W-3',
        deleted_by: 'operator-1',
      })
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

  const readOnlyRepository = new SheetRepository<WidgetRow>({
    contract: readOnlyContract,
    scriptUrl: 'TEST_SCRIPT_URL',
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
      assert.equal(calls.length, 0)
    },
  )

  const noTargetRepository = new SheetRepository<WidgetRow>({
    contract: noTargetContract,
    scriptUrl: 'TEST_SCRIPT_URL',
  })
  await withMockFetch(
    async () => {
      assert.fail('a missing target must fail before fetch')
      return jsonResponse({})
    },
    async (calls) => {
      await assert.rejects(
        () => noTargetRepository.append({ Label: 'blocked' }),
        /writes require an explicit SheetLib target/,
      )
      assert.equal(calls.length, 0)
    },
  )

  await withMockFetch(
    async () => jsonResponse({ status: 'error', message: 'duplicate' }),
    async () => {
      await assert.rejects(
        () => repository.append({ Label: 'duplicate' }),
        (error: unknown) => {
          assert.ok(error instanceof SheetLibRejectedError)
          assert.ok(!(error instanceof SheetLibTransportError))
          return true
        },
      )
    },
  )

  const transportCases: Array<{
    name: string
    response: FetchHandler
  }> = [
    {
      name: 'network failure',
      response: async () => {
        throw new Error('offline')
      },
    },
    {
      name: 'non-ok HTTP status',
      response: async () => new Response('server failure', { status: 503 }),
    },
    {
      name: 'read_back_failed',
      response: async () =>
        jsonResponse({
          status: 'ok',
          target: 'Widget',
          data: null,
          read_back_failed: true,
          reason: 'quota',
        }),
    },
    {
      name: 'missing data',
      response: async () => jsonResponse({ status: 'ok', target: 'Widget' }),
    },
    {
      name: 'unusable data',
      response: async () =>
        jsonResponse({ status: 'ok', target: 'Widget', data: 'W-1' }),
    },
    {
      name: 'invalid JSON',
      response: async () => new Response('not json'),
    },
  ]

  for (const transportCase of transportCases) {
    await withMockFetch(transportCase.response, async () => {
      await assert.rejects(
        () => repository.append({ Label: transportCase.name }),
        (error: unknown) => {
          assert.ok(error instanceof SheetLibTransportError, transportCase.name)
          assert.ok(!(error instanceof SheetLibRejectedError), transportCase.name)
          return true
        },
      )
    })
  }

  await withMockFetch(
    async () =>
      jsonResponse({
        status: 'ok',
        target: 'Widget',
        data: { WidgetID: 'W-4' },
      }),
    async () => {
      await assert.rejects(
        () => repository.batchAppend([{ NestedData: '{}', Label: 'one' }]),
        (error: unknown) => {
          assert.ok(error instanceof SheetLibTransportError)
          assert.ok(!(error instanceof SheetLibRejectedError))
          assert.match(error instanceof Error ? error.message : '', /data.*not an array/)
          return true
        },
      )
    },
  )

  await withMockFetch(
    async () =>
      jsonResponse({
        status: 'ok',
        target: 'Widget',
        data: [{ WidgetID: 'W-4' }],
      }),
    async () => {
      await assert.rejects(
        () =>
          repository.batchAppend([
            { NestedData: '{}', Label: 'one' },
            { NestedData: '{}', Label: 'two' },
          ]),
        (error: unknown) => {
          assert.ok(error instanceof SheetLibTransportError)
          assert.ok(!(error instanceof SheetLibRejectedError))
          assert.match(error instanceof Error ? error.message : '', /row count must match/)
          return true
        },
      )
    },
  )

  const noSpreadsheetRepository = new SheetRepository<WidgetRow>({
    contract: { ...widgetContract, spreadsheetId: undefined },
    scriptUrl: 'TEST_SCRIPT_URL',
  })
  await assert.rejects(
    () => noSpreadsheetRepository.read(),
    /SheetRepository reads require a spreadsheetId environment variable name/,
  )

  console.log('sheet repository dry tests passed')
}

run().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
