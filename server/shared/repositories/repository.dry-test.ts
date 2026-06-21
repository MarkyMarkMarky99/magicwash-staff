import assert from 'node:assert/strict'
import { z } from 'zod'
import {
  BaseRepository,
  type FieldMap,
  type RepositoryRequest,
  type RepositoryTransformer,
} from './base.repository'
import type { ReadQueryDTO } from '../dtos/read-query.dto'
import { GSheetRepository } from './gsheet.repository'
import {
  customerFieldMap,
  customerRowSchema,
} from '../../modules/customers/customer-db.schema'
import {
  appointmentFieldMap,
  appointmentRowSchema,
} from '../../modules/appointments/appointment-db.schema'

type AnyRow = Record<string, unknown>
type CustomerRow = z.infer<typeof customerRowSchema>
type AppointmentRow = z.infer<typeof appointmentRowSchema>

class TestRepository extends BaseRepository<AnyRow, AnyRow, AnyRow, AnyRow> {
  lastRequest?: RepositoryRequest<unknown, unknown>
  nextResponse: unknown = {}

  constructor(input: {
    fieldMap?: FieldMap
    primaryKey: string
    transformer?: RepositoryTransformer
  }) {
    super(input)
  }

  read(query?: ReadQueryDTO<AnyRow>): Promise<Array<Partial<AnyRow>>> {
    return this.request<Array<Partial<AnyRow>>, ReadQueryDTO<AnyRow>, never>({
      operation: 'read',
      query,
    })
  }

  create(data: AnyRow): Promise<AnyRow> {
    return this.request<AnyRow, never, AnyRow>({ operation: 'create', data })
  }

  update(id: string, data: AnyRow): Promise<AnyRow> {
    return this.request<AnyRow, { id: string }, AnyRow>({
      operation: 'update',
      query: { id },
      data,
    })
  }

  delete(id: string): Promise<unknown> {
    return this.request<unknown, { id: string }, never>({
      operation: 'delete',
      query: { id },
    })
  }

  protected async execute<TResponse, TQuery = unknown, TData = unknown>(
    request: RepositoryRequest<TQuery, TData>,
  ): Promise<TResponse> {
    this.lastRequest = request as RepositoryRequest<unknown, unknown>
    return this.nextResponse as TResponse
  }
}

interface FetchCall {
  url: string
  init?: RequestInit
}

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>

const tests: Array<{ name: string; run: () => Promise<void> | void }> = []

function test(name: string, run: () => Promise<void> | void): void {
  tests.push({ name, run })
}

function customerTestRepo(): TestRepository {
  return new TestRepository({
    fieldMap: { ...customerFieldMap },
    primaryKey: 'customerId',
  })
}

function gvizBody(table: unknown): string {
  return `google.visualization.Query.setResponse(${JSON.stringify({
    status: 'ok',
    table,
  })});`
}

function response(input: { text?: string; json?: unknown; ok?: boolean; statusText?: string }): Response {
  return {
    ok: input.ok ?? true,
    status: input.ok === false ? 500 : 200,
    statusText: input.statusText ?? 'OK',
    text: async () => input.text ?? '',
    json: async () => input.json,
  } as Response
}

async function withMockFetch<T>(
  handler: FetchHandler,
  run: (calls: FetchCall[]) => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch
  const calls: FetchCall[] = []
  globalThis.fetch = (async (url: URL | string | { url?: string }, init?: RequestInit) => {
    const stringUrl = String(url)
    calls.push({ url: stringUrl, init })
    return handler(stringUrl, init)
  }) as typeof fetch

  try {
    return await run(calls)
  } finally {
    globalThis.fetch = originalFetch
  }
}

function tqFrom(url: string): string {
  return new URL(url).searchParams.get('tq') ?? ''
}

test('BaseRepository folds semantic read id into mapped primary-key where', async () => {
  const repo = customerTestRepo()

  await repo.read({ id: 'C001' })

  assert.deepEqual(repo.lastRequest, {
    operation: 'read',
    query: { where: { CustomerID: 'C001' } },
    data: undefined,
  })
})

test('BaseRepository ignores blank read id instead of losing the filter silently', async () => {
  const repo = customerTestRepo()

  await repo.read({ id: '   ' })

  assert.deepEqual(repo.lastRequest, {
    operation: 'read',
    query: {},
    data: undefined,
  })
})

test('BaseRepository maps where select search sort and leaves pagination untouched', async () => {
  const repo = customerTestRepo()

  await repo.read({
    where: {
      customerType: 'Member',
      deletedAt: null,
    },
    select: ['customerId', 'lineId'],
    search: {
      keyword: 'somchai',
      fields: ['customerName', 'address'],
    },
    sort: {
      field: 'customerIndex',
      order: 'asc',
    },
    pagination: {
      page: 2,
      perPage: 50,
    },
  })

  assert.deepEqual(repo.lastRequest, {
    operation: 'read',
    query: {
      where: {
        CustomerType: 'Member',
        DeletedAt: null,
      },
      select: ['CustomerID', 'Line'],
      search: {
        keyword: 'somchai',
        fields: ['CustomerName', 'Address'],
      },
      sort: {
        field: 'CustomerIndex',
        order: 'asc',
      },
      pagination: {
        page: 2,
        perPage: 50,
      },
    },
    data: undefined,
  })
})

test('BaseRepository lets id win over explicit where primary key', async () => {
  const repo = customerTestRepo()

  await repo.read({
    id: 'C001',
    where: {
      customerId: 'WRONG',
    },
  })

  assert.deepEqual(repo.lastRequest?.query, {
    where: {
      CustomerID: 'C001',
    },
  })
})

test('BaseRepository maps create and update data to DB fields', async () => {
  const repo = customerTestRepo()

  await repo.create({
    customerName: 'Alice',
    lineId: 'line-1',
  })

  assert.deepEqual(repo.lastRequest, {
    operation: 'create',
    query: undefined,
    data: {
      CustomerName: 'Alice',
      Line: 'line-1',
    },
  })

  await repo.update('C001', {
    customerName: 'Alice Updated',
    lineId: 'line-2',
  })

  assert.deepEqual(repo.lastRequest, {
    operation: 'update',
    query: {
      where: {
        CustomerID: 'C001',
      },
    },
    data: {
      CustomerName: 'Alice Updated',
      Line: 'line-2',
    },
  })
})

test('BaseRepository requires non-empty id for update and delete', async () => {
  const repo = customerTestRepo()

  await assert.rejects(
    () => repo.update('', { customerName: 'Alice' }),
    /Repository update requires a non-empty id/,
  )
  await assert.rejects(
    () => repo.delete('   '),
    /Repository delete requires a non-empty id/,
  )
})

test('BaseRepository maps object and array responses back to API fields', async () => {
  const repo = customerTestRepo()
  repo.nextResponse = {
    CustomerID: 'C001',
    CustomerName: 'Alice',
    Line: 'line-1',
  }

  assert.deepEqual(await repo.create({}), {
    customerId: 'C001',
    customerName: 'Alice',
    lineId: 'line-1',
  })

  repo.nextResponse = [
    {
      CustomerID: 'C001',
      CustomerName: 'Alice',
      Line: 'line-1',
    },
  ]

  assert.deepEqual(await repo.read(), [
    {
      customerId: 'C001',
      customerName: 'Alice',
      lineId: 'line-1',
    },
  ])
})

test('BaseRepository transformer sees DB fields between mapper.toDb and execute', async () => {
  const repo = new TestRepository({
    primaryKey: 'id',
    fieldMap: {
      Price: 'price',
      Quantity: 'quantity',
      Total: 'total',
    },
    transformer: {
      request(request) {
        assert.deepEqual(request.data, {
          Price: 10,
          Quantity: 2,
        })
        return {
          ...request,
          data: {
            ...(request.data as AnyRow),
            Total: 20,
          },
        }
      },
      response(_response, context) {
        assert.deepEqual(context.request.data, {
          Price: 10,
          Quantity: 2,
          Total: 20,
        })
        return {
          Total: 20,
        }
      },
    },
  })

  repo.nextResponse = {
    Price: 10,
    Quantity: 2,
  }

  assert.deepEqual(await repo.create({ price: 10, quantity: 2 }), {
    total: 20,
  })
  assert.deepEqual(repo.lastRequest?.data, {
    Price: 10,
    Quantity: 2,
    Total: 20,
  })
})

test('GSheetRepository read builds GViz query from mapped API fields', async () => {
  const repo = new GSheetRepository<AnyRow, AppointmentRow, AnyRow, AnyRow, AnyRow>({
    sheetName: 'Appointments',
    spreadsheetId: 'spreadsheet-id',
    scriptUrl: 'https://script.example/exec',
    rowSchema: appointmentRowSchema,
    primaryKey: 'appointmentId',
    fieldMap: { ...appointmentFieldMap },
  })

  await withMockFetch(
    async () => response({ text: gvizBody({ cols: [], rows: [] }) }),
    async (calls) => {
      await repo.read({
        select: ['appointmentId'],
        where: {
          status: 'PENDING',
        },
      })

      assert.equal(tqFrom(calls[0].url), "select A\nwhere F = 'PENDING'")
    },
  )
})

test('GSheetRepository maps GViz table columns to API fields', async () => {
  const repo = new GSheetRepository<AnyRow, AppointmentRow, AnyRow, AnyRow, AnyRow>({
    sheetName: 'Appointments',
    spreadsheetId: 'spreadsheet-id',
    scriptUrl: 'https://script.example/exec',
    rowSchema: appointmentRowSchema,
    primaryKey: 'appointmentId',
    fieldMap: { ...appointmentFieldMap },
  })

  await withMockFetch(
    async () =>
      response({
        text: gvizBody({
          cols: [{ id: 'A' }, { id: 'B' }, { id: 'F' }],
          rows: [
            {
              c: [{ v: 'A001' }, { v: 'C001' }, { v: 'PENDING' }],
            },
          ],
        }),
      }),
    async () => {
      assert.deepEqual(await repo.read(), [
        {
          appointmentId: 'A001',
          customerId: 'C001',
          status: 'PENDING',
        },
      ])
    },
  )
})

test('GSheetRepository throws when GViz returns an unknown column letter', async () => {
  const repo = new GSheetRepository<AnyRow, AppointmentRow, AnyRow, AnyRow, AnyRow>({
    sheetName: 'Appointments',
    spreadsheetId: 'spreadsheet-id',
    scriptUrl: 'https://script.example/exec',
    rowSchema: appointmentRowSchema,
    primaryKey: 'appointmentId',
    fieldMap: { ...appointmentFieldMap },
  })

  await withMockFetch(
    async () =>
      response({
        text: gvizBody({
          cols: [{ id: 'ZZ' }],
          rows: [{ c: [{ v: 'value' }] }],
        }),
      }),
    async () => {
      await assert.rejects(
        () => repo.read(),
        /No DB field resolves for GViz column 'ZZ'/,
      )
    },
  )
})

test('GSheetRepository create sends Apps Script append payload and maps response', async () => {
  const repo = new GSheetRepository<AnyRow, CustomerRow, AnyRow, AnyRow, AnyRow>({
    sheetName: 'Customers',
    spreadsheetId: 'spreadsheet-id',
    scriptUrl: 'https://script.example/exec',
    rowSchema: customerRowSchema,
    primaryKey: 'customerId',
    fieldMap: { ...customerFieldMap },
  })

  await withMockFetch(
    async () =>
      response({
        json: {
          success: true,
          data: {
            CustomerID: 'C001',
            CustomerName: 'Alice',
            Line: 'line-1',
          },
        },
      }),
    async (calls) => {
      assert.deepEqual(await repo.create({ customerName: 'Alice', lineId: 'line-1' }), {
        customerId: 'C001',
        customerName: 'Alice',
        lineId: 'line-1',
      })

      assert.deepEqual(JSON.parse(calls[0].init?.body as string), {
        action: 'APPEND',
        sheet: 'Customers',
        data: {
          CustomerName: 'Alice',
          Line: 'line-1',
        },
      })
    },
  )
})

test('GSheetRepository update sends Apps Script update payload with id winning', async () => {
  const repo = new GSheetRepository<AnyRow, CustomerRow, AnyRow, AnyRow, AnyRow>({
    sheetName: 'Customers',
    spreadsheetId: 'spreadsheet-id',
    scriptUrl: 'https://script.example/exec',
    rowSchema: customerRowSchema,
    primaryKey: 'customerId',
    fieldMap: { ...customerFieldMap },
  })

  await withMockFetch(
    async () =>
      response({
        json: {
          success: true,
          data: {
            CustomerID: 'C001',
            CustomerName: 'Alice Updated',
          },
        },
      }),
    async (calls) => {
      assert.deepEqual(
        await repo.update('C001', {
          customerId: 'WRONG',
          customerName: 'Alice Updated',
        }),
        {
          customerId: 'C001',
          customerName: 'Alice Updated',
        },
      )

      assert.deepEqual(JSON.parse(calls[0].init?.body as string), {
        action: 'UPDATE',
        sheet: 'Customers',
        data: {
          CustomerID: 'C001',
          CustomerName: 'Alice Updated',
        },
      })
    },
  )
})

test('GSheetRepository write throws Apps Script errors and delete is future', async () => {
  const repo = new GSheetRepository<AnyRow, CustomerRow, AnyRow, AnyRow, AnyRow>({
    sheetName: 'Customers',
    spreadsheetId: 'spreadsheet-id',
    scriptUrl: 'https://script.example/exec',
    rowSchema: customerRowSchema,
    primaryKey: 'customerId',
    fieldMap: { ...customerFieldMap },
  })

  await withMockFetch(
    async () =>
      response({
        json: {
          success: false,
          error: 'bad request',
        },
      }),
    async () => {
      await assert.rejects(
        () => repo.create({ customerName: 'Alice' }),
        /Apps Script APPEND failed: bad request/,
      )
    },
  )

  await assert.rejects(
    () => repo.delete('C001'),
    /GSheetRepository.delete is not implemented yet/,
  )
})

async function main(): Promise<void> {
  for (const item of tests) {
    await item.run()
  }
  console.log(`${tests.length} repository dry tests passed`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
